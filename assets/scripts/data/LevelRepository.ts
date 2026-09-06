import { LevelData, LevelMode } from '../core/GameConfig';
import { EASY_LEVELS } from './levels/easy';
// normal / hard 資料檔保留於 levels/normal.ts、levels/hard.ts，但不匯入、不進遊戲
// import { NORMAL_LEVELS } from './levels/normal';
// import { HARD_LEVELS } from './levels/hard';

/**
 * 關卡資料：目前遊戲只使用 easy。
 * normal／hard 的 TS／JSON 仍保留在專案中，但不會載入或選關。
 */
export class LevelRepository {
    private static _inst: LevelRepository | null = null;
    static get inst(): LevelRepository {
        if (!this._inst) this._inst = new LevelRepository();
        return this._inst;
    }

    private _easy: LevelData[] = EASY_LEVELS;

    async preloadAll(): Promise<void> {
        return Promise.resolve();
    }

    /** 簡單難度關卡數（目前 = EASY_LEVELS.length） */
    get easyCount(): number {
        return this._easy.length;
    }

    /**
     * @param _mode 忽略；一律回 easy（保留參數以相容舊呼叫）
     */
    async loadMode(_mode: LevelMode = 0): Promise<LevelData[]> {
        return this._easy;
    }

    /**
     * @param _mode 忽略；一律取 easy
     */
    getLevel(_mode: LevelMode, levelId: number): LevelData | null {
        return this._easy[levelId - 1] ?? null;
    }
}
