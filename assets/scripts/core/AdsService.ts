/**
 * 廣告服務 stub（對應 Unity Ads / Rewarded）
 * 後續接各平台 SDK，對局與商店先呼叫此介面。
 */
export class AdsService {
    private static _inst: AdsService | null = null;
    static get inst(): AdsService {
        if (!this._inst) this._inst = new AdsService();
        return this._inst;
    }

    async showRewarded(): Promise<boolean> {
        console.warn('[AdsService] rewarded stub → grant');
        return true;
    }

    showBanner(): void {
        // stub
    }

    hideBanner(): void {
        // stub
    }
}
