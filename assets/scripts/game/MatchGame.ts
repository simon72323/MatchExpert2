import { playSfx } from '../audio/AudioBootstrap';
import { AudioKey } from '../audio/AudioKey';
import { I18n } from '../core/I18n';
import {
    _decorator,
    Component,
    Node,
    UITransform,
    Color,
    Graphics,
    EventTouch,
    tween,
    Tween,
    Vec3,
    Layers,
    Camera,
    Sprite,
    SpriteFrame,
    Label,
    UIOpacity,
    resources,
} from 'cc';
import { LevelRepository } from '../data/LevelRepository';
import { LevelMode, GameConfig, TILE_TYPE, calcBoardRootScale, BOARD_ROOT_Y, TABLE_ROOT_Y, TILE_VISUAL } from '../core/GameConfig';
import { buildBoardSpawns, buildSymbolPool, countMatchableTiles, BoardTileSpawn } from './BoardLayout';
import { EventBus, GameEvents } from '../core/EventBus';
import { TileSymbol } from './TileSymbol';
import { GameApp } from '../core/GameApp';
import { SkinCatalog } from '../data/SkinCatalog';
import { SaveData } from '../core/SaveData';
import { TilePool } from './TilePool';
import {
    addIcon,
    addIconButton,
    addLabel,
    getCachedUiSprite,
    loadUiSprite,
    preloadUiSprites,
} from '../ui/UiFactory';
import { applySlicedSprite } from '../ui/UiSpriteUtil';


/** 組牌區縮放：與當關 BoardRoot 縮放一致（離開 BoardRoot 後需自行套用） */
function defaultTableScale(): number {
    return calcBoardRootScale(0);
}

const { ccclass, property } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

@ccclass('MatchGame')
export class MatchGame extends Component {
    static inst: MatchGame | null = null;
    /** LevelPop 勾選第 8 格時帶入下一局 */
    static pendingOpenEight = false;

    @property(Node)
    boardRoot: Node | null = null;

    @property(Node)
    tableRoot: Node | null = null;

    private _spawns: BoardTileSpawn[] = [];
    private _tiles: TileSymbol[] = [];
    private _table: TileSymbol[] = [];
    private _slots: Node[] = [];
    /** 撤回佇列（最新在前，對齊 Unity tableSaveNodeArray） */
    private _pickHistory: TileSymbol[] = [];
    private _busy = false;
    private _boardScale = defaultTableScale();
    private get tableScale(): number {
        return this._boardScale;
    }
    private _startedFor = '';
    private _gameTimer = GameConfig.maxGameTime;
    private _timeBarFillUt: UITransform | null = null;
    private _timeLabel: Label | null = null;
    private _levelLabel: Label | null = null;
    private _coinLabel: Label | null = null;
    private _hudReady = false;
    private _ended = false;
    private _eightOpened = false;
    private _pool: TilePool | null = null;
    /** 三消爆破序列幀（Unity fxBomb） */
    private _bombFrames: SpriteFrame[] | null = null;
    private _bombFramesLoading = false;
    /** 進行中的三消飛入／爆破動畫數（>0 時先不跳出過關） */
    private _pendingMatchAnims = 0;
    private _winQueued = false;
    private _winShown = false;
    /** 過關已 queue 後的保險計時（防排程漏觸發） */
    private _winSafetyTimer = 0;
    pause = true;
    tableLength = GameConfig.tableSlots;
    remainingMatchable = 0;

    get isEnded(): boolean {
        return this._ended;
    }
    get eightOpened(): boolean {
        return this._eightOpened;
    }

    onLoad(): void {
        MatchGame.inst = this;
        this.node.layer = UI_LAYER;
        if (this.boardRoot) this.boardRoot.layer = UI_LAYER;
        if (this.tableRoot) this.tableRoot.layer = UI_LAYER;
        // 永久監聽進關（勿只掛 onEnable，否則 ResultPop 下一關事件會漏接）
        EventBus.on('enter_level', this.onEnterLevel as (...args: unknown[]) => void);
        EventBus.on(GameEvents.GAME_REVIVAL, this.onRevival as (...args: unknown[]) => void);
        EventBus.on(GameEvents.COIN_CHANGED, this.onCoinHud as (...args: unknown[]) => void);
        this.fixUiCamera();
        this.ensureBackdrop(this.node, new Color(32, 48, 72, 255));
        this.ensureHud();
    }

    private onCoinHud = (): void => {
        this.refreshHud();
    };

    onDestroy(): void {
        EventBus.off('enter_level', this.onEnterLevel as (...args: unknown[]) => void);
        EventBus.off(GameEvents.GAME_REVIVAL, this.onRevival as (...args: unknown[]) => void);
        EventBus.off(GameEvents.COIN_CHANGED, this.onCoinHud as (...args: unknown[]) => void);
        this._pool?.clearAll();
        this._pool = null;
        if (MatchGame.inst === this) MatchGame.inst = null;
    }

    private ensurePool(): void {
        if (this._pool) return;
        let holder = this.node.getChildByName('__tilePool');
        if (!holder) {
            holder = new Node('__tilePool');
            holder.layer = UI_LAYER;
            this.node.addChild(holder);
        }
        this._pool = new TilePool(holder, (t) => this.onTileClick(t));
    }

    private recycleTile(tile: TileSymbol): void {
        if (!tile.node?.isValid) return;
        Tween.stopAllByTarget(tile.node);
        const op = tile.node.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        if (this._pool) this._pool.recycle(tile);
        else tile.node.destroy();
    }

    onEnable(): void {
        this.ensureTableSlots();
        this.scheduleOnce(() => {
            if (GameApp.inst && this._tiles.length === 0 && !this._ended) {
                this.startLevel(GameApp.inst.playingLevel, GameApp.inst.levelMode as LevelMode, true);
            }
        }, 0);
    }

    onDisable(): void {
        // 進關／復活監聽改掛 onLoad，這裡不再 off，避免下一關漏事件
    }

    update(dt: number): void {
        // 過關保險：已 queue 卻長時間未 finish（排程被清／漏觸發）時強制出結算
        if (this._winQueued && !this._winShown) {
            this._winSafetyTimer += dt;
            if (this._winSafetyTimer >= 2.5) {
                console.warn('[MatchGame] win safety flush pending=', this._pendingMatchAnims);
                this._pendingMatchAnims = 0;
                this._winQueued = false;
                this._winSafetyTimer = 0;
                this.pause = true;
                this._ended = true;
                this.onWin();
            }
        } else {
            this._winSafetyTimer = 0;
        }

        if (this.pause || this._ended) return;
        this._gameTimer = Math.max(0, this._gameTimer - dt);
        this.refreshHud();
        if (this._gameTimer <= 0) {
            this.pause = true;
            this._ended = true;
            this.onLose();
        }
    }

