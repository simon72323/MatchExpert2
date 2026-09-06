/**
 * 預覽／除錯用：在瀏覽器 Console 注入假原生 SDK，驗證非 stub 路徑。
 * 例：先執行本檔邏輯，再把 sdk_config 的 useStubInPreview 設 false（僅建議本機測）。
 */
(function installMatchExpertSdkMock() {
    const g = typeof globalThis !== 'undefined' ? globalThis : window;
    g.MatchExpertSdk = {
        ads: {
            init: async (cfg) => {
                console.log('[MockAds] init', cfg);
                return true;
            },
            showRewarded: async (unitId, place) => {
                console.log('[MockAds] rewarded', unitId, place);
                await new Promise((r) => setTimeout(r, 500));
                return true;
            },
            showInterstitial: async (unitId) => {
                console.log('[MockAds] interstitial', unitId);
                await new Promise((r) => setTimeout(r, 400));
                return true;
            },
        },
        iap: {
            init: async (skus) => console.log('[MockIap] init', skus),
            purchase: async (sku) => {
                console.log('[MockIap] purchase', sku);
                return { ok: true, productId: sku };
            },
            restore: async () => {
                console.log('[MockIap] restore');
                return [];
            },
            getPrice: () => '$2.99',
        },
        share: {
            share: async (payload) => {
                console.log('[MockShare]', payload);
                return true;
            },
        },
    };
    console.log('[MatchExpertSdk] mock installed');
})();
