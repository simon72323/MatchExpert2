import { I18n } from '../core/I18n';
import {
    _decorator,
    Component,
    Label,
    Node,
    UITransform,
    Color,
    Graphics,
    Layers,
    Sprite,
    SpriteFrame,
    resources,
} from 'cc';
import { SkinCatalog } from '../data/SkinCatalog';
import { EventBus, GameEvents } from '../core/EventBus';
import { applySlicedSprite } from './UiSpriteUtil';

const { ccclass, property } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

/** 載入頁（對應 MatchExpertLoading） */
@ccclass('LoadingView')
export class LoadingView extends Component {
    @property(Label)
    tipLabel: Label | null = null;

    private _built = false;
    private _progressFillUt: UITransform | null = null;
    private _progress = 0;

    onLoad(): void {
        this.ensureVisual();
    }

    onEnable(): void {
        this.ensureVisual();
        this.refresh();
        this._progress = 0;
        this.schedule(this.tickProgress, 0.05);
        EventBus.on(GameEvents.LANG_CHANGED, this.refresh as (...a: unknown[]) => void);
    }

    onDisable(): void {
        this.unschedule(this.tickProgress);
        EventBus.off(GameEvents.LANG_CHANGED, this.refresh as (...a: unknown[]) => void);
    }

    private tickProgress = (): void => {
        this._progress = Math.min(1, this._progress + 0.03);
        if (this._progressFillUt) {
            this._progressFillUt.setContentSize(Math.max(8, 400 * this._progress), 18);
        }
    };

    refresh = (): void => {
        if (this.tipLabel) {
            this.tipLabel.string = I18n.inst.t('loading');
        }
    };

    private ensureVisual(): void {
        if (this._built) return;
        this._built = true;
        this.node.layer = UI_LAYER;

        let bg = this.node.getChildByName('__loadBg');
        if (!bg) {
            bg = new Node('__loadBg');
            bg.layer = UI_LAYER;
            this.node.insertChild(bg, 0);
            bg.addComponent(UITransform).setContentSize(720, 1280);
            const sp = bg.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const frame = SkinCatalog.inst.getBg(0);
            if (frame) {
                sp.spriteFrame = frame;
                const rw = frame.rect.width || 1024;
                const rh = frame.rect.height || 2048;
                const scale = Math.max(720 / rw, 1280 / rh);
                bg.getComponent(UITransform)!.setContentSize(rw * scale, rh * scale);
            } else {
                // Graphics 不可與 Sprite 同節點
                sp.enabled = false;
                let fallback = bg.getChildByName('__fallback');
                if (!fallback) {
                    fallback = new Node('__fallback');
                    fallback.layer = UI_LAYER;
                    bg.addChild(fallback);
                    fallback.addComponent(UITransform).setContentSize(720, 1280);
                    const g = fallback.addComponent(Graphics);
                    g.fillColor = new Color(24, 40, 64, 255);
                    g.rect(-360, -640, 720, 1280);
                    g.fill();
                }
            }
        }

        let brand = this.node.getChildByName('__brand');
        if (!brand) {
            brand = new Node('__brand');
            brand.layer = UI_LAYER;
            this.node.addChild(brand);
            brand.addComponent(UITransform).setContentSize(420, 180);
            brand.setPosition(0, 160, 0);
            const logo = brand.addComponent(Sprite);
            logo.sizeMode = Sprite.SizeMode.CUSTOM;
            resources.load('ui/logo_1/spriteFrame', SpriteFrame, (err, sf) => {
                if (!err && sf && logo.isValid) logo.spriteFrame = sf;
            });
            // 備援文字在子節點
            const labN = new Node('fallbackLab');
            labN.layer = UI_LAYER;
            brand.addChild(labN);
            labN.addComponent(UITransform).setContentSize(500, 80);
            labN.setPosition(0, -120, 0);
            const lab = labN.addComponent(Label);
            lab.string = 'Match Expert';
            lab.fontSize = 36;
            lab.color = Color.WHITE;
            lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        }

        if (!this.tipLabel) {
            let tip = this.node.getChildByName('Tip');
            if (!tip) {
                tip = new Node('Tip');
                tip.layer = UI_LAYER;
                this.node.addChild(tip);
                tip.addComponent(UITransform).setContentSize(400, 40);
                tip.setPosition(0, -80, 0);
                this.tipLabel = tip.addComponent(Label);
                this.tipLabel.fontSize = 28;
                this.tipLabel.color = new Color(220, 230, 240, 255);
                this.tipLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            } else {
                this.tipLabel = tip.getComponent(Label);
            }
        }

        let barBg = this.node.getChildByName('__barBg');
        if (!barBg) {
            barBg = new Node('__barBg');
            barBg.layer = UI_LAYER;
            this.node.addChild(barBg);
            barBg.addComponent(UITransform).setContentSize(400, 24);
            barBg.setPosition(0, -140, 0);
            const bgSp = barBg.addComponent(Sprite);
            bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
            resources.load('ui/bar_6/spriteFrame', SpriteFrame, (err, sf) => {
                if (!err && sf && bgSp.isValid) {
                    applySlicedSprite(bgSp, sf, 'ui/bar_6');
                }
            });

            const fill = new Node('fill');
            fill.layer = UI_LAYER;
            barBg.addChild(fill);
            const fillUt = fill.addComponent(UITransform);
            fillUt.setContentSize(400, 18);
            fillUt.setAnchorPoint(0, 0.5);
            fill.setPosition(-200, 0, 0);
            const fillSp = fill.addComponent(Sprite);
            fillSp.sizeMode = Sprite.SizeMode.CUSTOM;
            resources.load('ui/bar_7/spriteFrame', SpriteFrame, (err, sf) => {
                if (!err && sf && fillSp.isValid) applySlicedSprite(fillSp, sf, 'ui/bar_7');
            });
            this._progressFillUt = fillUt;
        }
    }
}
