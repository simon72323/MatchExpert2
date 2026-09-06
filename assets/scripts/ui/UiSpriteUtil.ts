import { Sprite, SpriteFrame } from 'cc';

/**
 * Unity spriteBorder → Cocos 九宮格 inset。
 * Unity: {x: left, y: bottom, z: right, w: top}
 */
export const UI_SLICE_BORDERS: Record<string, { l: number; b: number; r: number; t: number }> = {
    'ui/btn_color_0': { l: 21, b: 21, r: 21, t: 21 },
    'ui/btn_color_1': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_color_2': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_color_3': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_color_4': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_color_5': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_color_6': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_color_7': { l: 30, b: 40, r: 30, t: 30 },
    'ui/btn_next': { l: 22, b: 0, r: 83, t: 0 },
    'ui/bar_1': { l: 29, b: 43, r: 30, t: 34 },
    'ui/bar_2': { l: 32, b: 0, r: 33, t: 0 },
    'ui/bar_3': { l: 44, b: 39, r: 44, t: 35 },
    'ui/bar_4': { l: 40, b: 77, r: 40, t: 70 },
    'ui/bar_4_line': { l: 28, b: 28, r: 28, t: 28 },
    'ui/bar_5': { l: 50, b: 0, r: 50, t: 0 },
    'ui/bar_6': { l: 10, b: 10, r: 10, t: 10 },
    'ui/bar_7': { l: 14, b: 14, r: 14, t: 14 },
    'ui/bar_8': { l: 61, b: 0, r: 61, t: 0 },
    'ui/bar_9': { l: 27, b: 35, r: 27, t: 25 },
    'ui/bar_10': { l: 50, b: 0, r: 50, t: 0 },
    'ui/bar_11_off': { l: 26, b: 9, r: 26, t: 30 },
    'ui/bar_11_on': { l: 30, b: 4, r: 30, t: 36 },
    'ui/bar_12_mask': { l: 25, b: 25, r: 25, t: 25 },
    'ui/bar_12_off': { l: 40, b: 52, r: 40, t: 43 },
    'ui/bar_12_off_2': { l: 40, b: 52, r: 40, t: 43 },
    'ui/bar_12_on': { l: 40, b: 50, r: 40, t: 40 },
    'ui/bar_13': { l: 35, b: 0, r: 35, t: 0 },
    'ui/pic_levelBg_1': { l: 42, b: 0, r: 42, t: 0 },
    'ui/pic_levelBg_2': { l: 38, b: 0, r: 38, t: 0 },
    'ui/pic_num': { l: 29, b: 0, r: 29, t: 0 },
    'ui/pic_num_red': { l: 27, b: 0, r: 27, t: 0 },
};

/** 對 SpriteFrame 寫入九宮格邊距（執行期，不改 meta） */
export function applySliceInsets(sf: SpriteFrame | null | undefined, path?: string): SpriteFrame | null {
    if (!sf) return null;
    const key = path ? normalizeUiPath(path) : '';
    const b = key ? UI_SLICE_BORDERS[key] : null;
    if (b) {
        sf.insetLeft = b.l;
        sf.insetBottom = b.b;
        sf.insetRight = b.r;
        sf.insetTop = b.t;
    }
    return sf;
}

/** 設定為九宮格拉伸顯示 */
export function applySlicedSprite(sp: Sprite | null | undefined, sf: SpriteFrame | null, path?: string): void {
    if (!sp) return;
    const frame = applySliceInsets(sf, path);
    sp.spriteFrame = frame;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    if (frame && path && UI_SLICE_BORDERS[normalizeUiPath(path)]) {
        sp.type = Sprite.Type.SLICED;
    } else if (frame) {
        // 無邊距時仍可用 SIMPLE；有 inset 才 SLICED
        const hasInset =
            frame.insetLeft > 0 || frame.insetRight > 0 || frame.insetTop > 0 || frame.insetBottom > 0;
        sp.type = hasInset ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
    }
}

function normalizeUiPath(path: string): string {
    return path.replace(/^resources\//, '').replace(/\/spriteFrame$/, '');
}
