import { playSfx, AudioBootstrap } from '../audio/AudioBootstrap';
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
    Layers,
    BlockInputEvents,
    tween,
    Vec3,
} from 'cc';
import { GameApp } from '../core/GameApp';
import { EventBus, GameEvents } from '../core/EventBus';
import { SaveData } from '../core/SaveData';
import { MatchGame } from '../game/MatchGame';
import { PLAY_MODE } from '../core/GameConfig';
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
const UI_LAYER = Layers.Enum.UI_2D;

@ccclass('PausePop')
export class PausePop extends Component {
    private static _inst: PausePop | null = null;
    static get inst(): PausePop | null {
        return this._inst;
    }

    private _root: Node | null = null;
    private _panel: Node | null = null;
    private _soundIcon: Sprite | null = null;
    private _musicIcon: Sprite | null = null;

    onLoad(): void {
        PausePop._inst = this;
        void preloadUiSprites([
            'ui/bar_4',
            'ui/btn_color_0',
            'ui/btn_color_1',
            'ui/btn_color_2',
            'ui/btn_color_3',
            'ui/icon_sound_on',
            'ui/icon_sound_off',
            'ui/icon_music_on',
            'ui/icon_music_off',
            'ui/icon_home',
            'ui/icon_replay',
            'ui/icon_help',
            'ui/icon_play',
        ]).then(() => this.buildUi());
        this.node.active = false;
        EventBus.on(GameEvents.OPEN_PAUSE, this.show as (...a: unknown[]) => void);
        EventBus.on(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        if (PausePop._inst === this) PausePop._inst = null;
        EventBus.off(GameEvents.OPEN_PAUSE, this.show as (...a: unknown[]) => void);
        EventBus.off(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
    }

    show = (): void => {
        if (!this._root) this.buildUi();
        if (MatchGame.inst) MatchGame.inst.pause = true;
        this.node.active = true;
        this.refreshToggles();
        this.refreshLangLabels();
        if (this._root) {
            this._root.setScale(0.85, 0.85, 1);
            tween(this._root).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    };

    hide = (): void => {
        this.node.active = false;
    };

    private refreshToggles(): void {
        const s = SaveData.inst.data;
        const soundPath = s.sound ? 'ui/pic_toggle_set_on' : 'ui/pic_toggle_set_off';
        const musicPath = s.music ? 'ui/pic_toggle_set_on' : 'ui/pic_toggle_set_off';
        void preloadUiSprites([
            soundPath,
            musicPath,
            'ui/icon_sound_on',
            'ui/icon_sound_off',
            'ui/icon_music_on',
            'ui/icon_music_off',
        ]).then(() => {
            if (this._soundIcon) this._soundIcon.spriteFrame = getCachedUiSprite(soundPath);
            if (this._musicIcon) this._musicIcon.spriteFrame = getCachedUiSprite(musicPath);
            const sIco = this._panel?.getChildByName('soundIco')?.getComponent(Sprite);
            const mIco = this._panel?.getChildByName('musicIco')?.getComponent(Sprite);
            if (sIco) sIco.spriteFrame = getCachedUiSprite(s.sound ? 'ui/icon_sound_on' : 'ui/icon_sound_off');
            if (mIco) mIco.spriteFrame = getCachedUiSprite(s.music ? 'ui/icon_music_on' : 'ui/icon_music_off');
        });
    }

    private buildUi(): void {
        if (this._root) return;
        this.node.layer = UI_LAYER;
        const root = new Node('PauseRoot');
        markUiLayer(root);
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(720, 1280);
        root.addComponent(BlockInputEvents);
        this._root = root;

        addDim(root, 160);
        const { node: panel } = addSpritePanel(root, 'panel', 'ui/bar_4', 520, 780, 0, 0);
        this._panel = panel;

        addLabel(panel, 'title', 0, 380, 40, I18n.inst.t('pause'), new Color(40, 40, 40, 255));

        addSpriteButton(panel, 'btnContinue', 0, 280, 340, 76, 'ui/btn_color_0', I18n.inst.t('continue'), () => {
            playSfx(AudioKey.btnClick);
            if (MatchGame.inst && !MatchGame.inst.isEnded) MatchGame.inst.pause = false;
            this.hide();
        });
        addSpriteButton(panel, 'btnReplay', 0, 180, 340, 76, 'ui/btn_color_1', I18n.inst.t('replay'), () => {
            playSfx(AudioKey.btnClick);
            this.hide();
            const app = GameApp.inst;
            if (app) app.enterLevel(app.playingLevel, PLAY_MODE);
        });
        addSpriteButton(panel, 'btnShop', 0, 80, 340, 76, 'ui/btn_color_2', I18n.inst.t('shop'), () => {
            playSfx(AudioKey.btnClick);
            this.hide();
            EventBus.emit(GameEvents.OPEN_SHOP, 'pause');
        });
        addSpriteButton(panel, 'btnHelp', 0, -20, 340, 76, 'ui/btn_color_1', I18n.inst.t('gameHelp'), () => {
            playSfx(AudioKey.btnClick);
            this.hide();
            EventBus.emit(GameEvents.OPEN_HELP);
        });
        addSpriteButton(panel, 'btnMap', 0, -120, 340, 76, 'ui/btn_color_2', I18n.inst.t('backToMap'), () => {
            playSfx(AudioKey.btnClick);
            this.hide();
            GameApp.inst?.backToMap();
        });

        // 音效／音樂：toggle 底圖 + 小 icon
        const soundBtn = new Node('btnSound');
        markUiLayer(soundBtn);
        panel.addChild(soundBtn);
        soundBtn.addComponent(UITransform).setContentSize(100, 56);
        soundBtn.setPosition(-110, -240, 0);
        this._soundIcon = soundBtn.addComponent(Sprite);
        this._soundIcon.sizeMode = Sprite.SizeMode.CUSTOM;
        soundBtn.on(Node.EventType.TOUCH_END, () => {
            playSfx(AudioKey.btnClick);
            SaveData.inst.saveSound(!SaveData.inst.data.sound);
            EventBus.emit(GameEvents.SOUND_CHANGED);
            this.refreshToggles();
        });
        addIcon(panel, 'soundIco', 'ui/icon_sound_on', 36, -110, -240);

        const musicBtn = new Node('btnMusic');
        markUiLayer(musicBtn);
        panel.addChild(musicBtn);
        musicBtn.addComponent(UITransform).setContentSize(100, 56);
        musicBtn.setPosition(110, -240, 0);
        this._musicIcon = musicBtn.addComponent(Sprite);
        this._musicIcon.sizeMode = Sprite.SizeMode.CUSTOM;
        musicBtn.on(Node.EventType.TOUCH_END, () => {
            playSfx(AudioKey.btnClick);
            SaveData.inst.saveMusic(!SaveData.inst.data.music);
            AudioBootstrap.refreshMuteFromSave();
            EventBus.emit(GameEvents.MUSIC_CHANGED);
            this.refreshToggles();
        });
        addIcon(panel, 'musicIco', 'ui/icon_music_on', 36, 110, -240);

        addSpriteButton(panel, 'btnLang', 0, -320, 280, 64, 'ui/btn_color_3', I18n.inst.t('language'), () => {
            playSfx(AudioKey.btnClick);
            const order = ['tw', 'cn', 'en'];
            const cur = I18n.inst.lang;
            const next = order[(order.indexOf(cur) + 1 + order.length) % order.length] || 'tw';
            I18n.inst.setLang(next);
            this.refreshLangLabels();
            EventBus.emit(GameEvents.SHOW_TIP, `${I18n.inst.t('language')}: ${next}`);
        }, 24);
        addIcon(panel, 'langIco', 'ui/icon_language', 32, -120, -320);

        // 裝飾小圖
        addIcon(panel, 'icoPlay', 'ui/icon_play', 28, -150, 280);
        addIcon(panel, 'icoReplay', 'ui/icon_replay', 28, -150, 180);
        addIcon(panel, 'icoHelp', 'ui/icon_help', 28, -150, -20);
        addIcon(panel, 'icoHome', 'ui/icon_home', 28, -150, -120);

        this.refreshToggles();
    }

    private refreshLangLabels(): void {
        const panel = this._panel;
        if (!panel) return;
        const title = panel.getChildByName('title')?.getComponent(Label);
        if (title) title.string = I18n.inst.t('pause');
        const map: Record<string, string> = {
            btnContinue: I18n.inst.t('continue'),
            btnReplay: I18n.inst.t('replay'),
            btnShop: I18n.inst.t('shop'),
            btnHelp: I18n.inst.t('gameHelp'),
            btnMap: I18n.inst.t('backToMap'),
            btnLang: I18n.inst.t('language'),
        };
        for (const name in map) {
            const lab = panel.getChildByName(name)?.getChildByName('label')?.getComponent(Label);
            if (lab) lab.string = map[name];
        }
    }
}
