import { LevelData, calcTileLocalPos, TILE_TYPE } from '../core/GameConfig';

export interface BoardTileSpawn {
    index: number;
    floor: number;
    posIndex: number;
    tileType: number;
    x: number;
    y: number;
    /** 特殊牌 4/5/6 不佔基本花色配對池 */
    isSpecial456: boolean;
}

/** 將關卡 JSON 展開為桌面生成清單（對齊 MatchExpertGame.startPlay） */
export function buildBoardSpawns(level: LevelData): BoardTileSpawn[] {
    const spawns: BoardTileSpawn[] = [];
    let cursor = 0;
    for (let f = 0; f < level.floorCounts.length; f++) {
        const count = level.floorCounts[f];
        for (let i = 0; i < count; i++) {
            const idx = cursor + i;
            const posIndex = level.positions[idx];
            const tileType = level.tileTypes[idx] ?? 0;
            const { x, y } = calcTileLocalPos(level.gridMode, f, posIndex);
            spawns.push({
                index: idx,
                floor: f,
                posIndex,
                tileType,
                x,
                y,
                isSpecial456: tileType > TILE_TYPE.FIRE,
            });
        }
        cursor += count;
    }
    return spawns;
}

/** 基本可配對方塊數量（總塊 - 水/石/槌） */
export function countMatchableTiles(spawns: BoardTileSpawn[]): number {
    return spawns.reduce((n, s) => n + (s.isSpecial456 ? 0 : 1), 0);
}

/** 產生花色陣列：每種花色數量為 3 的倍數，長度 = matchableCount */
export function buildSymbolPool(symbolTypeCount: number, matchableCount: number, iconMax = 20): number[] {
    const icons = Array.from({ length: iconMax }, (_, i) => i);
    shuffleInPlace(icons);
    const picked = icons.slice(0, Math.max(1, symbolTypeCount));
    const groups = Math.floor(matchableCount / 3);
    const pool: number[] = [];
    for (let g = 0; g < groups; g++) {
        const id = picked[g % picked.length];
        pool.push(id, id, id);
    }
    // 補齊剩餘（理論上應被 3 整除）
    while (pool.length < matchableCount) {
        const id = picked[pool.length % picked.length];
        pool.push(id);
    }
    shuffleInPlace(pool);
    return pool;
}

export function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
