import { EventBus, GameEvents } from './EventBus';
import { SaveData } from './SaveData';
import { I18n } from './I18n';
import { SdkConfig } from './SdkConfig';
import { NativeBridge } from './NativeBridge';

/** 內購商品 id */
export type IapProductId = 'remove_ads';

/**
 * 內購：有 NativeBridge 走商店；預覽走 stub。
 * 支援 restorePurchases（非消耗型去廣告）。
 */
export class IapService {
    private static _inst: IapService | null = null;
    static get inst(): IapService {
        if (!this._inst) this._inst = new IapService();
        return this._inst;
    }

    private _inited = false;
    private _busy = false;

    get inited(): boolean {
        return this._inited;
    }

    get prices(): Record<IapProductId, string> {
        const cfg = SdkConfig.inst.data.iap.products;
        const native = NativeBridge.inst.iap;
        const out = {} as Record<IapProductId, string>;
        (Object.keys(cfg) as IapProductId[]).forEach((id) => {
            const sku = SdkConfig.inst.productSku(id);
            const fromNative = native?.getPrice?.(sku);
            out[id] = fromNative || cfg[id]?.displayPrice || '$?.??';
        });
        return out;
    }

    async init(): Promise<void> {
        await SdkConfig.inst.load();
        const products = SdkConfig.inst.data.iap.products;
        const skus = Object.keys(products).map((id) => SdkConfig.inst.productSku(id));
        const bridge = NativeBridge.inst.iap;
        if (bridge?.init && !SdkConfig.inst.preferStub('iap')) {
            try {
                await Promise.resolve(bridge.init(skus));
                console.log('[IapService] native init ok', skus);
            } catch (e) {
                console.warn('[IapService] native init failed', e);
            }
        } else {
            console.log('[IapService] stub mode');
        }
        this._inited = true;
        // 啟動時嘗試還原（僅原生）
        if (!SdkConfig.inst.preferStub('iap') && bridge?.restore) {
            await this.restorePurchases(true);
        }
    }

    async purchase(productId: IapProductId): Promise<boolean> {
        if (this._busy) {
            EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('adsBusy'));
            return false;
        }
        if (this.isOwned(productId)) {
            EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('adsRemoved'));
            return true;
        }

        await SdkConfig.inst.load();
        this._busy = true;
        EventBus.emit(GameEvents.ADS_LOADING, true);
        try {
            const ok = await this.doPurchase(productId);
            if (!ok) {
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('iapFail'));
                return false;
            }
            this.applyEntitlement(productId);
            return true;
        } finally {
            this._busy = false;
            EventBus.emit(GameEvents.ADS_LOADING, false);
        }
    }

    /** 還原購買；silent=true 時失敗不彈 tip */
    async restorePurchases(silent = false): Promise<boolean> {
        await SdkConfig.inst.load();
        const bridge = NativeBridge.inst.iap;

        if (SdkConfig.inst.preferStub('iap') || !bridge?.restore) {
            // 預覽：若本地已有去廣告則視為成功
            if (SaveData.inst.data.adsClose) {
                if (!silent) EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('iapRestored'));
                return true;
            }
            if (!silent) EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('iapNothingToRestore'));
            return false;
        }

        EventBus.emit(GameEvents.ADS_LOADING, true);
        try {
            const owned = await bridge.restore();
            let any = false;
            for (const raw of owned ?? []) {
                const id = this.resolveProductId(raw);
                if (id) {
                    this.applyEntitlement(id, true);
                    any = true;
                }
            }
            if (!silent) {
                EventBus.emit(
                    GameEvents.SHOW_TIP,
                    any ? I18n.inst.t('iapRestored') : I18n.inst.t('iapNothingToRestore'),
                );
            }
            return any;
        } catch (e) {
            console.warn('[IapService] restore failed', e);
            if (!silent) EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('iapFail'));
            return false;
        } finally {
            EventBus.emit(GameEvents.ADS_LOADING, false);
        }
    }

    isOwned(productId: IapProductId): boolean {
        if (productId === 'remove_ads') return !!SaveData.inst.data.adsClose;
        return false;
    }

    private async doPurchase(productId: IapProductId): Promise<boolean> {
        const cfg = SdkConfig.inst.data.iap;
        const bridge = NativeBridge.inst.iap;
        const sku = SdkConfig.inst.productSku(productId);

        if (bridge?.purchase && !SdkConfig.inst.preferStub('iap')) {
            try {
                const res = await bridge.purchase(sku);
                if (typeof res === 'boolean') return res;
                return !!res?.ok;
            } catch (e) {
                console.warn('[IapService] native purchase error', e);
                return false;
            }
        }

        await new Promise((r) => setTimeout(r, (cfg.stubDelaySec || 0.6) * 1000));
        console.log('[IapService] stub purchase', productId, sku);
        return true;
    }

    private applyEntitlement(productId: IapProductId, fromRestore = false): void {
        if (productId === 'remove_ads') {
            SaveData.inst.saveAdsClose(true);
            if (!fromRestore) {
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('adsRemoved'));
            }
            EventBus.emit(GameEvents.IAP_CHANGED, productId);
            console.log('[IapService] entitlement', productId, fromRestore ? '(restore)' : '(purchase)');
        }
    }

    private resolveProductId(skuOrId: string): IapProductId | null {
        if (skuOrId === 'remove_ads') return 'remove_ads';
        const products = SdkConfig.inst.data.iap.products;
        for (const id of Object.keys(products) as IapProductId[]) {
            const p = products[id];
            if (p.androidSku === skuOrId || p.iosSku === skuOrId) return id;
        }
        return null;
    }
}
