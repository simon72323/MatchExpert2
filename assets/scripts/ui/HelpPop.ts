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

const HELP_LINES = [
    '1. Tap uncovered tiles into the tray (7 slots).',
    '2. Match 3 same symbols to clear.',
    '3. Tray full = lose; clear all = win.',
    '4. Ice melts when adjacent tiles leave; Water puts out Fire; Hammer breaks Stone (x3).',
    '5. Items: Undo / Match-one / Shuffle / +1 slot.',
];

const HELP_LINES_TW = [
    '1. 點擊未被遮擋的方塊進入組牌區（7 格）。',
    '2. 三個相同圖案相鄰即可消除。',
    '3. 組牌區滿則失敗；清完可配對方塊則勝利。',
    '4. 冰：鄰近進出可破；水滅火；槌敲石 3 次。',
    '5. 道具：撤回／消一組／重整／第 8 格。',
];

@ccclass('HelpPop')
export class HelpPop extends Component {
    private _root: Node | null = null;
    private _body: Label | null = null;

    onLoad(): void {
        void preloadUiSprites(['ui/bar_4', 'ui/btn_color_2', 'ui/icon_help']).then(() => this.build());
        this.node.active = false;
        EventBus.on(GameEvents.OPEN_HELP, this.show as (...a: unknown[]) => void);
        EventBus.on(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
        EventBus.on(GameEvents.LANG_CHANGED, this.refreshText as (...a: unknown[]) => void);
    }

    onDestroy(): void {
        EventBus.off(GameEvents.OPEN_HELP, this.show as (...a: unknown[]) => void);
        EventBus.off(GameEvents.CLOSE_POP, this.hide as (...a: unknown[]) => void);
        EventBus.off(GameEvents.LANG_CHANGED, this.refreshText as (...a: unknown[]) => void);
    }

    show = (): void => {
        if (!this._root) this.build();
        this.node.active = true;
        this.refreshText();
        if (this._root) {
            this._root.setScale(0.85, 0.85, 1);
            tween(this._root).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
        }
    };

    hide = (): void => {
        this.node.active = false;
    };

    private refreshText = (): void => {
        const lines = I18n.inst.lang === 'en' ? HELP_LINES : HELP_LINES_TW;
        if (this._body) this._body.string = lines.join('\n\n');
        const title = this._root?.getChildByName('panel')?.getChildByName('title')?.getComponent(Label);
        if (title) title.string = I18n.inst.t('gameHelp');
        const close = this._root?.getChildByName('panel')?.getChildByName('btnClose')?.getChildByName('label')?.getComponent(Label);
        if (close) close.string = I18n.inst.t('close');
    };

    private build(): void {
        if (this._root) return;
        markUiLayer(this.node);
        const root = new Node('HelpRoot');
        markUiLayer(root);
        this.node.addChild(root);
        root.addComponent(UITransform).setContentSize(720, 1280);
        root.addComponent(BlockInputEvents);
        this._root = root;

        addDim(root, 170);
        const { node: panel } = addSpritePanel(root, 'panel', 'ui/bar_4', 600, 820, 0, 0);

        addIcon(panel, 'helpIcon', 'ui/icon_help', 48, 0, 340);
        addLabel(panel, 'title', 0, 280, 36, I18n.inst.t('gameHelp'), new Color(40, 40, 40, 255));

        this._body = addLabel(panel, 'body', 0, 20, 22, '', new Color(60, 60, 60, 255), 520, 480);
        this._body.horizontalAlign = Label.HorizontalAlign.LEFT;
        this._body.verticalAlign = Label.VerticalAlign.TOP;
        this._body.overflow = Label.Overflow.RESIZE_HEIGHT;

        addSpriteButton(panel, 'btnClose', 0, -340, 280, 68, 'ui/btn_color_2', I18n.inst.t('close'), () => {
            playSfx(AudioKey.btnClose);
            this.hide();
        });
    }
}
