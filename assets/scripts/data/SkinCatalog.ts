import { ImageAsset, resources, SpriteFrame, Texture2D } from 'cc';
import { GameConfig, TILE_TYPE } from '../core/GameConfig';

/**
 * 方塊／背景貼圖載入（resources/skin、bg）。
 * 皮膚商店已移除：永遠使用 fixedSkinId=0。
 */
export class SkinCatalog {
    private static _inst: SkinCatalog | null = null;
    static get inst(): SkinCatalog {
        if (!this._inst) this._inst = new SkinCatalog();
        return this._inst;
    }

    private _cache = new Map<string, SpriteFrame>();
    private _ready = false;
    private _loading: Promise<void> | null = null;
    private _loadedSkin = -1;

    get ready(): boolean {
        return this._ready;
    }

    private get skinId(): number {
        return GameConfig.fixedSkinId;
    }

    preload(_skinId?: number): Promise<void> {
        const skin = this.skinId;
        if (this._ready && this._loadedSkin === skin) return Promise.resolve();
        if (this._loading && this._loadedSkin === skin) return this._loading;

        this._loadedSkin = skin;
        this._loading = (async () => {
            const paths: string[] = [];
            for (let i = 0; i < 20; i++) {
                const n = i < 10 ? `0${i}` : `${i}`;
                paths.push(`skin/symbol_${skin}_${n}`);
            }
            paths.push(`skin/symbol_${skin}_bonus`);
            for (let i = 0; i <= 6; i++) paths.push(`skin/box_${i}`);
            paths.push(
                'skin/box_gray',
                'skin/box_hide',
                'skin/box_ice',
                'skin/box_water',
                'skin/box_stone',
                'skin/box_stone_1',
                'skin/box_stone_2',
                'skin/box_hammer',
                'skin/icon_water',
                'skin/icon_hammer',
                'bg/bg_0',
            );
            await Promise.all(paths.map((p) => this.loadSf(p).catch(() => null)));
            this._ready = true;
            this._loading = null;
            console.log('[SkinCatalog] preloaded skin', skin, 'cache', this._cache.size);
        })();
        return this._loading;
    }

    /** 皮膚功能已移除；保留空實作以免舊呼叫崩潰 */
    async switchSkin(_skinId?: number): Promise<void> {
        await this.preload(this.skinId);
    }

    getSymbol(symbolId: number, _skinId?: number): SpriteFrame | null {
        const skin = this.skinId;
        if (symbolId === 20) return this._cache.get(`skin/symbol_${skin}_bonus`) ?? null;
        const n = symbolId < 10 ? `0${symbolId}` : `${symbolId}`;
        const key = `skin/symbol_${skin}_${n}`;
        return this._cache.get(key) ?? null;
    }

    getBox(starLv = 0): SpriteFrame | null {
        const lv = Math.max(0, Math.min(6, starLv));
        return this._cache.get(`skin/box_${lv}`) ?? this._cache.get('skin/box_0') ?? null;
    }

    getBoxGray(): SpriteFrame | null {
        return this._cache.get('skin/box_gray') ?? this.getBox(0);
    }

    getSpecialBox(typeId: number): SpriteFrame | null {
        switch (typeId) {
            case TILE_TYPE.HIDE:
                return this._cache.get('skin/box_hide') ?? null;
            case TILE_TYPE.ICE:
                return this._cache.get('skin/box_ice') ?? null;
            case TILE_TYPE.WATER:
                return this._cache.get('skin/box_water') ?? null;
            case TILE_TYPE.STONE:
                return this._cache.get('skin/box_stone') ?? null;
            case TILE_TYPE.HAMMER:
                return this._cache.get('skin/box_hammer') ?? null;
            default:
                return this.getBox(0);
        }
    }

    getStoneBox(state: number): SpriteFrame | null {
        if (state <= 0) return this._cache.get('skin/box_stone') ?? null;
        if (state === 1) return this._cache.get('skin/box_stone_1') ?? this._cache.get('skin/box_stone') ?? null;
        return this._cache.get('skin/box_stone_2') ?? this._cache.get('skin/box_stone') ?? null;
    }

    getBg(_skinId?: number): SpriteFrame | null {
        // 固定 bg_0；skinBg_N 是預覽小圖，勿當全屏底
        return this._cache.get('bg/bg_0') ?? null;
    }

    getIconWater(): SpriteFrame | null {
        return this._cache.get('skin/icon_water') ?? null;
    }

    getIconHammer(): SpriteFrame | null {
        return this._cache.get('skin/icon_hammer') ?? null;
    }

    private loadSf(path: string): Promise<SpriteFrame | null> {
        if (this._cache.has(path)) return Promise.resolve(this._cache.get(path)!);
        return new Promise((resolve) => {
            resources.load(`${path}/spriteFrame`, SpriteFrame, (err, sf) => {
                if (!err && sf) {
                    this._cache.set(path, sf);
                    resolve(sf);
                    return;
                }
                resources.load(path, SpriteFrame, (err2, sf2) => {
                    if (!err2 && sf2) {
                        this._cache.set(path, sf2);
                        resolve(sf2);
                        return;
                    }
                    resources.load(path, ImageAsset, (err3, img) => {
                        if (err3 || !img) {
                            console.warn('[SkinCatalog] miss', path);
                            resolve(null);
                            return;
                        }
                        const tex = new Texture2D();
                        tex.image = img;
                        const frame = new SpriteFrame();
                        frame.texture = tex;
                        this._cache.set(path, frame);
                        resolve(frame);
                    });
                });
            });
        });
    }
}
