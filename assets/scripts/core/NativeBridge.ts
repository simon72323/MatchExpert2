/**
 * 原生／H5 插件橋接。
 *
 * 原生端（或注入的 JS 橋）請掛到：
 *   globalThis.MatchExpertSdk = { ads, iap, share }
 *
 * 或透過 `jsb.bridge` / 自訂 plugin 實作同名方法。
 * 預覽無橋時回傳 null，上層改走 stub。
 */

export type NativeAdsApi = {
    init?: (cfg: Record<string, unknown>) => Promise<boolean> | boolean;
    showRewarded?: (unitId: string, place: string) => Promise<boolean>;
    showInterstitial?: (unitId: string) => Promise<boolean>;
};

export type NativeIapApi = {
    init?: (skus: string[]) => Promise<void> | void;
    purchase?: (sku: string) => Promise<{ ok: boolean; productId?: string } | boolean>;
    restore?: () => Promise<string[]>;
    getPrice?: (sku: string) => string | null | undefined;
};

export type NativeShareApi = {
    share?: (payload: { title: string; text: string; url?: string }) => Promise<boolean>;
};

export type MatchExpertSdk = {
    ads?: NativeAdsApi;
    iap?: NativeIapApi;
    share?: NativeShareApi;
};

declare global {
    // eslint-disable-next-line no-var
    var MatchExpertSdk: MatchExpertSdk | undefined;
}

export class NativeBridge {
    private static _inst: NativeBridge | null = null;
    static get inst(): NativeBridge {
        if (!this._inst) this._inst = new NativeBridge();
        return this._inst;
    }

    get sdk(): MatchExpertSdk | null {
        const g = globalThis as typeof globalThis & { MatchExpertSdk?: MatchExpertSdk };
        if (g.MatchExpertSdk) return g.MatchExpertSdk;
        // 部分原生殼會掛在 window
        const w = typeof window !== 'undefined' ? (window as Window & { MatchExpertSdk?: MatchExpertSdk }) : null;
        return w?.MatchExpertSdk ?? null;
    }

    get ads(): NativeAdsApi | null {
        return this.sdk?.ads ?? null;
    }

    get iap(): NativeIapApi | null {
        return this.sdk?.iap ?? null;
    }

    get share(): NativeShareApi | null {
        return this.sdk?.share ?? null;
    }

    hasAds(): boolean {
        return !!(this.ads?.showRewarded);
    }

    hasIap(): boolean {
        return !!(this.iap?.purchase);
    }

    hasShare(): boolean {
        return !!(this.share?.share);
    }
}
