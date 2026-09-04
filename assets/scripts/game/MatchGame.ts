import { _decorator, Component, Node, UITransform, Color, Graphics } from 'cc';
import { GameApp } from '../core/GameApp';
import { LevelRepository } from '../data/LevelRepository';
import { LevelMode, GameConfig } from '../core/GameConfig';
import { buildBoardSpawns, buildSymbolPool, countMatchableTiles, BoardTileSpawn } from './BoardLayout';
import { EventBus, GameEvents } from '../core/EventBus';
import { AudioMgr } from '../core/AudioMgr';

const { ccclass, property } = _decorator;

/**
 * 對局核心（MVP 骨架）
 * - 已接：關卡資料載入、層級座標生成、調試色塊
 * - 待接：點擊、組牌區三消、遮擋、特殊牌、道具
 */
@ccclass('MatchGame')
export class MatchGame extends Component {
    @property(Node)
    boardRoot: Node | null = null;

    @property(Node)
    tableRoot: Node | null = null;

    private _spawns: BoardTileSpawn[] = [];
    private _symbolPool: number[] = [];
    private _tileNodes: Node[] = [];
    symbolCount = 0;
    pause = true;
    tableLength = GameConfig.tableSlots;

    onEnable(): void {
        EventBus.on('enter_level', this.onEnterLevel as (...args: unknown[]) => void);
    }

    onDisable(): void {
        EventBus.off('enter_level', this.onEnterLevel as (...args: unknown[]) => void);
    }

    private onEnterLevel = (level: unknown, mode: unknown): void => {
        this.startLevel(Number(level), Number(mode) as LevelMode);
    };

    startLevel(levelId: number, mode: LevelMode): void {
        const data = LevelRepository.inst.getLevel(mode, levelId);
        if (!data) {
            console.warn('[MatchGame] level missing', mode, levelId);
            return;
        }

        this.clearBoard();
        this._spawns = buildBoardSpawns(data);
        const matchable = countMatchableTiles(this._spawns);
        this._symbolPool = buildSymbolPool(data.symbolTypes, matchable);
        this.symbolCount = matchable;

        const root = this.boardRoot ?? this.node;
        const scale = 1 + data.scale * 0.05;
        root.setScale(scale, scale, 1);

        let poolIdx = 0;
        for (const spawn of this._spawns) {
            const n = this.createDebugTile(spawn, spawn.isSpecial456 ? -1 : this._symbolPool[poolIdx++]);
            root.addChild(n);
            // 高層後加 → 顯示在上；z 僅作微偏移
            n.setPosition(spawn.x, spawn.y, -spawn.floor * 0.01);
            this._tileNodes.push(n);
        }

        this.pause = false;
        console.log(
            `[MatchGame] L${levelId} mode=${mode} tiles=${this._spawns.length} matchable=${matchable} types=${data.symbolTypes}`,
        );
    }

    private createDebugTile(spawn: BoardTileSpawn, symbolId: number): Node {
        const n = new Node(`tile_${spawn.index}_t${spawn.tileType}_s${symbolId}`);
        const ui = n.addComponent(UITransform);
        ui.setContentSize(GameConfig.cellSize - 8, GameConfig.cellSize - 8);
        const g = n.addComponent(Graphics);
        const color = DEBUG_COLORS[spawn.tileType % DEBUG_COLORS.length];
        g.fillColor = color;
        g.rect(-ui.width / 2, -ui.height / 2, ui.width, ui.height);
        g.fill();
        return n;
    }

    private clearBoard(): void {
        for (const n of this._tileNodes) n.destroy();
        this._tileNodes.length = 0;
        this._spawns = [];
        this._symbolPool = [];
    }

    // --- 預留給後續三消 ---
    onWin(): void {
        AudioMgr.inst.playSfx('win');
        EventBus.emit(GameEvents.GAME_WIN);
    }

    onLose(): void {
        AudioMgr.inst.playSfx('lose');
        EventBus.emit(GameEvents.GAME_LOSE);
    }
}

const DEBUG_COLORS = [
    new Color(90, 160, 255, 220),
    new Color(180, 180, 180, 220),
    new Color(120, 200, 255, 220),
    new Color(255, 120, 80, 220),
    new Color(80, 180, 255, 220),
    new Color(140, 140, 140, 220),
    new Color(200, 160, 80, 220),
];
