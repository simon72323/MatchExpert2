import { Node, UITransform, Sprite, Layers, EventTouch, Color, UIOpacity } from 'cc';
import { TileSymbol } from './TileSymbol';
import { TILE_TYPE, GameConfig, TILE_VISUAL } from '../core/GameConfig';

const UI_LAYER = Layers.Enum.UI_2D;
const TILE_SIZE = GameConfig.cellSize;

/**
 * 方塊節點物件池：重開關卡／三消時回收，減少 destroy/GC。
 * shell 結構對齊 Unity creatLevelSymbol：tile → box + icon
 */
export class TilePool {
    private _pool: Node[] = [];
    private _holder: Node;
    private _onClick: (tile: TileSymbol) => void;
    private _pooled = new Set<Node>();

    constructor(holder: Node, onClick: (tile: TileSymbol) => void) {
        this._holder = holder;
        this._onClick = onClick;
        holder.layer = UI_LAYER;
    }

    get size(): number {
        return this._pool.length;
    }

    acquire(): TileSymbol {
        let n = this._pool.pop();
        while (n && (!n.isValid || !this._pooled.has(n))) {
            if (n) this._pooled.delete(n);
            n = this._pool.pop();
        }
        if (n) this._pooled.delete(n);
        if (!n || !n.isValid) {
            n = this.createShell();
        }
        n.active = true;
        n.setScale(1, 1, 1);
        n.setPosition(0, 0, 0);
        // 三消淡出會把 opacity 打到 0，進池後必須還原，否則下一關全透明
        let op = n.getComponent(UIOpacity);
        if (!op) op = n.addComponent(UIOpacity);
        op.opacity = 255;
        this.stripExtras(n);
        this.resetVisualLayout(n);
        const tile = n.getComponent(TileSymbol)!;
        tile.removed = false;
        tile.covered = false;
        tile.place = 'board';
        tile.stoneState = 0;
        tile.symbolId = -1;
        tile.typeId = TILE_TYPE.NORMAL;
        tile.onVisualCover = null;
        tile.onStoneVisual = null;
        return tile;
    }

    recycle(tile: TileSymbol): void {
        const n = tile.node;
        if (!n || !n.isValid) return;
        // 已在池中：避免 clearBoard 二次回收造成同一個 node 被 acquire 兩次
        if (this._pooled.has(n)) {
            n.active = false;
            if (n.parent !== this._holder) n.setParent(this._holder);
            return;
        }
        this.stripExtras(n);
        let op = n.getComponent(UIOpacity);
        if (!op) op = n.addComponent(UIOpacity);
        op.opacity = 255;
        n.active = false;
        n.setParent(this._holder);
        n.setScale(1, 1, 1);
        this._pooled.add(n);
        this._pool.push(n);
    }

    clearAll(): void {
        for (const n of this._pool) {
            if (n?.isValid) n.destroy();
        }
        this._pool = [];
        this._pooled.clear();
    }

    private createShell(): Node {
        const n = new Node('tile_pooled');
        n.layer = UI_LAYER;
        n.addComponent(UITransform).setContentSize(TILE_SIZE, TILE_SIZE);
        n.addComponent(UIOpacity).opacity = 255;

        const boxNode = new Node('box');
        boxNode.layer = UI_LAYER;
        boxNode.addComponent(UITransform).setContentSize(TILE_VISUAL.box.w, TILE_VISUAL.box.h);
        boxNode.setPosition(TILE_VISUAL.box.x, TILE_VISUAL.box.y, 0);
        const boxSp = boxNode.addComponent(Sprite);
        boxSp.sizeMode = Sprite.SizeMode.CUSTOM;
        n.addChild(boxNode);

        const iconNode = new Node('icon');
        iconNode.layer = UI_LAYER;
        iconNode.addComponent(UITransform).setContentSize(TILE_VISUAL.icon.w, TILE_VISUAL.icon.h);
        iconNode.setPosition(TILE_VISUAL.icon.x, TILE_VISUAL.icon.y, 0);
        const iconSp = iconNode.addComponent(Sprite);
        iconSp.sizeMode = Sprite.SizeMode.CUSTOM;
        n.addChild(iconNode);

        n.addComponent(TileSymbol);
        n.on(
            Node.EventType.TOUCH_END,
            (e: EventTouch) => {
                e.propagationStopped = true;
                const t = n.getComponent(TileSymbol);
                if (t) this._onClick(t);
            },
            this,
        );
        n.setParent(this._holder);
        n.active = false;
        return n;
    }

    /** 每次取出時重設 box／icon 尺寸與偏移（對齊 Unity） */
    private resetVisualLayout(n: Node): void {
        n.getComponent(UITransform)?.setContentSize(TILE_SIZE, TILE_SIZE);
        const box = n.getChildByName('box');
        if (box) {
            box.setPosition(TILE_VISUAL.box.x, TILE_VISUAL.box.y, 0);
            box.getComponent(UITransform)?.setContentSize(TILE_VISUAL.box.w, TILE_VISUAL.box.h);
        }
        const icon = n.getChildByName('icon');
        if (icon) {
            icon.setPosition(TILE_VISUAL.icon.x, TILE_VISUAL.icon.y, 0);
            icon.getComponent(UITransform)?.setContentSize(TILE_VISUAL.icon.w, TILE_VISUAL.icon.h);
        }
    }

    private stripExtras(n: Node): void {
        for (const name of ['overlay', 'hide', 'dim']) {
            const c = n.getChildByName(name);
            if (c?.isValid) c.destroy();
        }
        const box = n.getChildByName('box')?.getComponent(Sprite);
        const icon = n.getChildByName('icon')?.getComponent(Sprite);
        if (box) {
            box.spriteFrame = null;
            box.color = Color.WHITE;
        }
        if (icon) {
            icon.spriteFrame = null;
            icon.color = Color.WHITE;
        }
    }
}
