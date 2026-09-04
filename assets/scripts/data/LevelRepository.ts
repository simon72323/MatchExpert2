import { resources, JsonAsset } from 'cc';
import { LevelData, LevelMode, MODE_NAME } from '../core/GameConfig';

interface LevelFile {
    levels: LevelData[];
}

/** 載入 resources/levels/{easy|normal|hard}.json */
export class LevelRepository {
    private static _inst: LevelRepository | null = null;
    static get inst(): LevelRepository {
        if (!this._inst) this._inst = new LevelRepository();
        return this._inst;
    }

    private _cache = new Map<string, LevelData[]>();

    async preloadAll(): Promise<void> {
        await Promise.all([
            this.loadMode(0),
            this.loadMode(1),
            this.loadMode(2),
        ]);
    }

    async loadMode(mode: LevelMode): Promise<LevelData[]> {
        const name = MODE_NAME[mode];
        if (this._cache.has(name)) return this._cache.get(name)!;

        return new Promise((resolve, reject) => {
            resources.load(`levels/${name}`, JsonAsset, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error(`level ${name} load failed`));
                    return;
                }
                const file = asset.json as LevelFile;
                this._cache.set(name, file.levels);
                resolve(file.levels);
            });
        });
    }

    getLevel(mode: LevelMode, levelId: number): LevelData | null {
        const name = MODE_NAME[mode];
        const list = this._cache.get(name);
        if (!list) return null;
        return list[levelId - 1] ?? null;
    }
}
