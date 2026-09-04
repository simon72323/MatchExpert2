/**
 * 對應 Unity MatchExpertMain 內的經濟/規則常數。
 * 也可從 resources/config/game_config.json 覆寫。
 */
export type TileTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type LevelMode = 0 | 1 | 2; // easy / normal / hard

export const TILE_TYPE = {
    NORMAL: 0 as TileTypeId,
    HIDE: 1 as TileTypeId,
    ICE: 2 as TileTypeId,
    FIRE: 3 as TileTypeId,
    WATER: 4 as TileTypeId,
    STONE: 5 as TileTypeId,
    HAMMER: 6 as TileTypeId,
};

export const MODE_NAME: Record<LevelMode, 'easy' | 'normal' | 'hard'> = {
    0: 'easy',
    1: 'normal',
    2: 'hard',
};

export const GameConfig = {
    levelMax: 180,
    stageLevel: [20, 30, 35, 40, 45, 50],
    maxGameTime: 180,
    addTimeOnMatch: 3,
    tableSlots: 7,
    cellSize: 120,
    moveTime: 0.4,
    starUpCoin: [400, 1200, 2400, 4000, 6000, 84000],
    starExp: [20, 60, 140, 300, 540, 860],
    starUpGetCoin: [1, 2, 4, 6, 8, 10, 12],
    skinBuyCoin: [1000, 1500, 2000, 2500, 3000],
    itemBuyCoin: [80, 150, 100, 400],
    revivalCoin: 300,
    defaultCoin: 100,
    skinCount: 6,
    blockCount: 21,
    itemCount: 3,
    /** 9x9 原點（Unity UI 座標） */
    origin9: { x: -480, y: 480 },
    /** 8x8 原點 */
    origin8: { x: -420, y: 420 },
    saveKey: 'MatchExpert2_Save',
};

export interface LevelData {
    id: number;
    mode: string;
    levelNum: number;
    /** 0: 偶數層 9x9 / 奇數層 8x8；1: 相反 */
    gridMode: number;
    scale: number;
    symbolTypes: number;
    floorCounts: number[];
    positions: number[];
    tileTypes: number[];
}

/** 依關卡資料計算格子世界座標（對齊 Unity MatchExpertGame） */
export function calcTileLocalPos(gridMode: number, floorIndex: number, posIndex: number): { x: number; y: number } {
    const size = GameConfig.cellSize;
    const use9 = gridMode === 0 ? floorIndex % 2 === 0 : floorIndex % 2 === 1;
    if (use9) {
        const col = posIndex % 9;
        const row = Math.floor(posIndex / 9);
        return {
            x: GameConfig.origin9.x + col * size,
            y: GameConfig.origin9.y - row * size,
        };
    }
    const col = posIndex % 8;
    const row = Math.floor(posIndex / 8);
    return {
        x: GameConfig.origin8.x + col * size,
        y: GameConfig.origin8.y - row * size,
    };
}
