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
    BlockInputEvents,
    Graphics,
    tween,
    Tween,
    Vec3,
} from 'cc';
import { GameApp } from '../core/GameApp';
import { SaveData } from '../core/SaveData';
import { GameConfig, PLAY_MODE } from '../core/GameConfig';
import { EventBus, GameEvents } from '../core/EventBus';
import { SkinCatalog } from '../data/SkinCatalog';
import { LevelRepository } from '../data/LevelRepository';
import {
    addIcon,
    addLabel,
    addSpriteButton,
    getCachedUiSprite,
    markUiLayer,
    preloadUiSprites,
} from './UiFactory';
import { applySlicedSprite } from './UiSpriteUtil';

const { ccclass } = _decorator;

/**
 * 主選單／下一關介面
 * 單一構圖：品牌 → 關卡數字 → 大徽章 → PLAY；頂部極簡金幣／商店
 */
@ccclass('LevelMapView')
export class LevelMapView extends Component {
    private _coin: Label | null = null;
    private _levelNum: Label | null = null;
    private _levelCaption: Label | null = null;
    private _playLab: Label | null = null;
    private _progressLab: Label | null = null;
    private _progressFill: UITransform | null = null;
    private _badgeSp: Sprite | null = null;
    private _badgeNode: Node | null = null;
    private _playNode: Node | null = null;
    private _built = false;

    onEnable(): void {
        this.ensureUi();
        if (GameApp.inst) GameApp.inst.levelMode = PLAY_MODE;
        void preloadUiSprites([
            'ui/logo_1',
            'ui/icon_coin',
            'ui/btn_color_0',
            'ui/btn_color_3',
            'ui/bar_6',
            'ui/bar_7',
            'ui/bar_9',
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
            'ui/pic_levelBg_1',
        ]).then(() => {
            this.applySprites();
            this.refresh();
        });
        this.refresh();
        this.startIdleMotion();
        EventBus.on(GameEvents.COIN_CHANGED, this.refresh as (...a: unknown[]) => void);
        EventBus.on(GameEvents.LEVEL_CHANGED, this.refresh as (...a: unknown[]) => void);
        EventBus.on(GameEvents.LANG_CHANGED, this.refresh as (...a: unknown[]) => void);
    }

    onDisable(): void {
        EventBus.off(GameEvents.COIN_CHANGED, this.refresh as (...a: unknown[]) => void);
        EventBus.off(GameEvents.LEVEL_CHANGED, this.refresh as (...a: unknown[]) => void);
        EventBus.off(GameEvents.LANG_CHANGED, this.refresh as (...a: unknown[]) => void);
        if (this._badgeNode?.isValid) Tween.stopAllByTarget(this._badgeNode);
        if (this._playNode?.isValid) Tween.stopAllByTarget(this._playNode);
    }

    private nextLevelId(): number {
        const levelMax = Math.min(GameConfig.levelMax, LevelRepository.inst.easyCount || GameConfig.levelMax);
        return Math.max(1, Math.min(SaveData.inst.data.level, levelMax));
    }

    private isAllClear(): boolean {
        const levelMax = Math.min(GameConfig.levelMax, LevelRepository.inst.easyCount || GameConfig.levelMax);
        return SaveData.inst.data.level > levelMax;
    }

    private clearLegacy(): void {
        for (const name of [
            'header',
            'nextCard',
            'levelScroll',
            'footer',
            'grid',
            'topBar',
            'modeRow',
            'title',
            'hero',
            'topBarLite',
            'veil',
        ]) {
            this.node.getChildByName(name)?.destroy();
        }
    }

