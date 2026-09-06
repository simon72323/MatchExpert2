/**
 * 對應 Unity MatchExpertMain 內的經濟/規則常數。
 * 也可從 resources/config/game_config.json 覆寫。
 */
export type TileTypeId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type LevelMode = 0 | 1 | 2; // 0=easy（遊戲唯一啟用）；1/2 僅相容舊型別，不進玩法

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

/** 遊戲固定使用簡單難度 */
export const PLAY_MODE: LevelMode = 0;

export const GameConfig = {
    /** 與 EASY_LEVELS 對齊（Unity levelMax=180） */
    levelMax: 180,
    stageLevel: [20, 30, 35, 40, 45, 50],
    maxGameTime: 180,
    addTimeOnMatch: 3,
    tableSlots: 7,
    cellSize: 120,
    moveTime: 0.4,
    /** 皮膚商店已移除；常數僅相容舊存檔／素材路徑 */
    skinBuyCoin: [1000, 1500, 2000, 2500, 3000],
    itemBuyCoin: [80, 150, 100, 400],
    revivalCoin: 300,
    defaultCoin: 100,
    skinCount: 6,
    /** 固定使用皮膚 0（不做換膚） */
    fixedSkinId: 0,
    blockCount: 21,
    itemCount: 3,
    /** 9x9 原點（Unity UI 座標） */
    origin9: { x: -480, y: 480 },
    /** 8x8 原點 */
    origin8: { x: -420, y: 420 },
    saveKey: 'MatchExpert2_Save',
};

/**
 * Unity creatLevelSymbol.prefab：
 * - 根 120×120
 * - box：134×138 @ (7,-9)
 * - symbol：118×118 @ (1,-1)
 */
export const TILE_VISUAL = {
    box: { w: 134, h: 138, x: 7, y: -9 },
    icon: { w: 118, h: 118, x: 1, y: -1 },
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

/** 依關卡資料計算格子世界座標（對齊 Unity MatchExpertGame，單位=設計座標，未含關卡縮放） */
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

/**
 * 棋盤縮放：Unity 為 pos.localScale = 1 + scale*0.05（設計 1080×1920）。
 * Cocos 設計寬 720，9×9 邏輯寬 1080，需再乘 fit 才能進畫面。
 * 格座標必須維持 Unity 邏輯值；勿再對 boardX/Y 額外乘縮放。
 */
export function calcBoardRootScale(levelScale: number, designWidth = 720): number {
    const logicalW = 9 * GameConfig.cellSize; // 1080
    const margin = 24;
    const fit = Math.min(1, (designWidth - margin * 2) / logicalW);
    const levelMul = 1 + (levelScale ?? 0) * 0.05;
    return fit * levelMul;
}

/** 棋盤在 GameView 內垂直偏移（HUD 與組牌區之間） */
export const BOARD_ROOT_Y = 40;
export const TABLE_ROOT_Y = -460;
export const ITEM_BAR_Y = -360;
