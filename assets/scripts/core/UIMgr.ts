import { Node } from 'cc';

/** 簡易 UI 視圖管理（對齊階段 2 規劃的 UIMgr） */
export class UIMgr {
    private static _inst: UIMgr | null = null;
    static get inst(): UIMgr {
        if (!this._inst) this._inst = new UIMgr();
        return this._inst;
    }

    private _views = new Map<string, Node>();

    register(name: string, node: Node): void {
        this._views.set(name, node);
    }

    show(name: string, exclusive = false): void {
        if (exclusive) {
            for (const [key, node] of this._views) {
                node.active = key === name;
            }
            return;
        }
        const n = this._views.get(name);
        if (n) n.active = true;
    }

    hide(name: string): void {
        const n = this._views.get(name);
        if (n) n.active = false;
    }

    get(name: string): Node | null {
        return this._views.get(name) ?? null;
    }
}
