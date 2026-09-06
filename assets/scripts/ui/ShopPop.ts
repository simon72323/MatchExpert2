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
} from 'cc';
import { EventBus, GameEvents } from '../core/EventBus';
import { SaveData } from '../core/SaveData';
import { IapService } from '../core/IapService';
import { ShareService } from '../core/ShareService';
import { GameApp } from '../core/GameApp';
import {
    addDim,
    addIcon,
    addLabel,
    addSpriteButton,
    addSpritePanel,
    markUiLayer,
    preloadUiSprites,
} from './UiFactory';

const { ccclass } = _decorator;

/** 商店：去廣告＋還原購買＋分享（套圖） */
@ccclass('ShopPop')
export class ShopPop extends Component {
    private _root: Node | null = null;
    private _adsLab: Label | null = null;
    private _fromPause = false;

    onLoad(): void {
        void preloadUiSprites(['ui/bar_4', 'ui/btn_color_0', 'ui/btn_color_1', 'ui/btn_color_2', 'ui/btn_color_3', 'ui/icon_coin']).then(
            () => this.build(),
        );
        this.node.active = false;
        EventBus.on(GameEvents.OPEN_SHOP, this.onOpen as (...a: unknown[]) => void);
        EventBus.on(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
        EventBus.on(GameEvents.IAP_CHANGED, this.refresh as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        EventBus.off(GameEvents.OPEN_SHOP, this.onOpen as (...a: unknown[]) => void);
        EventBus.off(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
        EventBus.off(GameEvents.IAP_CHANGED, this.refresh as (...a: unknown[]) => void);
    }

    private onOpen = (...args: unknown[]): void => {
        this._fromPause = args[0] === 'pause';
        this.show();
    };

    show(): void {
        if (!this._root) this.build();
        this.node.active = true;
        this.refresh();
        if (this._root) {
            this._root.setScale(0.85, 0.85, 1);
            tween(this._root).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    }

    hide = (): void => {
        this.node.active = false;
    };

    refresh = (): void => {
        const owned = IapService.inst.isOwned('remove_ads');
        if (this._adsLab) {
            this._adsLab.string = owned
                ? I18n.inst.t('adsRemoved')
                : `${I18n.inst.t('removeAds')} ${IapService.inst.prices.remove_ads}`;
        }
        const title = this._root?.getChildByName('panel')?.getChildByName('title')?.getComponent(Label);
        if (title) title.string = I18n.inst.t('shop');
    };

    private build(): void {
        if (this._root) return;
        markUiLayer(this.node);
        const root = new Node('ShopRoot');
        markUiLayer(root);
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(720, 1280);
        root.addComponent(BlockInputEvents);
        this._root = root;

        addDim(root, 170);
        const { node: panel } = addSpritePanel(root, 'panel', 'ui/bar_4', 520, 560, 0, 0);

        addLabel(panel, 'title', 0, 200, 36, I18n.inst.t('shop'), new Color(40, 40, 40, 255));
        addIcon(panel, 'coinDeco', 'ui/icon_coin', 40, 0, 150);

        const removeBtn = addSpriteButton(panel, 'btnRemoveAds', 0, 80, 360, 72, 'ui/btn_color_0', '', async () => {
            playSfx(AudioKey.btnClick);
            if (IapService.inst.isOwned('remove_ads')) {
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('adsRemoved'));
                return;
            }
            await IapService.inst.purchase('remove_ads');
            this.refresh();
        });
        this._adsLab = removeBtn.label;

        addSpriteButton(panel, 'btnRestore', 0, -10, 360, 68, 'ui/btn_color_3', I18n.inst.t('iapRestore'), async () => {
            playSfx(AudioKey.btnClick);
            await IapService.inst.restorePurchases(false);
            this.refresh();
        }, 24);

        addSpriteButton(panel, 'btnShare', 0, -95, 360, 68, 'ui/btn_color_1', I18n.inst.t('share'), async () => {
            playSfx(AudioKey.btnClick);
            const lv = SaveData.inst.data.level;
            await ShareService.inst.shareScore(lv, 0);
        }, 24);

        addSpriteButton(panel, 'btnClose', 0, -185, 300, 64, 'ui/btn_color_2', I18n.inst.t('close'), () => {
            playSfx(AudioKey.btnClose);
            this.hide();
            if (this._fromPause) EventBus.emit(GameEvents.OPEN_PAUSE);
        }, 24);

        this.refresh();
    }
}