    private onEnterLevel = (level: unknown, mode: unknown): void => {
        this.startLevel(Number(level), Number(mode) as LevelMode, true);
    };

    private onRevival = (): void => {
        // 將組牌區最後最多 4 張退回棋盤（對齊 Unity runBack×4）
        const n = Math.min(4, this._table.length);
        const root = this.boardRoot ?? this.node;
        for (let i = 0; i < n; i++) {
            const tile = this._table.pop();
            if (!tile || !tile.node?.isValid) continue;
            const hi = this._pickHistory.indexOf(tile);
            if (hi >= 0) this._pickHistory.splice(hi, 1);
            tile.place = 'board';
            tile.node.setParent(root, true);
            tile.node.setPosition(tile.boardX, tile.boardY, tile.floor * 0.1);
            tile.node.setScale(1, 1, 1);
        }
        this.layoutTable();
        this.sortBoardDrawOrder();
        this.refreshCover(true);
        this.pause = false;
        this._ended = false;
        this._busy = false;
        // 小幅補時
        this._gameTimer = Math.min(GameConfig.maxGameTime, this._gameTimer + GameConfig.addTimeOnMatch * 4);
        this.refreshHud();
    };

    private fixUiCamera(): void {
        const cam =
            this.node.scene?.getChildByName('Canvas')?.getChildByName('Camera')?.getComponent(Camera) ?? null;
        if (cam) {
            cam.orthoHeight = 640;
            cam.projection = Camera.ProjectionType.ORTHO;
            cam.visibility = Layers.makeMaskInclude([Layers.Enum.UI_2D]);
        }
    }

    private markUi(n: Node): void {
        n.layer = UI_LAYER;
        for (const c of n.children) this.markUi(c);
    }

    startLevel(levelId: number, mode: LevelMode, force = false): void {
        const key = `${mode}-${levelId}`;
        if (!force && this._startedFor === key && this._tiles.length > 0) return;

        const data = LevelRepository.inst.getLevel(mode, levelId);
        if (!data) {
            console.warn('[MatchGame] level missing', mode, levelId);
            return;
        }

        console.log('[MatchGame] startLevel', key, 'blocks', data.positions.length);
        this._startedFor = key;
        this.unscheduleAllCallbacks();
        this._pendingMatchAnims = 0;
        this._winQueued = false;
        this._winShown = false;
        this._winSafetyTimer = 0;
        this.preloadBombFx();
        this._ended = false;
        this.pause = false;
        this._busy = false;
        this._eightOpened = false;
        this.tableLength = GameConfig.tableSlots;
        this._pickHistory = [];
        this._gameTimer = GameConfig.maxGameTime;
        if (MatchGame.pendingOpenEight) {
            MatchGame.pendingOpenEight = false;
            this._eightOpened = true;
            this.tableLength = 8;
        }
        this.fixUiCamera();
        this.clearBoard();
        this.ensureTableSlots();
        this.ensureBackdrop(this.node, new Color(32, 48, 72, 255));
        this.ensureHud();
        this._spawns = buildBoardSpawns(data);
        const matchable = countMatchableTiles(this._spawns);
        const pool = buildSymbolPool(data.symbolTypes, matchable);
        this.remainingMatchable = matchable;

        const root = this.boardRoot ?? this.node;
        root.layer = UI_LAYER;
        // Unity：座標用 cellSize=120；縮放只掛在父節點（Cocos 720 寬再乘 fit）
        const boardScale = calcBoardRootScale(data.scale ?? 0);
        this._boardScale = boardScale;
        root.setScale(boardScale, boardScale, 1);
        root.setPosition(0, BOARD_ROOT_Y, 0);

        let poolIdx = 0;
        for (const spawn of this._spawns) {
            const symbolId = spawn.isSpecial456 ? -1 : pool[poolIdx++];
            const tile = this.createTile(spawn, symbolId);
            root.addChild(tile.node);
            tile.boardX = spawn.x;
            tile.boardY = spawn.y;
            // 高層 z 更大，並稍後再依 floor 排 sibling，確保壓在上層
            tile.node.setPosition(tile.boardX, tile.boardY, spawn.floor * 0.1);
            this._tiles.push(tile);
        }

        this.sortBoardDrawOrder();
        console.log('[MatchGame] tiles ready', this._tiles.length, 'skinCache', SkinCatalog.inst.ready);
        this.refreshCover(true);
        this.layoutTable();
        this.refreshHud();
        EventBus.emit('item_changed');
        this.pause = false;
        this._busy = false;
    }

    private ensureHud(): void {
        let hud = this.node.getChildByName('__hud');
        if (!hud) {
            hud = new Node('__hud');
            this.markUi(hud);
            this.node.addChild(hud);
            hud.addComponent(UITransform).setContentSize(720, 140);
            hud.setPosition(0, 540, 0);

            // 時間條底
            const barBg = new Node('timeBg');
            this.markUi(barBg);
            hud.addChild(barBg);
            barBg.addComponent(UITransform).setContentSize(440, 28);
            barBg.setPosition(-20, 28, 0);
            const barBgSp = barBg.addComponent(Sprite);
            barBgSp.sizeMode = Sprite.SizeMode.CUSTOM;
            void loadUiSprite('ui/bar_6').then((sf) => {
                if (sf && barBgSp.isValid) applySlicedSprite(barBgSp, sf, 'ui/bar_6');
            });

            // 時間條填（左錨點拉寬）
            const barFill = new Node('timeFill');
            this.markUi(barFill);
            hud.addChild(barFill);
            const fillUt = barFill.addComponent(UITransform);
            fillUt.setContentSize(440, 22);
            fillUt.setAnchorPoint(0, 0.5);
            barFill.setPosition(-240, 28, 0);
            const fillSp = barFill.addComponent(Sprite);
            fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
            void loadUiSprite('ui/bar_7').then((sf) => {
                if (sf && fillSp.isValid) applySlicedSprite(fillSp, sf, 'ui/bar_7');
            });
            this._timeBarFillUt = fillUt;

            this._timeLabel = addLabel(hud, 'timeLab', -200, -8, 22, '', Color.WHITE, 120, 32);
            this._timeLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

            this._levelLabel = addLabel(hud, 'levelLab', -40, -8, 22, '', Color.WHITE, 160, 32);

            addIcon(hud, 'coinIcon', 'ui/icon_coin', 36, 140, -6);
            this._coinLabel = addLabel(hud, 'coinLab', 210, -8, 22, '', new Color(255, 230, 120, 255), 120, 32);
            this._coinLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

            // 星圖列
            // stars removed
            hud.getChildByName('star_0')?.destroy();
            hud.getChildByName('star_1')?.destroy();
            hud.getChildByName('star_2')?.destroy();
            hud.getChildByName('starLab')?.destroy();

            addIconButton(hud, 'pauseBtn', 'ui/btn_main_pause', 72, 310, 20, () => {
                if (this._ended) return;
                playSfx(AudioKey.btnClick);
                EventBus.emit(GameEvents.OPEN_PAUSE);
            });

            void preloadUiSprites([
                'ui/bar_6',
                'ui/bar_7',
                'ui/btn_main_pause',
                'ui/icon_coin',
                'ui/pic_boxLine',
            ]).then(() => {
                this._hudReady = true;
                this.refreshHud();
            });
        } else {
            this._timeBarFillUt = hud.getChildByName('timeFill')?.getComponent(UITransform) ?? this._timeBarFillUt;
            this._timeLabel = hud.getChildByName('timeLab')?.getComponent(Label) ?? this._timeLabel;
            this._levelLabel = hud.getChildByName('levelLab')?.getComponent(Label) ?? this._levelLabel;
            this._coinLabel = hud.getChildByName('coinLab')?.getComponent(Label) ?? this._coinLabel;
            // 清掉舊連擊節點（若有）
            hud.getChildByName('comboBg')?.destroy();
            hud.getChildByName('star_0')?.destroy();
            hud.getChildByName('star_1')?.destroy();
            hud.getChildByName('star_2')?.destroy();
            hud.getChildByName('starLab')?.destroy();
        }
        this.refreshHud();
    }

