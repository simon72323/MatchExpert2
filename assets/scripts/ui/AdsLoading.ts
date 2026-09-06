import { I18n } from '../core/I18n';
import {
    _decorator,
    Component,
    Node,
    UITransform,
    Label,
    Color,
    Graphics,
    Sprite,
    Layers,
    BlockInputEvents,
    tween,
} from 'cc';
import { EventBus, GameEvents } from '../core/EventBus';
import { loadUiSprite, markUiLayer } from './UiFactory';

const { ccclass } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

/** 廣告載入遮罩 */
@ccclass('AdsLoading')
export class AdsLoading extends Component {
    private _lab: Label | null = null;
    private _loader: Node | null = null;

    onLoad(): void {
        this.build();
        this.node.active = false;
        EventBus.on(GameEvents.ADS_LOADING, this.onLoading as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        EventBus.off(GameEvents.ADS_LOADING, this.onLoading as (...a: unknown[]) => void);
    }

    private onLoading = (...args: unknown[]): void => {
        const show = !!args[0];
        this.node.active = show;
        if (this._lab) this._lab.string = I18n.inst.t('adsBusy');
        if (show && this._loader) {
            TweenStop(this._loader);
            this._loader.angle = 0;
            tween(this._loader)
                .by(1.2, { angle: -360 })
                .repeatForever()
                .start();
        } else if (this._loader) {
            TweenStop(this._loader);
        }
    };

    private build(): void {
        this.node.layer = UI_LAYER;
        this.node.addComponent(UITransform).setContentSize(720, 1280);
        this.node.addComponent(BlockInputEvents);
        // dim 獨立：不可與 Sprite 同節點
        const dim = new Node('dim');
        markUiLayer(dim);
        this.node.addChild(dim);
        dim.addComponent(UITransform).setContentSize(720, 1280);
        const g = dim.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 180);
        g.rect(-360, -640, 720, 1280);
        g.fill();

        const loader = new Node('loader');
        markUiLayer(loader);
        this.node.addChild(loader);
        loader.addComponent(UITransform).setContentSize(96, 96);
        loader.setPosition(0, 40, 0);
        const sp = loader.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        void loadUiSprite('ui/loader').then((sf) => {
            if (sf && sp.isValid) sp.spriteFrame = sf;
        });
        this._loader = loader;

        const labN = new Node('lab');
        markUiLayer(labN);
        this.node.addChild(labN);
        labN.addComponent(UITransform).setContentSize(500, 60);
        labN.setPosition(0, -80, 0);
        this._lab = labN.addComponent(Label);
        this._lab.fontSize = 32;
        this._lab.color = Color.WHITE;
        this._lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._lab.string = I18n.inst.t('adsBusy');
    }
}

function TweenStop(node: Node): void {
    tween(node).stop();
}
