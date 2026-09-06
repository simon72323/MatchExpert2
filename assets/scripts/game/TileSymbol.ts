import { _decorator, Component, Node, Color, UIOpacity } from 'cc';
import { TILE_TYPE, TileTypeId } from '../core/GameConfig';

const { ccclass } = _decorator;

export type TilePlace = 'board' | 'table';

@ccclass('TileSymbol')
export class TileSymbol extends Component {
    symbolId = -1;
    typeId: TileTypeId = TILE_TYPE.NORMAL;
    posIndex = 0;
    floor = 0;
    boardX = 0;
    boardY = 0;
    covered = false;
    removed = false;
    place: TilePlace = 'board';
    /** 石頭敲擊進度 0~3 */
    stoneState = 0;

    /** 視覺回調：由 MatchGame 注入，避免循環依賴 */
    onVisualCover: ((covered: boolean) => void) | null = null;
    onStoneVisual: ((state: number) => void) | null = null;

    get clickable(): boolean {
        if (this.removed || this.place !== 'board') return false;
        if (this.covered) return false;
        if (this.typeId === TILE_TYPE.ICE || this.typeId === TILE_TYPE.FIRE || this.typeId === TILE_TYPE.STONE) {
            return false;
        }
        // 水/槌：露出後可點觸發特殊效果
        if (this.typeId === TILE_TYPE.WATER || this.typeId === TILE_TYPE.HAMMER) {
            return true;
        }
        return this.symbolId >= 0;
    }

    setCovered(v: boolean, force = false): void {
        if (!force && this.covered === v) return;
        this.covered = v;
        this.onVisualCover?.(v);
    }

    applyOpacity(node: Node, alpha: number): void {
        let op = node.getComponent(UIOpacity);
        if (!op) op = node.addComponent(UIOpacity);
        op.opacity = alpha;
    }
}

export const TILE_FACE_COLORS: Color[] = [
    new Color(70, 140, 240, 255),
    new Color(240, 90, 90, 255),
    new Color(80, 200, 120, 255),
    new Color(250, 180, 50, 255),
    new Color(180, 100, 230, 255),
    new Color(50, 200, 200, 255),
    new Color(240, 120, 180, 255),
    new Color(160, 120, 80, 255),
    new Color(100, 160, 200, 255),
    new Color(200, 200, 80, 255),
    new Color(120, 80, 160, 255),
    new Color(80, 160, 100, 255),
    new Color(220, 140, 100, 255),
    new Color(100, 100, 220, 255),
    new Color(180, 60, 120, 255),
    new Color(60, 180, 160, 255),
    new Color(200, 100, 60, 255),
    new Color(140, 180, 60, 255),
    new Color(100, 120, 180, 255),
    new Color(180, 180, 180, 255),
    new Color(255, 215, 0, 255), // treasure 20
];