    private refreshHud(): void {
        const ratio = Math.max(0, Math.min(1, this._gameTimer / GameConfig.maxGameTime));
        if (this._timeBarFillUt) {
            this._timeBarFillUt.setContentSize(Math.max(8, 440 * ratio), 22);
        }
        if (this._timeLabel) {
            this._timeLabel.string = `${Math.ceil(this._gameTimer)}s`;
        }
        if (this._levelLabel) {
            const lv = GameApp.inst?.playingLevel ?? 1;
            this._levelLabel.string = `${I18n.inst.t('level')} ${lv}`;
        }
        if (this._coinLabel) {
            this._coinLabel.string = String(SaveData.inst.data.playerCoin);
        }
        void this._hudReady;
    }

    private ensureBackdrop(host: Node, color: Color): void {
        const W = 720;
        const H = 1280;
        let bg = host.getChildByName('__bg');
        if (!bg) {
            bg = new Node('__bg');
            this.markUi(bg);
            host.insertChild(bg, 0);
            bg.addComponent(UITransform);
            bg.addComponent(Sprite);
        }
        this.markUi(bg);
        bg.setSiblingIndex(0);
        const ui = bg.getComponent(UITransform)!;
        let sp = bg.getComponent(Sprite);
        if (!sp) sp = bg.addComponent(Sprite);
        const frame = SkinCatalog.inst.getBg();
        if (frame) {
            sp.enabled = true;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frame;
            const rw = frame.rect.width || frame.originalSize.width || 1024;
            const rh = frame.rect.height || frame.originalSize.height || 2048;
            const scale = Math.max(W / rw, H / rh);
            ui.setContentSize(rw * scale, rh * scale);
            bg.setPosition(0, 0, 0);
            // 清掉舊的 fallback 色塊（不可與 Sprite 同節點掛 Graphics）
            const fallback = bg.getChildByName('__fallback');
            if (fallback?.isValid) fallback.destroy();
        } else {
            sp.enabled = false;
            sp.spriteFrame = null;
            ui.setContentSize(W, H);
            let fallback = bg.getChildByName('__fallback');
            if (!fallback) {
                fallback = new Node('__fallback');
                this.markUi(fallback);
                bg.addChild(fallback);
                fallback.addComponent(UITransform).setContentSize(W, H);
                fallback.addComponent(Graphics);
            }
            const g = fallback.getComponent(Graphics)!;
            g.clear();
            g.fillColor = color;
            g.rect(-W / 2, -H / 2, W, H);
            g.fill();
        }
    }

    private ensureTableSlots(): void {
        const root = this.tableRoot;
        if (!root) return;
        root.layer = UI_LAYER;

        // 重建前先把組牌暫掛到 GameView，避免被 slot destroy 帶走
        for (const t of this._table) {
            if (t.node?.isValid) t.node.setParent(this.node, true);
        }

        this._slots = [];
        for (const c of root.children.slice()) c.destroy();

        const slotW = Math.round(GameConfig.cellSize * this._boardScale) + 8;
        const totalW = this.tableLength * slotW;
        const startX = -totalW / 2 + slotW / 2;
        const slotFrame = getCachedUiSprite('ui/pic_boxLine') ?? SkinCatalog.inst.getBox(0);
        for (let i = 0; i < this.tableLength; i++) {
            const slot = new Node(`slot_${i}`);
            this.markUi(slot);
            const ui = slot.addComponent(UITransform);
            ui.setContentSize(slotW - 6, slotW - 6);
            const sp = slot.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            if (slotFrame) {
                sp.spriteFrame = slotFrame;
                sp.color = new Color(255, 255, 255, 180);
            } else {
                sp.enabled = false;
                const fb = new Node('__fb');
                this.markUi(fb);
                slot.addChild(fb);
                fb.addComponent(UITransform).setContentSize(slotW - 6, slotW - 6);
                const g = fb.addComponent(Graphics);
                g.strokeColor = new Color(255, 255, 255, 160);
                g.fillColor = new Color(0, 0, 0, 80);
                g.lineWidth = 3;
                g.rect(-(slotW - 6) / 2, -(slotW - 6) / 2, slotW - 6, slotW - 6);
                g.fill();
                g.stroke();
            }
            void loadUiSprite('ui/pic_boxLine').then((sf) => {
                if (sf && sp.isValid) {
                    sp.enabled = true;
                    sp.spriteFrame = sf;
                    sp.color = new Color(255, 255, 255, 180);
                    slot.getChildByName('__fb')?.destroy();
                }
            });
            root.addChild(slot);
            slot.setPosition(startX + i * slotW, 0, 0);
            this._slots.push(slot);
        }
        root.setPosition(0, TABLE_ROOT_Y, 0);
        this.layoutTable();
    }

