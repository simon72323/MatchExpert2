import { sys } from 'cc';
import { GameConfig } from './GameConfig';

/** 對應 Unity MatchExpertSaveData（ES3 → localStorage） */
export interface SaveState {
    ver: number;
    playerCoin: number;
    level: number;
    levelStar: number[];
    levelModeUnLock: number[];
    /** 舊存檔相容欄位；升星玩法已移除，不再讀寫。 */
    blockStar: number[];
    blockEliminate: number[];
    selectSkin: number;
    buySkin: boolean[];
    itemAmount: number[];
    treasureStar: number;
    helpState: boolean[];
    sound: boolean;
    music: boolean;
    adsClose: boolean;
    lang: string;
}

function createDefault(): SaveState {
    return {
        ver: 1,
        playerCoin: GameConfig.defaultCoin,
        level: 1,
        levelStar: new Array(1000).fill(0),
        levelModeUnLock: new Array(1000).fill(0),
        blockStar: new Array(GameConfig.blockCount).fill(0),
        blockEliminate: new Array(GameConfig.blockCount).fill(0),
        selectSkin: 0,
        buySkin: [true, false, false, false, false, false],
        itemAmount: [2, 2, 2],
        treasureStar: 0,
        helpState: [false, false, false, false, false],
        sound: true,
        music: true,
        adsClose: false,
        lang: 'tw',
    };
}

export class SaveData {
    private static _inst: SaveData | null = null;
    static get inst(): SaveData {
        if (!this._inst) this._inst = new SaveData();
        return this._inst;
    }

    data: SaveState = createDefault();

    load(): SaveState {
        try {
            const raw = sys.localStorage.getItem(GameConfig.saveKey);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<SaveState>;
                this.data = { ...createDefault(), ...parsed };
                // 陣列長度防護
                this.data.levelStar = this.ensureArray(this.data.levelStar, 1000, 0);
                this.data.levelModeUnLock = this.ensureArray(this.data.levelModeUnLock, 1000, 0);
                this.data.blockStar = this.ensureArray(this.data.blockStar, GameConfig.blockCount, 0);
                this.data.blockEliminate = this.ensureArray(this.data.blockEliminate, GameConfig.blockCount, 0);
                this.data.buySkin = this.ensureArray(this.data.buySkin, GameConfig.skinCount, false);
                this.data.buySkin[0] = true;
                this.data.itemAmount = this.ensureArray(this.data.itemAmount, GameConfig.itemCount, 0);
                this.data.helpState = this.ensureArray(this.data.helpState, 5, false);
                // 語系碼正規化：S5G 暫時碼 → tw/cn/en
                const langMap: Record<string, string> = { tch: 'tw', sch: 'cn', eng: 'en' };
                if (langMap[this.data.lang]) this.data.lang = langMap[this.data.lang];
            } else {
                this.data = createDefault();
                this.save();
            }
        } catch {
            this.data = createDefault();
        }
        return this.data;
    }

    save(): void {
        sys.localStorage.setItem(GameConfig.saveKey, JSON.stringify(this.data));
    }

    private ensureArray<T>(arr: T[] | undefined, len: number, fill: T): T[] {
        const out = Array.isArray(arr) ? arr.slice() : [];
        while (out.length < len) out.push(fill);
        return out.slice(0, len);
    }

    savePlayerCoin(delta: number): void {
        this.data.playerCoin += delta;
        this.save();
    }

    saveLevel(): void {
        this.data.level += 1;
        this.save();
    }

    saveLevelStar(level: number, star: number): void {
        this.data.levelStar[level - 1] = star;
        this.save();
    }

    saveLevelModeUnLock(level: number, mode: number): void {
        this.data.levelModeUnLock[level - 1] = mode;
        this.save();
    }

    saveBlockEliminate(id: number, n: number): void {
        this.data.blockEliminate[id] += n;
        this.save();
    }

    saveSelectSkin(id: number): void {
        this.data.selectSkin = id;
        this.save();
    }

    saveBuySkin(id: number): void {
        this.data.buySkin[id] = true;
        this.save();
    }

    saveItemAmount(index: number, delta: number): void {
        this.data.itemAmount[index] += delta;
        this.save();
    }

    saveTreasureStar(n: number): void {
        this.data.treasureStar = n;
        this.save();
    }

    saveSound(on: boolean): void {
        this.data.sound = on;
        this.save();
    }

    saveMusic(on: boolean): void {
        this.data.music = on;
        this.save();
    }

    saveLang(lang: string): void {
        this.data.lang = lang;
        this.save();
    }

    saveAdsClose(on: boolean): void {
        this.data.adsClose = on;
        this.save();
    }

    resetSave(): void {
        const keepSound = this.data.sound;
        const keepMusic = this.data.music;
        const keepLang = this.data.lang;
        this.data = createDefault();
        this.data.sound = keepSound;
        this.data.music = keepMusic;
        this.data.lang = keepLang;
        this.save();
    }
}
