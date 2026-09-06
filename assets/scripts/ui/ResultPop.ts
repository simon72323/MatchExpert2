import { playSfx } from '../audio/AudioBootstrap';
import { AudioKey } from '../audio/AudioKey';
import { I18n } from '../core/I18n';
import {
    _decorator,
    Component,
    Node,
    UITransform,
    Label,
    Color,
    Sprite,
    SpriteFrame,
    Graphics,
    Layers,
    EventTouch,
    tween,
    Vec3,
    resources,
    ImageAsset,
    Texture2D,
    BlockInputEvents,
} from 'cc';
import { GameApp } from '../core/GameApp';
import { EventBus, GameEvents } from '../core/EventBus';
import { SaveData } from '../core/SaveData';
import { GameConfig, PLAY_MODE } from '../core/GameConfig';
import { AdsService } from '../core/AdsService';
import { applySlicedSprite, applySliceInsets } from './UiSpriteUtil';

const { ccclass } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

type ResultKind = 'win' | 'lose';

/**
 * 簡易勝負彈窗（程式動態建立，對齊 Win/Lose 基本流程）
 */
@ccclass('ResultPop')
export class ResultPop extends Component {
    private static _inst: ResultPop | null = null;
    static get inst(): ResultPop | null {
        return this._inst;
    }

    private _root: Node | null = null;
    private _title: Label | null = null;
    private _info: Label | null = null;
    private _banner: Sprite | null = null;
    private _cache = new Map<string, SpriteFrame>();
    private _kind: ResultKind = 'win';

    private _resultShown = false;

    onLoad(): void {
        ResultPop._inst = this;
        // 先掛事件，避免 buildUi 中途失敗導致永遠聽不到 GAME_WIN
        EventBus.on(GameEvents.GAME_WIN, this.onWin as (...a: unknown[]) => void);
        EventBus.on(GameEvents.GAME_LOSE, this.onLose as (...a: unknown[]) => void);
        try {
            this.buildUi();
        } catch (e) {
            console.error('[ResultPop] buildUi failed', e);
        }
        this.node.active = false;
        this.preload();
    }

    onDestroy(): void {
        if (ResultPop._inst === this) ResultPop._inst = null;
        EventBus.off(GameEvents.GAME_WIN, this.onWin as (...a: unknown[]) => void);
        EventBus.off(GameEvents.GAME_LOSE, this.onLose as (...a: unknown[]) => void);
    }

    private onWin = (): void => {
        this.show('win');
    };

    private onLose = (): void => {
        this.show('lose');
    };

    private async preload(): Promise<void> {
        const paths = [
            'ui/result_win_en',
            'ui/result_lose_en',
            'ui/win_great_twcn',
            'ui/btn_next',
            'ui/btn_color_0',
            'ui/btn_color_1',
            'ui/btn_color_2',
            'ui/bar_4',
        ];
        await Promise.all(paths.map((p) => this.loadSf(p)));
    }

    private buildUi(): void {
        this.node.layer = UI_LAYER;
        const root = new Node('ResultRoot');
        root.layer = UI_LAYER;
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(720, 1280);
        root.addComponent(BlockInputEvents);
        this._root = root;

        // dim
        const dim = new Node('dim');
        dim.layer = UI_LAYER;
        root.addChild(dim);
        dim.addComponent(UITransform).setContentSize(720, 1280);
        const g = dim.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 160);
        g.rect(-360, -640, 720, 1280);
        g.fill();

        // panel（套 bar_4 圖，勿與 Graphics 同節點）
        const panel = new Node('panel');
        panel.layer = UI_LAYER;
        root.addChild(panel);
        panel.addComponent(UITransform).setContentSize(560, 780);
        panel.setPosition(0, 40, 0);
        const panelSp = panel.addComponent(Sprite);
        panelSp.sizeMode = Sprite.SizeMode.CUSTOM;
        const applyPanel = (sf: SpriteFrame | null) => {
            if (sf) applySlicedSprite(panelSp, sf, 'ui/bar_4');
        };
        applyPanel(this._cache.get('ui/bar_4') ?? null);
        void this.loadSf('ui/bar_4').then(applyPanel);

        const banner = new Node('banner');
        banner.layer = UI_LAYER;
        panel.addChild(banner);
        banner.addComponent(UITransform).setContentSize(420, 160);
        banner.setPosition(0, 260, 0);
        this._banner = banner.addComponent(Sprite);
        this._banner.sizeMode = Sprite.SizeMode.CUSTOM;

        const title = new Node('title');
        title.layer = UI_LAYER;
        panel.addChild(title);
        title.addComponent(UITransform).setContentSize(480, 60);
        title.setPosition(0, 120, 0);
        this._title = title.addComponent(Label);
        this._title.fontSize = 40;
        this._title.color = new Color(40, 40, 40, 255);
        this._title.horizontalAlign = Label.HorizontalAlign.CENTER;