    private createTile(spawn: BoardTileSpawn, symbolId: number): TileSymbol {
        this.ensurePool();
        const tile = this._pool!.acquire();
        const n = tile.node;
        n.name = `tile_${spawn.index}`;
        const size = GameConfig.cellSize;
        n.getComponent(UITransform)?.setContentSize(size, size);

        const boxNode = n.getChildByName('box')!;
        const iconNode = n.getChildByName('icon')!;
        boxNode.setPosition(TILE_VISUAL.box.x, TILE_VISUAL.box.y, 0);
        boxNode.getComponent(UITransform)?.setContentSize(TILE_VISUAL.box.w, TILE_VISUAL.box.h);
        iconNode.setPosition(TILE_VISUAL.icon.x, TILE_VISUAL.icon.y, 0);
        iconNode.getComponent(UITransform)?.setContentSize(TILE_VISUAL.icon.w, TILE_VISUAL.icon.h);
        const boxSp = boxNode.getComponent(Sprite)!;
        const iconSp = iconNode.getComponent(Sprite)!;
        boxSp.color = Color.WHITE;
        iconSp.color = Color.WHITE;

        const skin = SkinCatalog.inst;
        const typeId = spawn.tileType;

        if (typeId === TILE_TYPE.WATER || typeId === TILE_TYPE.STONE || typeId === TILE_TYPE.HAMMER) {
            boxSp.spriteFrame = skin.getSpecialBox(typeId);
            iconSp.spriteFrame = this.getExtraIcon(typeId);
        } else if (typeId === TILE_TYPE.ICE || typeId === TILE_TYPE.FIRE) {
            boxSp.spriteFrame = skin.getBox(0);
            iconSp.spriteFrame = symbolId >= 0 ? skin.getSymbol(symbolId) : null;
            const overlay = new Node('overlay');
            this.markUi(overlay);
            overlay.setPosition(TILE_VISUAL.box.x, TILE_VISUAL.box.y, 0);
            overlay.addComponent(UITransform).setContentSize(TILE_VISUAL.box.w, TILE_VISUAL.box.h);
            const osp = overlay.addComponent(Sprite);
            osp.sizeMode = Sprite.SizeMode.CUSTOM;
            if (typeId === TILE_TYPE.ICE) osp.spriteFrame = skin.getSpecialBox(TILE_TYPE.ICE);
            if (typeId === TILE_TYPE.FIRE) {
                osp.spriteFrame = skin.getBox(0);
                osp.color = new Color(255, 80, 40, 180);
            }
            n.addChild(overlay);
        } else {
            boxSp.spriteFrame = skin.getBox(0);
            iconSp.spriteFrame = symbolId >= 0 ? skin.getSymbol(symbolId) : null;
            if (typeId === TILE_TYPE.HIDE) {
                const hide = new Node('hide');
                this.markUi(hide);
                hide.setPosition(TILE_VISUAL.box.x, TILE_VISUAL.box.y, 0);
                hide.addComponent(UITransform).setContentSize(TILE_VISUAL.box.w, TILE_VISUAL.box.h);
                const hsp = hide.addComponent(Sprite);
                hsp.sizeMode = Sprite.SizeMode.CUSTOM;
                hsp.spriteFrame = skin.getSpecialBox(TILE_TYPE.HIDE);
                n.addChild(hide);
            }
        }

        const normalBox = boxSp.spriteFrame;
        tile.symbolId = symbolId;
        tile.typeId = typeId as typeof tile.typeId;
        tile.posIndex = spawn.index;
        tile.floor = spawn.floor;
        tile.boardX = spawn.x;
        tile.boardY = spawn.y;
        // Unity：被壓住 → Color(0.45,0.45,0.45)；露出 → white
        const dimColor = new Color(115, 115, 115, 255);
        tile.onVisualCover = (covered) => {
            if (covered) {
                boxSp.spriteFrame = skin.getBoxGray() ?? normalBox;
                boxSp.color = dimColor;
                iconSp.color = dimColor;
                this.setTileDimOverlay(n, true);
            } else {
                boxSp.spriteFrame =
                    typeId === TILE_TYPE.STONE ? skin.getStoneBox(tile.stoneState) : normalBox;
                boxSp.color = Color.WHITE;
                iconSp.color = Color.WHITE;
                this.setTileDimOverlay(n, false);
            }
            // 特殊覆蓋層也同步變暗／還原
            for (const name of ['overlay', 'hide']) {
                const ov = n.getChildByName(name)?.getComponent(Sprite);
                if (!ov) continue;
                if (covered) {
                    ov.color = typeId === TILE_TYPE.FIRE ? new Color(180, 50, 30, 160) : dimColor;
                } else if (typeId === TILE_TYPE.FIRE) {
                    ov.color = new Color(255, 80, 40, 180);
                } else {
                    ov.color = Color.WHITE;
                }
            }
        };
        tile.onStoneVisual = (state) => {
            boxSp.spriteFrame = skin.getStoneBox(state);
        };

        return tile;
    }

    /** 被壓住時加半透明遮罩，視覺比單純染色更明顯 */
    private setTileDimOverlay(tileNode: Node, on: boolean): void {
        let dim = tileNode.getChildByName('dim');
        if (on) {
            if (!dim) {
                dim = new Node('dim');
                this.markUi(dim);
                const bw = TILE_VISUAL.box.w;
                const bh = TILE_VISUAL.box.h;
                dim.setPosition(TILE_VISUAL.box.x, TILE_VISUAL.box.y, 0);
                dim.addComponent(UITransform).setContentSize(bw, bh);
                const g = dim.addComponent(Graphics);
                g.fillColor = new Color(0, 0, 0, 100);
                g.roundRect(-bw / 2, -bh / 2, bw, bh, 12);
                g.fill();
                tileNode.addChild(dim);
            }
            dim.active = true;
            dim.setSiblingIndex(tileNode.children.length - 1);
        } else if (dim) {
            dim.active = false;
        }
    }

    private getExtraIcon(typeId: number): SpriteFrame | null {
        if (typeId === TILE_TYPE.WATER) return SkinCatalog.inst.getIconWater();
        if (typeId === TILE_TYPE.HAMMER) return SkinCatalog.inst.getIconHammer();
        return null;
    }

    private onTileClick(tile: TileSymbol): void {
        if (this.pause || this._ended) return;
        // 下移中不鎖盤：可連續點；順序以點擊當下的 _table 狀態為準（單執行緒保證先後）
        if (!tile.clickable) {
            playSfx(AudioKey.hitError);
            return;
        }
        if (tile.typeId === TILE_TYPE.WATER || tile.typeId === TILE_TYPE.HAMMER) {
            this.activateSpecial(tile);
            return;
        }
        if (this._table.length >= this.tableLength) {
            this._ended = true;
            this.pause = true;
            this.onLose();
            return;
        }
        this.pickToTable(tile);
    }

