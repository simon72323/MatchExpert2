import { playSfx } from '../audio/AudioBootstrap';
import { AudioKey } from '../audio/AudioKey';
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
    resources,
    ImageAsset,
    Texture2D,
} from 'cc';
import { SaveData } from '../core/SaveData';
import { GameConfig } from '../core/GameConfig';
import { EventBus, GameEvents } from '../core/EventBus';
import { MatchGame } from '../game/MatchGame';
import { AdsService } from '../core/AdsService';
import { applySlicedSprite, applySliceInsets } from './UiSpriteUtil';

const { ccclass } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

/** 道具：0撤回 1消一組 2重整 3第8格 */
@ccclass('ItemBar')
export class ItemBar extends Component {
    private _btns: Node[] = [];
    private _countLabs: Label[] = [];
    private _cache = new Map<string, SpriteFrame>();
    private _built = false;

    onLoad(): void {
        this.build();
        this.preload();
        EventBus.on(GameEvents.COIN_CHANGED, this.refresh as (...a: unknown[]) => void);
        EventBus.on('enter_level', this.refresh as (...a: unknown[]) => void);
        EventBus.on('item_changed', this.refresh as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        EventBus.off(GameEvents.COIN_CHANGED, this.refresh as (...a: unknown[]) => void);
        EventBus.off('enter_level', this.refresh as (...a: unknown[]) => void);
        EventBus.off('item_changed', this.refresh as (...a: unknown[]) => void);
    }

    private async preload(): Promise<void> {
        const paths = [
            'ui/btn_item_back',
            'ui/btn_item_find',
            'ui/btn_item_random',
            'ui/btn_item_lock',
            'ui/btn_item_add',
            'ui/pic_num',
            'ui/pic_num_red',
        ];
        await Promise.all(paths.map((p) => this.loadSf(p)));
        this.refresh();
    }

    private build(): void {
        if (this._built) return;
        this._built = true;
        this.node.layer = UI_LAYER;
        this.node.addComponent(UITransform).setContentSize(720, 120);
        this.node.setPosition(0, -360, 0);

        const defs: { id: number; name: string; path: string }[] = [
            { id: 0, name: 'back', path: 'ui/btn_item_back' },
            { id: 1, name: 'find', path: 'ui/btn_item_find' },
            { id: 2, name: 'random', path: 'ui/btn_item_random' },
            { id: 3, name: 'eight', path: 'ui/btn_item_lock' },
        ];
        const gap = 150;
        const startX = -((defs.length - 1) * gap) / 2;
        for (let i = 0; i < defs.length; i++) {
            const d = defs[i];
            const btn = new Node(`item_${d.name}`);
            btn.layer = UI_LAYER;
            this.node.addChild(btn);
            btn.addComponent(UITransform).setContentSize(100, 100);
            btn.setPosition(startX + i * gap, 0, 0);

            // 底圖用獨立子節點，避免與 icon Sprite 衝突
            const bgN = new Node('__bg');
            bgN.layer = UI_LAYER;
            btn.addChild(bgN);
            bgN.addComponent(UITransform).setContentSize(96, 96);
            const g = bgN.addComponent(Graphics);
            g.fillColor = new Color(30, 40, 55, 160);
            g.roundRect(-48, -48, 96, 96, 16);
            g.fill();

            const icon = new Node('icon');
            icon.layer = UI_LAYER;
            btn.addChild(icon);
            icon.addComponent(UITransform).setContentSize(72, 72);
            const sp = icon.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            (btn as Node & { __sp?: Sprite; __path?: string }).__sp = sp;
            (btn as Node & { __sp?: Sprite; __path?: string }).__path = d.path;

            const badge = new Node('badge');
            badge.layer = UI_LAYER;
            btn.addChild(badge);
            badge.addComponent(UITransform).setContentSize(40, 28);
            badge.setPosition(32, 32, 0);
            const badgeBg = new Node('__badgeBg');
            badgeBg.layer = UI_LAYER;
            badge.addChild(badgeBg);
            badgeBg.addComponent(UITransform).setContentSize(40, 28);
            const badgeSp = badgeBg.addComponent(Sprite);
            badgeSp.sizeMode = Sprite.SizeMode.CUSTOM;
            (btn as Node & { __badgeSp?: Sprite }).__badgeSp = badgeSp;
            const labN = new Node('lab');
            labN.layer = UI_LAYER;
            badge.addChild(labN);
            labN.addComponent(UITransform).setContentSize(36, 24);
            const lab = labN.addComponent(Label);
            lab.fontSize = 18;
            lab.color = Color.WHITE;
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
            lab.verticalAlign = Label.VerticalAlign.CENTER;
            this._countLabs[d.id] = lab;

            // 數量為 0 時顯示 + 圖
            const addIcon = new Node('addIcon');
            addIcon.layer = UI_LAYER;
            btn.addChild(addIcon);
            addIcon.addComponent(UITransform).setContentSize(28, 28);
            addIcon.setPosition(0, -36, 0);
            const addSp = addIcon.addComponent(Sprite);
            addSp.sizeMode = Sprite.SizeMode.CUSTOM;
            (btn as Node & { __add?: Sprite; __addNode?: Node }).__add = addSp;
            (btn as Node & { __add?: Sprite; __addNode?: Node }).__addNode = addIcon;
            addIcon.active = false;

            const itemId = d.id;
            btn.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
                e.propagationStopped = true;
                this.onItem(itemId);
            });
            this._btns[d.id] = btn;
        }
    }

    refresh = (): void => {
        const addSf = this._cache.get('ui/btn_item_add');
        const numSf = this._cache.get('ui/pic_num_red') ?? this._cache.get('ui/pic_num');
        for (let i = 0; i < 4; i++) {
            const btn = this._btns[i];
            if (!btn) continue;
            const ext = btn as Node & {
                __sp?: Sprite;
                __path?: string;
                __add?: Sprite;
                __addNode?: Node;
                __badgeSp?: Sprite;
            };
            if (ext.__sp && ext.__path) {
                const sf = this._cache.get(ext.__path);
                if (sf) applySlicedSprite(ext.__sp, sf, ext.__path);
            }
            if (ext.__badgeSp && numSf) applySlicedSprite(ext.__badgeSp, numSf, 'ui/pic_num_red');
            const lab = this._countLabs[i];
            if (!lab) continue;
            let showAdd = false;
            if (i < 3) {
                const n = SaveData.inst.data.itemAmount[i] ?? 0;
                lab.string = n > 0 ? String(n) : '';
                lab.node.parent!.active = n > 0;
                showAdd = n <= 0;
            } else {
                const game = MatchGame.inst;
                const opened = !!game?.eightOpened;
                lab.string = opened ? 'OK' : '';
                lab.node.parent!.active = opened;
                showAdd = !opened;
            }
            if (ext.__addNode) {
                ext.__addNode.active = showAdd;
                if (showAdd && ext.__add && addSf) ext.__add.spriteFrame = addSf;
            }
        }
    };

    private onItem(id: number): void {
        playSfx(AudioKey.btnClick);
        const game = MatchGame.inst;
        if (!game || game.pause || game.isEnded) return;

        if (id === 3) {
            this.useEight(game);
            return;
        }

        const amount = SaveData.inst.data.itemAmount[id] ?? 0;
        if (amount <= 0) {
            const cost = GameConfig.itemBuyCoin[id] ?? 80;
            if (SaveData.inst.data.playerCoin >= cost) {
                SaveData.inst.savePlayerCoin(-cost);
                SaveData.inst.saveItemAmount(id, 1);
                EventBus.emit(GameEvents.COIN_CHANGED, SaveData.inst.data.playerCoin);
            } else {
                // 金幣不足 → 看廣告拿三種道具各 1
                void this.adsGetItems();
                return;
            }
        }

        let ok = false;
        if (id === 0) ok = game.useItemBack();
        else if (id === 1) ok = game.useItemMatch();
        else if (id === 2) ok = game.useItemShuffle();

        if (ok) {
            SaveData.inst.saveItemAmount(id, -1);
            EventBus.emit('item_changed');
            this.refresh();
        }
    }

    private async adsGetItems(): Promise<void> {
        const ok = await AdsService.inst.showRewarded('buyItem');
        if (ok) this.refresh();
    }

    private async useEight(game: MatchGame): Promise<void> {
        if (game.eightOpened || game.tableLength >= 8) {
            EventBus.emit(GameEvents.SHOW_TIP, 'already open');
            return;
        }
        const cost = GameConfig.itemBuyCoin[3] ?? 400;
        if (SaveData.inst.data.playerCoin >= cost) {
            SaveData.inst.savePlayerCoin(-cost);
            EventBus.emit(GameEvents.COIN_CHANGED, SaveData.inst.data.playerCoin);
            game.useItemEight();
            this.refresh();
            return;
        }
        // 金幣不足 → 廣告開第 8 格
        const ok = await AdsService.inst.showRewarded('openEight');
        if (ok) this.refresh();
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
                resources.load(path, ImageAsset, (e2, img) => {
                    if (e2 || !img) {
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
    }
}