        const info = new Node('info');
        info.layer = UI_LAYER;
        panel.addChild(info);
        info.addComponent(UITransform).setContentSize(480, 70);
        info.setPosition(0, 40, 0);
        this._info = info.addComponent(Label);
        this._info.fontSize = 26;
        this._info.color = new Color(80, 80, 80, 255);
        this._info.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._info.overflow = Label.Overflow.RESIZE_HEIGHT;

        // buttons
        this.makeBtn(panel, 'btnPrimary', 0, -80, () => this.onPrimary());
        this.makeBtn(panel, 'btnSecondary', 0, -190, () => this.onSecondary());
        this.makeBtn(panel, 'btnTertiary', 0, -300, () => this.onTertiary());
    }

    private makeBtn(parent: Node, name: string, x: number, y: number, cb: () => void): void {
        const btn = new Node(name);
        btn.layer = UI_LAYER;
        parent.addChild(btn);
        btn.addComponent(UITransform).setContentSize(360, 84);
        btn.setPosition(x, y, 0);

        // Graphics 必須獨立子節點：不可與 Sprite 同掛一節點（會衝突導致 GameApp onLoad 中斷）
        const fallback = new Node('__fallback');
        fallback.layer = UI_LAYER;
        btn.addChild(fallback);
        fallback.addComponent(UITransform).setContentSize(360, 84);
        const g = fallback.addComponent(Graphics);
        g.fillColor = new Color(70, 130, 200, 230);
        g.roundRect(-180, -42, 360, 84, 16);
        g.fill();

        const sp = btn.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.type = Sprite.Type.SLICED;

        const labelN = new Node('label');
        labelN.layer = UI_LAYER;
        btn.addChild(labelN);
        labelN.addComponent(UITransform).setContentSize(340, 70);
        const lab = labelN.addComponent(Label);
        lab.fontSize = 30;
        lab.color = Color.WHITE;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        (btn as Node & { __label?: Label; __sprite?: Sprite; __fallback?: Node }).__label = lab;
        (btn as Node & { __label?: Label; __sprite?: Sprite; __fallback?: Node }).__sprite = sp;
        (btn as Node & { __label?: Label; __sprite?: Sprite; __fallback?: Node }).__fallback = fallback;

        btn.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            e.propagationStopped = true;
            try {
                playSfx(AudioKey.btnClick);
            } catch {
                /* ignore */
            }
            cb();
        });
    }

    private setBtn(name: string, text: string, frame: SpriteFrame | null, visible: boolean, path?: string): void {
        const btn = this._root?.getChildByName('panel')?.getChildByName(name);
        if (!btn) return;
        btn.active = visible;
        const ext = btn as Node & { __label?: Label; __sprite?: Sprite; __fallback?: Node };
        if (ext.__label) ext.__label.string = text;
        if (ext.__sprite) {
            if (frame) {
                applySlicedSprite(ext.__sprite, frame, path);
                ext.__sprite.enabled = true;
                if (ext.__fallback) ext.__fallback.active = false;
            } else {
                ext.__sprite.enabled = false;
                if (ext.__fallback) ext.__fallback.active = true;
            }
        }
    }

    show(kind: ResultKind, _stars = 0): void {
        // GameApp 與 ResultPop 都可能觸發，避免重複套用存檔
        if (this._resultShown && this.node.active && this._kind === kind) {
            console.log('[ResultPop] show ignored duplicate', kind);
            return;
        }
        if (!this._root) {
            try {
                this.buildUi();
            } catch (e) {
                console.error('[ResultPop] rebuild failed', e);
            }
        }
        this._resultShown = true;
        this._kind = kind;
        this.node.active = true;
        // 確保蓋在遊戲／組牌動畫之上
        if (this.node.parent) {
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }
        console.log('[ResultPop] show', kind);
        if (this._root) {
            this._root.setScale(0.8, 0.8, 1);
            tween(this._root).to(0.35, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }

        const app = GameApp.inst;
        const level = app?.playingLevel ?? 1;

        if (kind === 'win') {
            if (this._banner) this._banner.spriteFrame = this._cache.get('ui/result_win_en') ?? this._cache.get('ui/win_great_twcn') ?? null;
            if (this._title) this._title.string = I18n.inst.t('completeLevel');
            if (this._info) {
                this._info.string = `${I18n.inst.t('level')} ${level}`;
            }
            this.setBtn('btnPrimary', I18n.inst.t('nextLevel'), this._cache.get('ui/btn_next') ?? this._cache.get('ui/btn_color_0') ?? null, true, this._cache.has('ui/btn_next') ? 'ui/btn_next' : 'ui/btn_color_0');
            const coinAd = !SaveData.inst.data.adsClose;
            this.setBtn(
                'btnSecondary',
                I18n.inst.t('winCoinAd'),
                this._cache.get('ui/btn_color_1') ?? null,
                coinAd,
                'ui/btn_color_1',
            );
            this.setBtn('btnTertiary', I18n.inst.t('backToMap'), this._cache.get('ui/btn_color_2') ?? null, true, 'ui/btn_color_2');
            this.applyWinSave(level);
            // 過關插頁：不阻塞結算 UI
            void AdsService.inst.maybeShowInterstitialOnWin();
        } else {
            if (this._banner) this._banner.spriteFrame = this._cache.get('ui/result_lose_en') ?? null;
            if (this._title) this._title.string = I18n.inst.t('failed');
            if (this._info) this._info.string = `${I18n.inst.t('level')} ${level}`;
            this.setBtn('btnPrimary', I18n.inst.t('replay'), this._cache.get('ui/btn_color_0') ?? null, true, 'ui/btn_color_0');
            this.setBtn(
                'btnSecondary',
                `${I18n.inst.t('revival')} / AD`,
                this._cache.get('ui/btn_color_1') ?? null,
                true,
                'ui/btn_color_1',
            );
            this.setBtn('btnTertiary', I18n.inst.t('backToMap'), this._cache.get('ui/btn_color_2') ?? null, true, 'ui/btn_color_2');
        }
    }

    hide(): void {
        this.node.active = false;
        this._resultShown = false;
    }

    /** 過關：推進進度、固定金幣；不計算／不存星星；舊關不可回打 */
    private applyWinSave(level: number): void {
        const save = SaveData.inst;
        if (save.data.level <= level) {
            save.data.level = level + 1;
            save.save();
        }
        const reward = 30;
        save.savePlayerCoin(reward);
        EventBus.emit(GameEvents.COIN_CHANGED, save.data.playerCoin);
        EventBus.emit(GameEvents.LEVEL_CHANGED, save.data.level);
    }

    private onPrimary(): void {
        this.hide();
        const app = GameApp.inst;
        if (!app) {
            console.warn('[ResultPop] onPrimary: no GameApp');
            return;
        }
        if (this._kind === 'win') {
            const next = SaveData.inst.data.level;
            if (next > GameConfig.levelMax) {
                app.backToMap();
                return;
            }
            console.log('[ResultPop] next level', app.playingLevel, '→', next);
            app.enterLevel(next, PLAY_MODE);
        } else {
            console.log('[ResultPop] replay level', app.playingLevel);
            app.enterLevel(app.playingLevel, PLAY_MODE);
        }
    }

    private async onSecondary(): Promise<void> {
        const app = GameApp.inst;
        if (!app) return;
        if (this._kind === 'win') {
            // 過關後不可回打本關；僅獎勵廣告（若未去廣告）
            if (!SaveData.inst.data.adsClose) {
                await AdsService.inst.showRewarded('winCoin');
            }
            return;
        }
        // 失敗復活：有金幣扣幣，否則看廣告
        if (SaveData.inst.data.playerCoin >= GameConfig.revivalCoin) {
            this.hide();
            SaveData.inst.savePlayerCoin(-GameConfig.revivalCoin);
            EventBus.emit(GameEvents.COIN_CHANGED, SaveData.inst.data.playerCoin);
            EventBus.emit(GameEvents.GAME_REVIVAL);
        } else {
            const ok = await AdsService.inst.showRewarded('loseRevival');
            if (ok) this.hide();
        }
    }

    private onTertiary(): void {
        this.hide();
        GameApp.inst?.backToMap();
    }

    private loadSf(path: string): Promise<SpriteFrame | null> {
        if (this._cache.has(path)) return Promise.resolve(this._cache.get(path)!);
        return new Promise((resolve) => {
            const store = (sf: SpriteFrame | null) => {
                if (sf) {
                    applySliceInsets(sf, path);
                    this._cache.set(path, sf);
                }
                resolve(sf);
            };
            resources.load(`${path}/spriteFrame`, SpriteFrame, (err, sf) => {
                if (!err && sf) {
                    store(sf);
                    return;
                }
                resources.load(path, SpriteFrame, (e2, sf2) => {
                    if (!e2 && sf2) {
                        store(sf2);
                        return;
                    }
                    resources.load(path, ImageAsset, (e3, img) => {
                        if (e3 || !img) {
                            resolve(null);
                            return;
                        }
                        const tex = new Texture2D();
                        tex.image = img;
                        const frame = new SpriteFrame();
                        frame.texture = tex;
                        store(frame);
                    });
                });
            });
        });
    }
}
