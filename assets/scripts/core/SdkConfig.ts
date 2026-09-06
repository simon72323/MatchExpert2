import { resources, JsonAsset, sys } from 'cc';

export type IapProductDef = {
    androidSku: string;
    iosSku: string;
    displayPrice: string;
    nonConsumable?: boolean;
};

export type SdkConfigData = {
    ads: {
        provider: string;
        testMode: boolean;
        useStubInPreview: boolean;
        stubDelaySec: number;
        stubAlwaysSucceed: boolean;
        androidGameId: string;
        iosGameId: string;
        rewardedAndroid: string;
        rewardedIos: string;
        interstitialAndroid: string;
        interstitialIos: string;
        interstitialEveryNWins: number;
        interstitialEnabled: boolean;
    };
    iap: {
        useStubInPreview: boolean;
        stubDelaySec: number;
        products: Record<string, IapProductDef>;
    };
    share: {
        title: string;
        url: string;
        hashtag: string;
    };
};

const DEFAULTS: SdkConfigData = {
    ads: {
        provider: 'unity',
        testMode: true,
        useStubInPreview: true,
        stubDelaySec: 0.8,
        stubAlwaysSucceed: true,
        androidGameId: 'YOUR_UNITY_ANDROID_GAME_ID',
        iosGameId: 'YOUR_UNITY_IOS_GAME_ID',
        rewardedAndroid: 'Rewarded_Android',
        rewardedIos: 'Rewarded_iOS',
        interstitialAndroid: 'Interstitial_Android',
        interstitialIos: 'Interstitial_iOS',
        interstitialEveryNWins: 2,
        interstitialEnabled: true,
    },
    iap: {
        useStubInPreview: true,
        stubDelaySec: 0.6,
        products: {
            remove_ads: {
                androidSku: 'remove_ads',
                iosSku: 'remove_ads',
                displayPrice: '$2.99',
                nonConsumable: true,
            },
        },
    },
    share: {
        title: 'Match Expert',
        url: 'https://example.com/match-expert',
        hashtag: '#MatchExpert',
    },
};

/**
 * 集中讀取 `resources/config/sdk_config.json`。
 * 真機填入 GameId／SKU 後，Ads／IAP 會走 NativeBridge；預覽預設 stub。
 */
export class SdkConfig {
    private static _inst: SdkConfig | null = null;
    static get inst(): SdkConfig {
        if (!this._inst) this._inst = new SdkConfig();
        return this._inst;
    }

    private _data: SdkConfigData = structuredClone(DEFAULTS);
    private _loaded = false;

    get data(): SdkConfigData {
        return this._data;
    }

    get loaded(): boolean {
        return this._loaded;
    }

    async load(): Promise<void> {
        if (this._loaded) return;
        try {
            const asset = await new Promise<JsonAsset | null>((resolve) => {
                resources.load('config/sdk_config', JsonAsset, (err, json) => {
                    if (err || !json) resolve(null);
                    else resolve(json);
                });
            });
            if (asset?.json) {
                this._data = this.merge(DEFAULTS, asset.json as Partial<SdkConfigData>);
            }
        } catch (e) {
            console.warn('[SdkConfig] load failed, using defaults', e);
        }
        this._loaded = true;
        console.log('[SdkConfig] ready', {
            provider: this._data.ads.provider,
            testMode: this._data.ads.testMode,
            isNative: this.isNativeRuntime(),
        });
    }

    isNativeRuntime(): boolean {
        return sys.isNative;
    }

    /** 預覽／瀏覽器且設定允許 stub 時走模擬 */
    preferStub(kind: 'ads' | 'iap'): boolean {
        if (kind === 'ads') {
            return !this.isNativeRuntime() && this._data.ads.useStubInPreview;
        }
        return !this.isNativeRuntime() && this._data.iap.useStubInPreview;
    }

    platformGameId(): string {
        return sys.os === sys.OS.IOS ? this._data.ads.iosGameId : this._data.ads.androidGameId;
    }

    rewardedUnitId(): string {
        return sys.os === sys.OS.IOS ? this._data.ads.rewardedIos : this._data.ads.rewardedAndroid;
    }

    interstitialUnitId(): string {
        return sys.os === sys.OS.IOS ? this._data.ads.interstitialIos : this._data.ads.interstitialAndroid;
    }

    productSku(productId: string): string {
        const p = this._data.iap.products[productId];
        if (!p) return productId;
        return sys.os === sys.OS.IOS ? p.iosSku : p.androidSku;
    }

    private merge(base: SdkConfigData, patch: Partial<SdkConfigData>): SdkConfigData {
        return {
            ads: { ...base.ads, ...(patch.ads ?? {}) },
            iap: {
                ...base.iap,
                ...(patch.iap ?? {}),
                products: { ...base.iap.products, ...(patch.iap?.products ?? {}) },
            },
            share: { ...base.share, ...(patch.share ?? {}) },
        };
    }
}

function structuredClone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}
