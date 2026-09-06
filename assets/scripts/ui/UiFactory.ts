import {
    Node,
    UITransform,
    Sprite,
    SpriteFrame,
    Label,
    Color,
    Graphics,
    Layers,
    resources,
    ImageAsset,
    Texture2D,
    EventTouch,
} from 'cc';
import { applySlicedSprite, applySliceInsets } from './UiSpriteUtil';

const UI_LAYER = Layers.Enum.UI_2D;

/** 共用 UI 圖載入快取 */
const _cache = new Map<string, SpriteFrame>();

export function loadUiSprite(path: string): Promise<SpriteFrame | null> {
    if (_cache.has(path)) return Promise.resolve(_cache.get(path)!);
    return new Promise((resolve) => {
        const store = (sf: SpriteFrame | null) => {
            if (sf) {
                applySliceInsets(sf, path);
                _cache.set(path, sf);
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

export function getCachedUiSprite(path: string): SpriteFrame | null {
    return _cache.get(path) ?? null;
}

export async function preloadUiSprites(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => loadUiSprite(p)));
}

export function markUiLayer(node: Node): void {
    node.layer = UI_LAYER;
}

/** 半透明遮罩（僅 Graphics，獨立節點） */
export function addDim(parent: Node, opacity = 160): Node {
    const dim = new Node('dim');
    markUiLayer(dim);
    parent.addChild(dim);
    dim.addComponent(UITransform).setContentSize(720, 1280);
    const g = dim.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, opacity);
    g.rect(-360, -640, 720, 1280);
    g.fill();
    return dim;
}

/** Sprite 面板（勿與 Graphics 同節點） */
export function addSpritePanel(
    parent: Node,
    name: string,
    path: string,
    w: number,
    h: number,
    x = 0,
    y = 0,
): { node: Node; sprite: Sprite } {
    const node = new Node(name);
    markUiLayer(node);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(w, h);
    node.setPosition(x, y, 0);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const sf = getCachedUiSprite(path);
    if (sf) applySlicedSprite(sprite, sf, path);
    else {
        void loadUiSprite(path).then((loaded) => {
            if (loaded && sprite.isValid) applySlicedSprite(sprite, loaded, path);
        });
    }
    return { node, sprite };
}

/** 簡單 Icon Sprite */
export function addIcon(
    parent: Node,
    name: string,
    path: string,
    size: number,
    x: number,
    y: number,
): Sprite {
    const node = new Node(name);
    markUiLayer(node);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size, size);
    node.setPosition(x, y, 0);
    const sp = node.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    const sf = getCachedUiSprite(path);
    if (sf) {
        sp.spriteFrame = sf;
    } else {
        void loadUiSprite(path).then((loaded) => {
            if (loaded && sp.isValid) sp.spriteFrame = loaded;
        });
    }
    return sp;
}

export function addLabel(
    parent: Node,
    name: string,
    x: number,
    y: number,
    fontSize: number,
    text = '',
    color: Color = Color.WHITE,
    w = 400,
    h = 50,
): Label {
    const n = new Node(name);
    markUiLayer(n);
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(w, h);
    n.setPosition(x, y, 0);
    const lab = n.addComponent(Label);
    lab.string = text;
    lab.fontSize = fontSize;
    lab.color = color;
    lab.horizontalAlign = Label.HorizontalAlign.CENTER;
    lab.verticalAlign = Label.VerticalAlign.CENTER;
    return lab;
}

export type SpriteBtnRefs = {
    node: Node;
    sprite: Sprite;
    label: Label;
    fallback: Node;
};

/**
 * 帶 Sprite 底圖的按鈕。
 * Graphics fallback 在子節點 `__fallback`，避免與 Sprite 衝突。
 */
export function addSpriteButton(
    parent: Node,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    path: string,
    text: string,
    cb: () => void,
    fontSize = 28,
): SpriteBtnRefs {
    const btn = new Node(name);
    markUiLayer(btn);
    parent.addChild(btn);
    btn.addComponent(UITransform).setContentSize(w, h);
    btn.setPosition(x, y, 0);

    const fallback = new Node('__fallback');
    markUiLayer(fallback);
    btn.addChild(fallback);
    fallback.addComponent(UITransform).setContentSize(w, h);
    const g = fallback.addComponent(Graphics);
    g.fillColor = new Color(70, 130, 200, 230);
    g.roundRect(-w / 2, -h / 2, w, h, Math.min(16, h / 3));
    g.fill();

    const sprite = btn.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const apply = (sf: SpriteFrame | null) => {
        if (!sf || !sprite.isValid) return;
        applySlicedSprite(sprite, sf, path);
        fallback.active = false;
    };
    const cached = getCachedUiSprite(path);
    if (cached) apply(cached);
    else void loadUiSprite(path).then(apply);

    const labelN = new Node('label');
    markUiLayer(labelN);
    btn.addChild(labelN);
    labelN.addComponent(UITransform).setContentSize(w - 20, h - 10);
    const label = labelN.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.color = Color.WHITE;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    btn.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
        e.propagationStopped = true;
        cb();
    });

    return { node: btn, sprite, label, fallback };
}

/** 僅圖示按鈕（無文字） */
export function addIconButton(
    parent: Node,
    name: string,
    path: string,
    size: number,
    x: number,
    y: number,
    cb: () => void,
): Node {
    const btn = new Node(name);
    markUiLayer(btn);
    parent.addChild(btn);
    btn.addComponent(UITransform).setContentSize(size, size);
    btn.setPosition(x, y, 0);
    const sp = btn.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    const apply = (sf: SpriteFrame | null) => {
        if (sf && sp.isValid) sp.spriteFrame = sf;
    };
    const cached = getCachedUiSprite(path);
    if (cached) apply(cached);
    else void loadUiSprite(path).then(apply);
    btn.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
        e.propagationStopped = true;
        cb();
    });
    return btn;
}

/** 常用 UI 包預載 */
export const COMMON_UI_PATHS = [
    'ui/bar_4',
    'ui/bar_6',
    'ui/bar_7',
    'ui/bar_9',
    'ui/bar_11_off',
    'ui/bar_11_on',
    'ui/btn_color_0',
    'ui/btn_color_1',
    'ui/btn_color_2',
    'ui/btn_color_3',
    'ui/btn_next',
    'ui/btn_close',
    'ui/btn_main_pause',
    'ui/icon_coin',
    'ui/icon_sound_on',
    'ui/icon_sound_off',
    'ui/icon_music_on',
    'ui/icon_music_off',
    'ui/icon_home',
    'ui/icon_replay',
    'ui/icon_help',
    'ui/icon_play',
    'ui/pic_levelBg_1',
    'ui/pic_levelBg_2',
    'ui/pic_num',
    'ui/pic_num_red',
    'ui/pic_boxLine',
    'ui/pic_map_btn_0',
    'ui/pic_map_btn_no',
    'ui/pic_toggle_set_on',
    'ui/pic_toggle_set_off',
    'ui/btn_close',
    'ui/loader',
    'ui/logo_1',
    'ui/icon_language',
    'ui/star_a_easy',
    'ui/star_b_easy',
    'ui/star_c_easy',
    'ui/star_a_0',
    'ui/star_b_0',
    'ui/star_c_0',
    'ui/result_win_en',
    'ui/result_lose_en',
    'ui/win_great_twcn',
];
