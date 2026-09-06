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
    BlockInputEvents,
    tween,
    Vec3,
    Sprite,
} from 'cc';
import { EventBus, GameEvents } from '../core/EventBus';
import { SaveData } from '../core/SaveData';
import { GameConfig, PLAY_MODE } from '../core/GameConfig';
import { GameApp } from '../core/GameApp';
import { MatchGame } from '../game/MatchGame';
import { AdsService } from '../core/AdsService';
import {
    addDim,
    addIcon,
    addLabel,
    addSpriteButton,
    addSpritePanel,
    getCachedUiSprite,
    markUiLayer,
    preloadUiSprites,
} from './UiFactory';

const { ccclass } = _decorator;

/** 進關確認：乾淨構圖，無星級 */
@ccclass('LevelPop')
export class LevelPop extends Component {
    private _root: Node | null = null;
    private _title: Label | null = null;
    private _sub: Label | null = null;
    private _eightLab: Label | null = null;
    private _badge: Sprite | null = null;
    private _level = 1;
    private _wantEight = false;

    onLoad(): void {
        void preloadUiSprites([
            'ui/bar_4',
            'ui/btn_color_0',
            'ui/btn_color_1',
            'ui/btn_color_2',
            'ui/btn_color_3',
            'ui/icon_play',
            'ui/pic_map_btn_0',
            'ui/pic_map_btn_1',
            'ui/pic_map_btn_2',
            'ui/pic_map_btn_3',
            'ui/pic_map_btn_4',
            'ui/pic_map_btn_5',
            'ui/pic_map_btn_6',
            'ui/pic_map_btn_7',
            'ui/pic_map_btn_8',
            'ui/pic_map_btn_9',
        ]).then(() => this.buildUi());
        this.node.active = false;
        EventBus.on(GameEvents.OPEN_LEVEL, this.onOpen as (...a: unknown[]) => void);
        EventBus.on(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        EventBus.off(GameEvents.OPEN_LEVEL, this.onOpen as (...a: unknown[]) => void);
        EventBus.off(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
    }

    private onOpen = (): void => {
        const progress = Math.max(1, Math.min(SaveData.inst.data.level, GameConfig.levelMax));
        this.open(progress);
    };

    open(level: number): void {
        if (!this._root) this.buildUi();
        this._level = Math.max(1, Math.min(SaveData.inst.data.level, GameConfig.levelMax));
        void level;
        this._wantEight = false;
        if (GameApp.inst) GameApp.inst.levelMode = PLAY_MODE;
        this.node.active = true;
        this.refresh();
        if (this._root) {
            this._root.setScale(0.88, 0.88, 1);
            tween(this._root).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    }

    hide = (): void => {
        this.node.active = false;
    };

    private refresh(): void {
        if (this._title) this._title.string = `${I18n.inst.t('level')} ${this._level}`;
        if (this._sub) this._sub.string = I18n.inst.t('startGame');
        if (this._eightLab) {
            this._eightLab.string = this._wantEight
                ? `+1 slot  (-${GameConfig.itemBuyCoin[3]})`
                : `+1 slot`;
        }
        if (this._badge) {
            const sf =
                getCachedUiSprite(`ui/pic_map_btn_${this._level % 10}`) ??
                getCachedUiSprite('ui/pic_map_btn_0');
            if (sf) this._badge.spriteFrame = sf;
        }
        const playLab = this._root?.getChildByName('panel')?.getChildByName('btnPlay')?.getChildByName('label')?.getComponent(Label);
        if (playLab) playLab.string = I18n.inst.t('startGame');
        const closeLab = this._root?.getChildByName('panel')?.getChildByName('btnClose')?.getChildByName('label')?.getComponent(Label);
        if (closeLab) closeLab.string = I18n.inst.t('close');
        const adsLab = this._root?.getChildByName('panel')?.getChildByName('btnAdsEight')?.getChildByName('label')?.getComponent(Label);
        if (adsLab) adsLab.string = I18n.inst.t('adsEight');
    }

    private buildUi(): void {
        if (this._root) return;
        markUiLayer(this.node);
        const root = new Node('LevelPopRoot');
        markUiLayer(root);
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(720, 1280);
        root.addComponent(BlockInputEvents);
        this._root = root;

        addDim(root, 150);
        const { node: panel } = addSpritePanel(root, 'panel', 'ui/bar_4', 540, 640, 0, 20);

        this._title = addLabel(panel, 'title', 0, 240, 36, '', new Color(45, 45, 45, 255), 440, 48);
        this._sub = addLabel(panel, 'sub', 0, 190, 20, '', new Color(110, 110, 110, 255), 400, 32);

        const badge = new Node('badge');
        markUiLayer(badge);
        panel.addChild(badge);
        badge.setPosition(0, 70, 0);
        badge.addComponent(UITransform).setContentSize(160, 160);
        this._badge = badge.addComponent(Sprite);
        this._badge.sizeMode = Sprite.SizeMode.CUSTOM;

        const eightBtn = addSpriteButton(panel, 'btnEight', 0, -50, 340, 64, 'ui/btn_color_3', '+1 slot', () => {
            playSfx(AudioKey.btnClick);
            this._wantEight = !this._wantEight;
            this.refresh();
        }, 22);
        this._eightLab = eightBtn.label;

        addSpriteButton(panel, 'btnAdsEight', 0, -125, 340, 64, 'ui/btn_color_1', I18n.inst.t('adsEight'), () => {
            void this.adsEight();
        }, 22);

        addSpriteButton(panel, 'btnPlay', 0, -210, 360, 80, 'ui/btn_color_0', I18n.inst.t('startGame'), () => this.play());
        addIcon(panel, 'playIco', 'ui/icon_play', 34, -130, -210);

        addSpriteButton(panel, 'btnClose', 0, -290, 280, 56, 'ui/btn_color_2', I18n.inst.t('close'), () => {
            playSfx(AudioKey.btnClose);
            this.hide();
        }, 22);
    }

    private async adsEight(): Promise<void> {
        playSfx(AudioKey.btnClick);
        const ok = await AdsService.inst.showRewarded('openEightLevel');
        if (ok) {
            MatchGame.pendingOpenEight = true;
            this._wantEight = false;
            this.hide();
            GameApp.inst?.enterLevel(this._level, PLAY_MODE);
        }
    }

    private play(): void {
        playSfx(AudioKey.btnClick);
        if (this._wantEight) {
            const cost = GameConfig.itemBuyCoin[3] ?? 400;
            if (SaveData.inst.data.playerCoin < cost) {
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('coinShort'));
                this._wantEight = false;
                this.refresh();
                return;
            }
            SaveData.inst.savePlayerCoin(-cost);
            EventBus.emit(GameEvents.COIN_CHANGED, SaveData.inst.data.playerCoin);
            MatchGame.pendingOpenEight = true;
        } else if (!MatchGame.pendingOpenEight) {
            MatchGame.pendingOpenEight = false;
        }
        this.hide();
        GameApp.inst?.enterLevel(this._level, PLAY_MODE);
    }
}