    private ensureUi(): void {
        if (this._built && this.node.getChildByName('hero')) return;
        this.clearLegacy();
        this._built = true;
        markUiLayer(this.node);
        if (!this.node.getComponent(BlockInputEvents)) this.node.addComponent(BlockInputEvents);

        // 背景
        let bg = this.node.getChildByName('__mapBg');
        if (!bg) {
            bg = new Node('__mapBg');
            markUiLayer(bg);
            this.node.insertChild(bg, 0);
            bg.addComponent(UITransform).setContentSize(720, 1280);
            bg.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
        }
        this.applyBg(bg);

        // 輕柔上下遮罩，讓中心構圖更聚焦（獨立 Graphics 節點）
        const veil = new Node('veil');
        markUiLayer(veil);
        this.node.addChild(veil);
        veil.addComponent(UITransform).setContentSize(720, 1280);
        const vg = veil.addComponent(Graphics);
        vg.fillColor = new Color(18, 36, 48, 70);
        vg.rect(-360, 420, 720, 220);
        vg.fill();
        vg.fillColor = new Color(18, 36, 48, 90);
        vg.rect(-360, -640, 720, 200);
        vg.fill();

        // —— 頂列：金幣／商店（不搶主視覺）——
        const top = new Node('topBarLite');
        markUiLayer(top);
        this.node.addChild(top);
        top.setPosition(0, 560, 0);
        top.addComponent(UITransform).setContentSize(680, 72);

        const coinChip = new Node('coinChip');
        markUiLayer(coinChip);
        top.addChild(coinChip);
        coinChip.setPosition(-240, 0, 0);
        coinChip.addComponent(UITransform).setContentSize(168, 48);
        const coinSp = coinChip.addComponent(Sprite);
        coinSp.sizeMode = Sprite.SizeMode.CUSTOM;
        coinSp.color = new Color(255, 255, 255, 230);
        addIcon(coinChip, 'coinIcon', 'ui/icon_coin', 32, -52, 0);
        this._coin = addLabel(coinChip, 'coin', 18, 0, 24, '0', new Color(255, 236, 150, 255), 100, 36);
        this._coin.horizontalAlign = Label.HorizontalAlign.LEFT;

        addSpriteButton(top, 'shopBtn', 250, 0, 120, 48, 'ui/btn_color_3', I18n.inst.t('shop'), () => {
            playSfx(AudioKey.btnClick);
            EventBus.emit(GameEvents.OPEN_SHOP, 'map');
        }, 22);

        // —— 英雄構圖 ——
        const hero = new Node('hero');
        markUiLayer(hero);
        this.node.addChild(hero);
        hero.setPosition(0, 30, 0);
        hero.addComponent(UITransform).setContentSize(640, 900);

        // Logo
        const logo = new Node('logo');
        markUiLayer(logo);
        hero.addChild(logo);
        logo.setPosition(0, 340, 0);
        logo.addComponent(UITransform).setContentSize(420, 140);
        const logoSp = logo.addComponent(Sprite);
        logoSp.sizeMode = Sprite.SizeMode.CUSTOM;

        // 進度條（細長）
        const progBg = new Node('progBg');
        markUiLayer(progBg);
        hero.addChild(progBg);
        progBg.setPosition(0, 250, 0);
        progBg.addComponent(UITransform).setContentSize(360, 14);
        const progBgSp = progBg.addComponent(Sprite);
        progBgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        progBgSp.color = new Color(255, 255, 255, 120);

        const progFill = new Node('progFill');
        markUiLayer(progFill);
        progBg.addChild(progFill);
        const fillUt = progFill.addComponent(UITransform);
        fillUt.setAnchorPoint(0, 0.5);
        fillUt.setContentSize(10, 14);
        progFill.setPosition(-180, 0, 0);
        const fillSp = progFill.addComponent(Sprite);
        fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
        fillSp.color = new Color(255, 210, 90, 255);
        this._progressFill = fillUt;

        this._progressLab = addLabel(hero, 'progLab', 0, 222, 18, '', new Color(255, 255, 255, 210), 360, 28);

        // 關卡標題＋大數字
        this._levelCaption = addLabel(hero, 'caption', 0, 160, 26, '', new Color(255, 255, 255, 230), 400, 36);
        this._levelNum = addLabel(hero, 'levelNum', 0, 70, 96, '1', Color.WHITE, 480, 110);

        // 徽章底座光暈（Graphics）
        const glow = new Node('glow');
        markUiLayer(glow);
        hero.addChild(glow);
        glow.setPosition(0, -70, 0);
        glow.addComponent(UITransform).setContentSize(280, 280);
        const gg = glow.addComponent(Graphics);
        gg.fillColor = new Color(255, 230, 140, 40);
        gg.circle(0, 0, 120);
        gg.fill();
        gg.fillColor = new Color(255, 255, 255, 28);
        gg.circle(0, 0, 88);
        gg.fill();

        // 關卡徽章
        const badge = new Node('badge');
        markUiLayer(badge);
        hero.addChild(badge);
        badge.setPosition(0, -70, 0);
        badge.addComponent(UITransform).setContentSize(200, 200);
        this._badgeSp = badge.addComponent(Sprite);
        this._badgeSp.sizeMode = Sprite.SizeMode.CUSTOM;
        this._badgeNode = badge;

        // PLAY
        const playRefs = addSpriteButton(hero, 'playBtn', 0, -320, 400, 96, 'ui/btn_color_0', '', () => {
            playSfx(AudioKey.btnClick);
            if (this.isAllClear()) {
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('completeLevel'));
                return;
            }
            EventBus.emit(GameEvents.OPEN_LEVEL, this.nextLevelId(), PLAY_MODE);
        }, 34);
        this._playNode = playRefs.node;
        this._playLab = playRefs.label;
        addIcon(hero, 'playIco', 'ui/icon_play', 40, -140, -320);

