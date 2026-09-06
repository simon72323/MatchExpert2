import { EventBus, GameEvents } from './EventBus';
import { SaveData } from './SaveData';
import { MatchGame } from '../game/MatchGame';
import { I18n } from './I18n';
import { SdkConfig } from './SdkConfig';
import { NativeBridge } from './NativeBridge';

/** 獎勵廣告 placename（對齊 UnityRewardedAd） */
export type AdRewardPlace =
    | 'loseRevival'
    | 'buyItem'
    | 'openEight'
    | 'openEightLevel'
    | 'getItemSmall'
    | 'getItemCoins'
    | 'winCoin'
    | 'doubleItem';

/**
 * 廣告服務：有 NativeBridge 走真實 SDK，否則（預覽）走 stub。
 * place 名稱與獎勵邏輯保持不變，便於接 Unity Ads / 其他中介。
 */
export class AdsService {
    private static _inst: AdsService | null = null;
    static get inst(): AdsService {
        if (!this._inst) this._inst = new AdsService();
        return this._inst;
    }

    private _busy = false;
    private _inited = false;
    private _winCountSinceInterstitial = 0;

    get busy(): boolean {
        return this._busy;
    }

    get inited(): boolean {
        return this._inited;
    }

    async init(): Promise<void> {
        await SdkConfig.inst.load();
        const cfg = SdkConfig.inst.data.ads;
        const bridge = NativeBridge.inst.ads;
        if (bridge?.init && !SdkConfig.inst.preferStub('ads')) {
            try {
                await Promise.resolve(
                    bridge.init({
                        provider: cfg.provider,
                        testMode: cfg.testMode,
                        gameId: SdkConfig.inst.platformGameId(),
                        rewardedUnitId: SdkConfig.inst.rewardedUnitId(),
                        interstitialUnitId: SdkConfig.inst.interstitialUnitId(),
                    }),
                );
                console.log('[AdsService] native init ok');
            } catch (e) {
                console.warn('[AdsService] native init failed, will stub/fallback', e);
            }
        } else {
            console.log('[AdsService] stub mode (preview or no bridge)');
        }
        this._inited = true;
    }

    /**
     * 顯示獎勵廣告。成功回傳 true 並已執行對應獎勵。
     */
    async showRewarded(place: AdRewardPlace, extra?: { itemId?: number }): Promise<boolean> {
        if (SaveData.inst.data.adsClose) {
            this.grant(place, extra);
            return true;
        }
        if (this._busy) {
            EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('adsBusy'));
            return false;
        }
        this._busy = true;
        EventBus.emit(GameEvents.ADS_LOADING, true);
        try {
            const ok = await this.playRewarded(place);
            if (!ok) {
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('adsFail'));
                return false;
            }
            this.grant(place, extra);
            EventBus.emit(GameEvents.ADS_REWARD, place);
            return true;
        } finally {
            this._busy = false;
            EventBus.emit(GameEvents.ADS_LOADING, false);
        }
    }

    /** 過關後插頁（不擋結算 UI；去廣告用戶跳過） */
    async maybeShowInterstitialOnWin(): Promise<void> {
        await SdkConfig.inst.load();
        const cfg = SdkConfig.inst.data.ads;
        if (!cfg.interstitialEnabled || SaveData.inst.data.adsClose) return;
        this._winCountSinceInterstitial += 1;
        const every = Math.max(1, cfg.interstitialEveryNWins | 0);
        if (this._winCountSinceInterstitial < every) return;
        this._winCountSinceInterstitial = 0;
        if (this._busy) return;

        this._busy = true;
        EventBus.emit(GameEvents.ADS_LOADING, true);
        try {
            await this.playInterstitial();
        } finally {
            this._busy = false;
            EventBus.emit(GameEvents.ADS_LOADING, false);
        }
    }

    private async playRewarded(place: AdRewardPlace): Promise<boolean> {
        await SdkConfig.inst.load();
        const cfg = SdkConfig.inst.data.ads;
        const bridge = NativeBridge.inst.ads;
        if (bridge?.showRewarded && !SdkConfig.inst.preferStub('ads')) {
            try {
                return !!(await bridge.showRewarded(SdkConfig.inst.rewardedUnitId(), place));
            } catch (e) {
                console.warn('[AdsService] native rewarded error', e);
                return false;
            }
        }
        await this.delay(cfg.stubDelaySec);
        return !!cfg.stubAlwaysSucceed;
    }

    private async playInterstitial(): Promise<boolean> {
        await SdkConfig.inst.load();
        const cfg = SdkConfig.inst.data.ads;
        const bridge = NativeBridge.inst.ads;
        if (bridge?.showInterstitial && !SdkConfig.inst.preferStub('ads')) {
            try {
                return !!(await bridge.showInterstitial(SdkConfig.inst.interstitialUnitId()));
            } catch (e) {
                console.warn('[AdsService] native interstitial error', e);
                return false;
            }
        }
        await this.delay(Math.min(0.5, cfg.stubDelaySec));
        console.log('[AdsService] interstitial stub ok');
        return true;
    }

    private grant(place: AdRewardPlace, extra?: { itemId?: number }): void {
        switch (place) {
            case 'loseRevival':
                EventBus.emit(GameEvents.GAME_REVIVAL);
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('revival'));
                break;
            case 'buyItem': {
                SaveData.inst.saveItemAmount(0, 1);
                SaveData.inst.saveItemAmount(1, 1);
                SaveData.inst.saveItemAmount(2, 1);
                EventBus.emit('item_changed');
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('getItem'));
                break;
            }
            case 'openEight':
            case 'openEightLevel':
                if (MatchGame.inst && !MatchGame.inst.eightOpened) {
                    MatchGame.inst.useItemEight();
                } else {
                    MatchGame.pendingOpenEight = true;
                }
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('openEight'));
                EventBus.emit('item_changed');
                break;
            case 'getItemSmall': {
                const id = Math.floor(Math.random() * 3);
                const n = 1 + Math.floor(Math.random() * 2);
                SaveData.inst.saveItemAmount(id, n);
                EventBus.emit('item_changed');
                EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('getItem'));
                break;
            }
            case 'getItemCoins':
            case 'winCoin': {
                const coin = place === 'winCoin' ? 100 : 50;
                SaveData.inst.savePlayerCoin(coin);
                EventBus.emit(GameEvents.COIN_CHANGED, SaveData.inst.data.playerCoin);
                EventBus.emit(GameEvents.SHOW_TIP, `+${coin} coin`);
                break;
            }
            case 'doubleItem':
                SaveData.inst.saveItemAmount(0, 1);
                SaveData.inst.saveItemAmount(1, 1);
                SaveData.inst.saveItemAmount(2, 1);
                EventBus.emit('item_changed');
                break;
            default:
                if (extra?.itemId !== undefined) {
                    SaveData.inst.saveItemAmount(extra.itemId, 1);
                    EventBus.emit('item_changed');
                }
                break;
        }
        console.log('[AdsService] grant', place, extra);
    }

    private delay(sec: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, sec * 1000));
    }
}