    /** 水：滅一把火 + 解鄰冰；槌：敲石頭（需 3 次）+ 解鄰冰 */
    private activateSpecial(tile: TileSymbol): void {
        this._busy = true;
        const isHammer = tile.typeId === TILE_TYPE.HAMMER;
        const fromX = tile.boardX;
        const fromY = tile.boardY;
        const fromFloor = tile.floor;

        tile.removed = true;
        tween(tile.node)
            .to(0.2, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .call(() => {
                if (tile.node?.isValid) this.recycleTile(tile);
            })
            .start();

        if (isHammer) {
            playSfx(AudioKey.boxTouch);
            // 優先敲未蓋住的石頭
            const stones = this._tiles
                .filter((t) => !t.removed && t.place === 'board' && !t.covered && t.typeId === TILE_TYPE.STONE)
                .sort((a, b) => b.floor - a.floor);
            if (stones[0]) this.hitStone(stones[0]);
        } else {
            playSfx(AudioKey.boxTouch);
            const fires = this._tiles
                .filter((t) => !t.removed && t.place === 'board' && !t.covered && t.typeId === TILE_TYPE.FIRE)
                .sort((a, b) => b.floor - a.floor);
            if (fires[0]) this.extinguishFire(fires[0]);
        }

        // 鄰近破冰（以原位置為準）
        this.unlockAdjacentIceAt(fromX, fromY, fromFloor);
        this.refreshCover(true);
        this._busy = false;
        this.checkLoseOrWin();
    }

    private extinguishFire(t: TileSymbol): void {
        const ov = t.node.getChildByName('overlay');
        if (ov) {
            tween(ov)
                .to(0.2, { scale: new Vec3(0, 0, 1) })
                .call(() => {
                    if (ov.isValid) ov.destroy();
                })
                .start();
        }
        t.typeId = TILE_TYPE.NORMAL;
        playSfx(AudioKey.fireHit);
    }

    private hitStone(t: TileSymbol): void {
        t.stoneState = Math.min(3, t.stoneState + 1);
        t.onStoneVisual?.(t.stoneState);
        playSfx(AudioKey.stoneHit);
        if (t.stoneState >= 3) {
            t.removed = true;
            t.typeId = TILE_TYPE.STONE;
            tween(t.node)
                .to(0.25, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
                .call(() => {
                    if (t.node?.isValid) this.recycleTile(t);
                })
                .start();
        }
    }

    private crackIce(t: TileSymbol): void {
        const ov = t.node.getChildByName('overlay');
        if (ov) {
            tween(ov)
                .to(0.25, { scale: new Vec3(0, 0, 1) })
                .call(() => {
                    if (ov.isValid) ov.destroy();
                })
                .start();
        }
        t.typeId = TILE_TYPE.NORMAL;
        playSfx(AudioKey.iceHit);
    }

    private unlockAdjacentIceAt(x: number, y: number, floor: number): void {
        const cell = GameConfig.cellSize;
        for (const t of this._tiles) {
            if (t.removed || t.place !== 'board' || t.typeId !== TILE_TYPE.ICE) continue;
            if (t.floor !== floor) continue;
            const dx = Math.abs(t.boardX - x);
            const dy = Math.abs(t.boardY - y);
            const ortho =
                (dx < cell * 0.2 && Math.abs(dy - cell) < cell * 0.2) ||
                (dy < cell * 0.2 && Math.abs(dx - cell) < cell * 0.2);
            if (ortho) this.crackIce(t);
        }
    }

    private pickToTable(tile: TileSymbol): void {
        playSfx(AudioKey.UI_Drag_PutIn);

        if (tile.typeId === TILE_TYPE.HIDE) {
            const hide = tile.node.getChildByName('hide');
            if (hide) hide.destroy();
            tile.typeId = TILE_TYPE.NORMAL;
            playSfx(AudioKey.hideOpen);
        }

        const fromX = tile.boardX;
        const fromY = tile.boardY;
        const fromFloor = tile.floor;

        // 立刻標記離場，避免連點同一塊；後續點擊依此時 _table 決定插入順序
        tile.place = 'table';
        tile.setCovered(false, true);
        this.unlockAdjacentIceAt(fromX, fromY, fromFloor);
        this.refreshCover(true);

        const insertAt = this.findInsertIndex(tile.symbolId);
        this._table.splice(insertAt, 0, tile);
        this._pickHistory.unshift(tile);

        // 先把既有組牌格重排到正確槽（含被擠開的牌），再飛入新牌
        this.rebindTableSlots(tile);

        const slot = this._slots[Math.min(insertAt, this._slots.length - 1)];
        if (slot && tile.node?.isValid) {
            const world = tile.node.worldPosition.clone();
            tile.node.setParent(slot, true);
            tile.node.setWorldPosition(world);
            Tween.stopAllByTarget(tile.node);
            tween(tile.node)
                .to(
                    GameConfig.moveTime,
                    { position: new Vec3(0, 0, 0), scale: new Vec3(this.tableScale, this.tableScale, 1) },
                    { easing: 'cubicOut' },
                )
                .call(() => {
                    if (!tile.removed && tile.node?.isValid) {
                        this.layoutTable();
                    }
                    this.checkLoseOrWin();
                })
                .start();
        }

        // 三消立刻判定邏輯；視覺消失會等 moveTime（最後一顆飛到位）
        this.tryMatchAt(tile.symbolId);
        this.checkLoseOrWin();
    }

    /**
     * 依目前 _table 順序把各牌綁到對應槽。
     * flying 為正飛入的牌：只改 parent／保留世界座標，由其自己的 tween 飛到槽心。
     * 其餘被擠位的牌：短 tween 滑到新槽。
     */
    private rebindTableSlots(flying: TileSymbol | null): void {
        this.slideTableSlots(0.2, flying);
    }

    private findInsertIndex(symbolId: number): number {
        let last = -1;
        for (let i = 0; i < this._table.length; i++) {
            if (this._table[i].symbolId === symbolId) last = i;
        }
        return last >= 0 ? last + 1 : this._table.length;
    }

    private layoutTable(): void {
        for (let i = 0; i < this._table.length; i++) {
            const tile = this._table[i];
            const slot = this._slots[i];
            if (!slot || !tile.node?.isValid || tile.removed) continue;
            if (tile.node.parent !== slot) tile.node.setParent(slot, false);
            Tween.stopAllByTarget(tile.node);
            tile.node.setPosition(0, 0, 0);
            tile.node.setScale(this.tableScale, this.tableScale, 1);
        }
    }

    /** 組牌區補位／重排：保留世界座標再 tween 到槽心（對齊 Unity 0.2s 前移） */
    private slideTableSlots(duration = 0.2, skip: TileSymbol | null = null): void {
        for (let i = 0; i < this._table.length; i++) {
            const t = this._table[i];
            const slot = this._slots[i];
            if (!slot || !t.node?.isValid || t.removed) continue;
            if (skip && t === skip) continue;

            const needReparent = t.node.parent !== slot;
            const local = t.node.position;
            const alreadyHome =
                !needReparent &&
                Math.abs(local.x) < 0.5 &&
                Math.abs(local.y) < 0.5;

            if (alreadyHome) {
                t.node.setScale(this.tableScale, this.tableScale, 1);
                continue;
            }

            if (needReparent) {
                const world = t.node.worldPosition.clone();
                t.node.setParent(slot, true);
                t.node.setWorldPosition(world);
            }

            Tween.stopAllByTarget(t.node);
            if (duration <= 0) {
                t.node.setPosition(0, 0, 0);
                t.node.setScale(this.tableScale, this.tableScale, 1);
            } else {
                tween(t.node)
                    .to(
                        duration,
                        { position: new Vec3(0, 0, 0), scale: new Vec3(this.tableScale, this.tableScale, 1) },
                        { easing: 'cubicOut' },
                    )
                    .start();
            }
        }
    }

    private tryMatchAt(symbolId: number): void {
        let start = -1;
        let count = 0;
        for (let i = 0; i < this._table.length; i++) {
            if (this._table[i].symbolId === symbolId) {
                if (start < 0) start = i;
                count++;
                if (count >= 3) {
                    this.removeMatched(start, 3);
                    return;
                }
            } else {
                start = -1;
                count = 0;
            }
        }
    }

    /**
     * 對齊 Unity：組牌陣列立刻移除，視覺等 moveTime（最後一顆飛入）後才縮放淡出 + fxBomb。
     */
    private removeMatched(start: number, count: number): void {
        const removed = this._table.splice(start, count);
        if (removed.length === 0) return;

        this._pendingMatchAnims += 1;
        const symbolId = removed[0]?.symbolId ?? -1;
        const host = this.tableRoot ?? this.node;
        const anchors: Vec3[] = [];
        for (let i = 0; i < removed.length; i++) {
            const slot = this._slots[Math.min(start + i, this._slots.length - 1)];
            const t = removed[i];
            anchors.push(
                slot?.worldPosition?.clone() ??
                    (t.node?.isValid ? t.node.worldPosition.clone() : new Vec3(0, -420, 0)),
            );
        }
        const fxPos = anchors[Math.min(1, anchors.length - 1)].clone();

        for (let i = 0; i < removed.length; i++) {
            const t = removed[i];
            t.removed = true;
            this.remainingMatchable = Math.max(0, this.remainingMatchable - 1);
            const hi = this._pickHistory.indexOf(t);
            if (hi >= 0) this._pickHistory.splice(hi, 1);
            this.unlockAdjacentIceAt(t.boardX, t.boardY, t.floor);

            if (!t.node?.isValid) continue;
            const holder = new Node('matchOut');
            holder.layer = UI_LAYER;
            host.addChild(holder);
            holder.addComponent(UITransform).setContentSize(1, 1);
            holder.setWorldPosition(anchors[i]);
            t.node.setParent(holder, true);
            Tween.stopAllByTarget(t.node);
            tween(t.node)
                .to(
                    GameConfig.moveTime,
                    { position: new Vec3(0, 0, 0), scale: new Vec3(this.tableScale, this.tableScale, 1) },
                    { easing: 'cubicOut' },
                )
                .start();
        }

        this.refreshCover(true);
        this.checkLoseOrWin();

        // 視覺與結算拆開：結算排程獨立註冊，避免特效／音效 throw 導致永遠不 finish → 無過關彈窗
        const moveT = GameConfig.moveTime;
        const fadeT = 0.5;
        const finishDelay = moveT + fadeT + 0.08;
        this.scheduleOnce(() => this.finishMatchAnim(), finishDelay);

        this.scheduleOnce(() => {
            try {
                this.slideTableSlots(0.2);
                this.playMatchBombFx(fxPos);
                playSfx(AudioKey.boxBomb);

                this._gameTimer = Math.min(GameConfig.maxGameTime, this._gameTimer + GameConfig.addTimeOnMatch);
                if (symbolId >= 0) {
                    SaveData.inst.saveBlockEliminate(symbolId, 1);
                    SaveData.inst.savePlayerCoin(1);
                    EventBus.emit(GameEvents.COIN_CHANGED, SaveData.inst.data.playerCoin);
                }
                this.refreshHud();

                for (const t of removed) {
                    if (!t.node?.isValid) continue;
                    Tween.stopAllByTarget(t.node);
                    let op = t.node.getComponent(UIOpacity);
                    if (!op) op = t.node.addComponent(UIOpacity);
                    op.opacity = 255;
                    tween(t.node)
                        .to(fadeT, { scale: new Vec3(0, 0, 1) }, { easing: 'circOut' })
                        .start();
                    tween(op).to(fadeT, { opacity: 0 }).start();
                }
            } catch (e) {
                console.warn('[MatchGame] match fx error', e);
            }
        }, moveT);

        this.scheduleOnce(() => {
            for (const t of removed) {
                if (!t.node?.isValid) continue;
                const holder = t.node.parent;
                this.recycleTile(t);
                if (holder?.isValid && holder.name === 'matchOut') holder.destroy();
            }
        }, finishDelay - 0.02);
    }

    private preloadBombFx(): void {
        if (this._bombFrames || this._bombFramesLoading) return;
        this._bombFramesLoading = true;
        resources.loadDir('fx/bomb', SpriteFrame, (err, assets) => {
            this._bombFramesLoading = false;
            if (err || !assets?.length) {
                console.warn('[MatchGame] bomb fx load fail', err?.message);
                this._bombFrames = [];
                return;
            }
            this._bombFrames = assets.slice().sort((a, b) => a.name.localeCompare(b.name));
            console.log('[MatchGame] bomb frames', this._bombFrames.length);
        });
    }

    private playMatchBombFx(worldPos: Vec3): void {
        const host = this.tableRoot ?? this.node;
        const fx = new Node('fxBomb');
        fx.layer = UI_LAYER;
        host.addChild(fx);
        fx.addComponent(UITransform).setContentSize(180, 180);
        fx.setWorldPosition(worldPos);

        const frames = this._bombFrames;
        if (frames && frames.length > 0) {
            const sp = fx.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            let idx = 0;
            sp.spriteFrame = frames[0];
            const step = () => {
                idx += 1;
                if (idx >= frames.length || !fx.isValid) {
                    this.unschedule(step);
                    if (fx.isValid) fx.destroy();
                    return;
                }
                sp.spriteFrame = frames[idx];
            };
            this.schedule(step, 0.04);
        } else {
            const g = fx.addComponent(Graphics);
            g.fillColor = new Color(255, 220, 80, 220);
            g.circle(0, 0, 24);
            g.fill();
            let op = fx.getComponent(UIOpacity);
            if (!op) op = fx.addComponent(UIOpacity);
            tween(fx)
                .to(0.35, { scale: new Vec3(2.4, 2.4, 1) }, { easing: 'quadOut' })
                .call(() => {
                    if (fx.isValid) fx.destroy();
                })
                .start();
            tween(op).to(0.35, { opacity: 0 }).start();
            this.preloadBombFx();
        }
    }


    /** 換膚後刷新場上貼圖與背景 */
    applySkinRefresh(): void {
        this.ensureBackdrop(this.node, new Color(32, 48, 72, 255));
        const skin = SkinCatalog.inst;
        for (const t of this._tiles) {
            if (t.removed || !t.node?.isValid) continue;
            const icon = t.node.getChildByName('icon')?.getComponent(Sprite);
            if (icon && t.symbolId >= 0) {
                icon.spriteFrame = skin.getSymbol(t.symbolId);
            }
            this.refreshOneBox(t);
        }
    }

    private refreshOneBox(t: TileSymbol): void {
        if (t.symbolId < 0) return;
        if (t.typeId === TILE_TYPE.WATER || t.typeId === TILE_TYPE.STONE || t.typeId === TILE_TYPE.HAMMER) return;
        const box = t.node.getChildByName('box')?.getComponent(Sprite);
        if (!box) return;
        const frame = SkinCatalog.inst.getBox(0);
        if (!t.covered && frame) box.spriteFrame = frame;
    }

    private refreshCover(force = false): void {
        // boardX/Y 為 Unity 邏輯座標（未含 boardRoot scale）；半格交錯約 60，門檻用格寬
        const thresh = GameConfig.cellSize * 0.95;
        const onBoard = this._tiles.filter((t) => !t.removed && t.place === 'board');
        for (const a of onBoard) {
            let covered = false;
            for (const b of onBoard) {
                if (b === a) continue;
                if (b.floor <= a.floor) continue;
                if (Math.abs(b.boardX - a.boardX) < thresh && Math.abs(b.boardY - a.boardY) < thresh) {
                    covered = true;
                    break;
                }
            }
            a.setCovered(covered, force);
        }
    }

    /** 低層先畫、高層後畫（sibling），避免 z 排序把疊層畫反 */
    private sortBoardDrawOrder(): void {
        const root = this.boardRoot ?? this.node;
        const boardTiles = this._tiles
            .filter((t) => !t.removed && t.place === 'board' && t.node?.isValid)
            .sort((a, b) => a.floor - b.floor || a.posIndex - b.posIndex);
        for (let i = 0; i < boardTiles.length; i++) {
            const t = boardTiles[i];
            t.node.setSiblingIndex(i);
            t.node.setPosition(t.boardX, t.boardY, t.floor * 0.1);
        }
        // 確保背景仍在最底（若 bg 也在 boardRoot 下）
        const bg = root.getChildByName('__bg');
        if (bg) bg.setSiblingIndex(0);
    }

    private checkLoseOrWin(): void {
        if (this._winShown) return;
        if (this._ended && !this._winQueued) return;

        // 以實際尚未清除的可配對牌為準（棋盤+組牌區，避免計數漂移）
        const left = this.countMatchableLeft();
        this.remainingMatchable = left;

        if (left <= 0) {
            this.pause = true;
            this._ended = true;
            if (this._pendingMatchAnims > 0) {
                this._winQueued = true;
                console.log('[MatchGame] win queued, pendingAnims=', this._pendingMatchAnims);
                return;
            }
            this._winQueued = false;
            this.onWin();
            return;
        }

        if (this._winQueued) return;

        if (this._table.length >= this.tableLength) {
            this.pause = true;
            this._ended = true;
            this.onLose();
        }
    }

    /** 尚未清除、仍需三消的牌（棋盤或組牌區；不含水／槌／石） */
    private countMatchableLeft(): number {
        let n = 0;
        for (const t of this._tiles) {
            if (t.removed) continue;
            if (t.symbolId < 0) continue;
            if (
                t.typeId === TILE_TYPE.WATER ||
                t.typeId === TILE_TYPE.HAMMER ||
                t.typeId === TILE_TYPE.STONE
            ) {
                continue;
            }
            n += 1;
        }
        return n;
    }

    private finishMatchAnim(): void {
        this._pendingMatchAnims = Math.max(0, this._pendingMatchAnims - 1);
        console.log(
            '[MatchGame] finishMatchAnim pending=',
            this._pendingMatchAnims,
            'winQueued=',
            this._winQueued,
            'left=',
            this.countMatchableLeft(),
        );
        if (this._winShown) return;
        if (this._winQueued && this._pendingMatchAnims <= 0) {
            this.remainingMatchable = this.countMatchableLeft();
            if (this.remainingMatchable <= 0) {
                this._winQueued = false;
                this.pause = true;
                this._ended = true;
                this.onWin();
                return;
            }
            this._winQueued = false;
        }
        this.checkLoseOrWin();
    }

    private clearBoard(): void {
        this.ensurePool();
        for (const t of this._tiles) {
            if (t.node?.isValid) this.recycleTile(t);
        }
        this._tiles = [];
        this._table = [];
        this._pickHistory = [];
        this._spawns = [];
        this.remainingMatchable = 0;

        const stripFx = (root: Node | null) => {
            if (!root?.isValid) return;
            for (const c of root.children.slice()) {
                if (!c.isValid) continue;
                if (c.name.startsWith('matchOut') || c.name === 'fxBomb') {
                    c.destroy();
                }
            }
        };
        stripFx(this.boardRoot);
        stripFx(this.tableRoot);
        stripFx(this.node);

        if (this.boardRoot) {
            for (const c of this.boardRoot.children.slice()) {
                if (c.name === '__bg' || c.name === '__hud' || c.name === '__tilePool') continue;
                // 已回收進池的不要 destroy
                if (c.name.startsWith('tile') || c.name === 'tile_pooled') continue;
                if (c.isValid) c.destroy();
            }
        }
    }

    // ---------- 道具 ----------

    /** 撤回：退回最近一次進組牌區的牌 */
    useItemBack(): boolean {
        if (this._busy || this._ended) return false;
        while (this._pickHistory.length > 0) {
            const tile = this._pickHistory.shift()!;
            if (tile.removed || tile.place !== 'table' || !tile.node?.isValid) continue;
            const idx = this._table.indexOf(tile);
            if (idx < 0) continue;
            this._table.splice(idx, 1);
            tile.place = 'board';
            const root = this.boardRoot ?? this.node;
            tile.node.setParent(root, true);
            tween(tile.node)
                .to(
                    GameConfig.moveTime,
                    {
                        position: new Vec3(tile.boardX, tile.boardY, tile.floor * 0.1),
                        scale: new Vec3(1, 1, 1),
                    },
                    { easing: 'cubicOut' },
                )
                .call(() => {
                    this.sortBoardDrawOrder();
                    this.refreshCover(true);
                })
                .start();
            this.layoutTable();
            playSfx(AudioKey.UI_Drag_PutIn);
            return true;
        }
        EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('itemBackEmpty'));
        return false;
    }

    /** 消一組：補齊組牌區同花至 3，或場上直接消一組 */
    useItemMatch(): boolean {
        if (this._busy || this._ended) return false;
        this._busy = true;
        const prevLen = this.tableLength;
        this.tableLength += 2;

        let symbolId = -1;
        let need = 3;
        if (this._table.length > 0) {
            symbolId = this._table[0].symbolId;
            const have = this._table.filter((t) => t.symbolId === symbolId).length;
            need = Math.max(0, 3 - have);
        } else {
            const counts = new Map<number, number>();
            for (const t of this._tiles) {
                if (t.removed || t.place !== 'board' || t.symbolId < 0) continue;
                if (t.typeId === TILE_TYPE.ICE || t.typeId === TILE_TYPE.FIRE || t.typeId === TILE_TYPE.STONE) continue;
                counts.set(t.symbolId, (counts.get(t.symbolId) ?? 0) + 1);
            }
            let best = -1;
            let bestN = 0;
            for (const [id, n] of counts) {
                if (n >= 3 && n > bestN) {
                    best = id;
                    bestN = n;
                }
            }
            if (best < 0) {
                this.tableLength = prevLen;
                this._busy = false;
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('itemNoTarget'));
                return false;
            }
            symbolId = best;
            need = 3;
        }

        const cands = this._tiles
            .filter(
                (t) =>
                    !t.removed &&
                    t.place === 'board' &&
                    t.symbolId === symbolId &&
                    t.typeId !== TILE_TYPE.ICE &&
                    t.typeId !== TILE_TYPE.FIRE &&
                    t.typeId !== TILE_TYPE.STONE,
            )
            .sort((a, b) => b.floor - a.floor || (a.covered === b.covered ? 0 : a.covered ? 1 : -1));

        const take = cands.slice(0, need);
        if (take.length < need && this._table.filter((t) => t.symbolId === symbolId).length + take.length < 3) {
            this.tableLength = prevLen;
            this._busy = false;
            EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('itemNoTarget'));
            return false;
        }

