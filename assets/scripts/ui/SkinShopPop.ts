import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/**
 * 皮膚商店已移除（刻意不做）。
 * 保留空元件類別，避免場景／舊引用編譯失敗。
 */
@ccclass('SkinShopPop')
export class SkinShopPop extends Component {
    static get inst(): SkinShopPop | null {
        return null;
    }

    onLoad(): void {
        this.node.active = false;
    }
}