        this.applySprites();
    }

    private applyBg(bg: Node): void {
        const sp = bg.getComponent(Sprite);
        if (!sp) return;
        const frame = SkinCatalog.inst.getBg();
        if (!frame) return;
        sp.spriteFrame = frame;
        const rw = frame.rect.width || 1024;
        const rh = frame.rect.height || 2048;
        const scale = Math.max(720 / rw, 1280 / rh);
        bg.getComponent(UITransform)!.setContentSize(rw * scale, rh * scale);
    }

    private applySprites(): void {
        const logo = this.node.getChildByName('hero')?.getChildByName('logo')?.getComponent(Sprite);
        const logoSf = getCachedUiSprite('ui/logo_1');
        if (logo && logoSf) logo.spriteFrame = logoSf;

        const coinChip = this.node.getChildByName('topBarLite')?.getChildByName('coinChip')?.getComponent(Sprite);
        const bar6 = getCachedUiSprite('ui/bar_6');
        if (coinChip && bar6) applySlicedSprite(coinChip, bar6, 'ui/bar_6');

        const progBg = this.node.getChildByName('hero')?.getChildByName('progBg')?.getComponent(Sprite);
        const bar9 = getCachedUiSprite('ui/bar_9') ?? getCachedUiSprite('ui/bar_6');
        if (progBg && bar9) applySlicedSprite(progBg, bar9, 'ui/bar_9');

        const fill = this.node.getChildByName('hero')?.getChildByName('progBg')?.getChildByName('progFill')?.getComponent(Sprite);
        const bar7 = getCachedUiSprite('ui/bar_7');
        if (fill && bar7) applySlicedSprite(fill, bar7, 'ui/bar_7');
    }

    private startIdleMotion(): void {
        if (this._badgeNode?.isValid) {
            Tween.stopAllByTarget(this._badgeNode);
            this._badgeNode.setScale(1, 1, 1);
            tween(this._badgeNode)
                .repeatForever(
                    tween(this._badgeNode)
                        .to(1.1, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
                        .to(1.1, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }),
                )
                .start();
        }
        if (this._playNode?.isValid) {
            Tween.stopAllByTarget(this._playNode);
            this._playNode.setScale(1, 1, 1);
            tween(this._playNode)
                .repeatForever(
                    tween(this._playNode)
                        .to(0.9, { scale: new Vec3(1.04, 1.04, 1) }, { easing: 'sineInOut' })
                        .to(0.9, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }),
                )
                .start();
        }
    }

    refresh = (): void => {
        this.ensureUi();
        if (GameApp.inst) GameApp.inst.levelMode = PLAY_MODE;
        this.applySprites();

        if (this._coin) this._coin.string = String(SaveData.inst.data.playerCoin);
        const shopLab = this.node
            .getChildByName('topBarLite')
            ?.getChildByName('shopBtn')
            ?.getChildByName('label')
            ?.getComponent(Label);
        if (shopLab) shopLab.string = I18n.inst.t('shop');

        const levelMax = Math.min(GameConfig.levelMax, LevelRepository.inst.easyCount || GameConfig.levelMax);
        const cleared = this.isAllClear();
        const next = this.nextLevelId();
        const ratio = Math.max(0.02, Math.min(1, (cleared ? levelMax : next - 1) / levelMax));

        if (this._progressFill) {
            this._progressFill.setContentSize(Math.max(12, 360 * ratio), 14);
        }
        if (this._progressLab) {
            this._progressLab.string = cleared ? `${levelMax} / ${levelMax}` : `${next - 1} / ${levelMax}`;
        }
        if (this._levelCaption) {
            this._levelCaption.string = cleared ? I18n.inst.t('completeLevel') : I18n.inst.t('level');
        }
        if (this._levelNum) {
            this._levelNum.string = String(cleared ? levelMax : next);
        }
        if (this._playLab) {
            this._playLab.string = cleared ? I18n.inst.t('completeLevel') : I18n.inst.t('startGame');
        }

        if (this._badgeSp) {
            const digit = (cleared ? levelMax : next) % 10;
            const sf =
                getCachedUiSprite(`ui/pic_map_btn_${digit}`) ??
                getCachedUiSprite('ui/pic_map_btn_0') ??
                getCachedUiSprite('ui/pic_levelBg_1');
            if (sf) this._badgeSp.spriteFrame = sf;
        }

        this.startIdleMotion();
    };
}
