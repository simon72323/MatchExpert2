import {
    _decorator,
    Component,
    Node,
    UITransform,
    Label,
    Color,
    Sprite,
    Layers,
    tween,
    Vec3,
} from 'cc';
import { EventBus, GameEvents } from '../core/EventBus';
import { applySlicedSprite } from './UiSpriteUtil';
import { loadUiSprite, markUiLayer } from './UiFactory';

const { ccclass } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

/** 頂部短暫提示 */
@ccclass('TipToast')
export class TipToast extends Component {
    private _label: Label | null = null;
    private _panel: Node | null = null;
    private _hiding = false;

    onLoad(): void {
        this.build();
        this.node.active = false;
        EventBus.on(GameEvents.SHOW_TIP, this.onTip as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        EventBus.off(GameEvents.SHOW_TIP, this.onTip as (...a: unknown[]) => void);
    }

    private onTip = (...args: unknown[]): void => {
        const msg = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '');
        if (!msg) return;
        this.show(msg);
    };

    show(msg: string): void {
        this.unscheduleAllCallbacks();
        this.node.active = true;
        this._hiding = false;
        if (this._label) this._label.string = msg;
        if (this._panel) {
            this._panel.setPosition(0, 420, 0);
            this._panel.setScale(0.85, 0.85, 1);
            tween(this._panel)
                .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }
        this.scheduleOnce(() => this.hide(), 1.6);
    }

    hide(): void {
        if (this._hiding || !this.node.active) return;
        this._hiding = true;
        if (!this._panel) {
            this.node.active = false;
            return;
        }
        tween(this._panel)
            .to(0.15, { scale: new Vec3(0.9, 0.9, 1) })
            .call(() => {
                this.node.active = false;
                this._hiding = false;
            })
            .start();
    }

    private build(): void {
        this.node.layer = UI_LAYER;
        const root = new Node('ToastRoot');
        markUiLayer(root);
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(720, 1280);

        const panel = new Node('panel');
        markUiLayer(panel);
        root.addChild(panel);
        panel.addComponent(UITransform).setContentSize(520, 80);
        panel.setPosition(0, 420, 0);
        const sp = panel.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        void loadUiSprite('ui/bar_9').then((sf) => {
            if (sf && sp.isValid) applySlicedSprite(sp, sf, 'ui/bar_9');
        });
        this._panel = panel;

        const labN = new Node('lab');
        markUiLayer(labN);
        panel.addChild(labN);
        labN.addComponent(UITransform).setContentSize(480, 60);
        this._label = labN.addComponent(Label);
        this._label.fontSize = 26;
        this._label.color = new Color(40, 40, 40, 255);
        this._label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._label.verticalAlign = Label.VerticalAlign.CENTER;
        this._label.overflow = Label.Overflow.SHRINK;
    }
}