        for (const t of take) {
            this.forceToTableInstant(t);
        }
        this.layoutTable();
        this.tryMatchAt(symbolId);
        this.tableLength = prevLen;
        this._busy = false;
        this.checkLoseOrWin();
        return true;
    }

    private forceToTableInstant(tile: TileSymbol): void {
        if (tile.typeId === TILE_TYPE.HIDE) {
            const hide = tile.node.getChildByName('hide');
            if (hide) hide.destroy();
            tile.typeId = TILE_TYPE.NORMAL;
        }
        tile.place = 'table';
        tile.setCovered(false, true);
        const insertAt = this.findInsertIndex(tile.symbolId);
        this._table.splice(insertAt, 0, tile);
        this._pickHistory.unshift(tile);
        const slot = this._slots[Math.min(insertAt, this._slots.length - 1)];
        if (slot) {
            tile.node.setParent(slot, false);
            tile.node.setPosition(0, 0, 0);
            tile.node.setScale(this.tableScale, this.tableScale, 1);
        }
    }

    /** 重整：打亂場上普通/蓋牌的位置 */
    useItemShuffle(): boolean {
        if (this._busy || this._ended) return false;
        const movable = this._tiles.filter(
            (t) =>
                !t.removed &&
                t.place === 'board' &&
                (t.typeId === TILE_TYPE.NORMAL || t.typeId === TILE_TYPE.HIDE),
        );
        if (movable.length < 2) {
            EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('itemNoTarget'));
            return false;
        }
        const slots = movable.map((t) => ({ x: t.boardX, y: t.boardY, floor: t.floor, z: t.floor * 0.1 }));
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        for (let i = 0; i < movable.length; i++) {
            const t = movable[i];
            const s = slots[i];
            t.boardX = s.x;
            t.boardY = s.y;
            t.floor = s.floor;
            tween(t.node)
                .to(0.35, { position: new Vec3(s.x, s.y, s.z) }, { easing: 'cubicOut' })
                .start();
        }
        this.scheduleOnce(() => {
            this.sortBoardDrawOrder();
            this.refreshCover(true);
        }, 0.36);
        playSfx(AudioKey.btnClick);
        return true;
    }

    /** 第 8 格 */
    useItemEight(): void {
        if (this._eightOpened) return;
        this._eightOpened = true;
        this.tableLength = 8;
        this.ensureTableSlots();
        playSfx(AudioKey.tip);
        EventBus.emit(GameEvents.SHOW_TIP, '+1 slot');
        EventBus.emit('item_changed');
    }

    onWin(): void {
        if (this._winShown) return;
        this._winShown = true;
        this._winQueued = false;
        this._winSafetyTimer = 0;
        playSfx(AudioKey.win);
        console.log('[MatchGame] WIN');
        EventBus.emit(GameEvents.GAME_WIN);
        // 直接開結算（防 EventBus／ResultPop 監聽漏接）
        GameApp.inst?.showResult('win');
    }

    onLose(): void {
        if (this._winShown) return;
        playSfx(AudioKey.lose);
        console.log('[MatchGame] LOSE');
        EventBus.emit(GameEvents.GAME_LOSE);
    }
}
