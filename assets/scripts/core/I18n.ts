import { SaveData } from './SaveData';
import { EventBus, GameEvents } from './EventBus';
import { resources, JsonAsset } from 'cc';

const FALLBACK: Record<string, Record<string, string>> = {
    tw: {
        loading: '載入中…',
        startGame: '進入遊戲',
        level: '關卡',
        completeLevel: '完成關卡',
        nextLevel: '下一關',
        replay: '重新開始',
        backToMap: '回地圖',
        revival: '復活',
        failed: '失敗',
        mapTitle: '關卡地圖',
        coinShort: '金幣不足',
        itemBackEmpty: '無可撤回',
        itemNoTarget: '無可用目標',
        pause: '暫停',
        continue: '繼續',
        skinShop: '皮膚商店',
        close: '關閉',
        selected: '使用中',
        useSkin: '使用',
        combo: '連擊',
        modeEasy: '簡單',
        modeNormal: '普通',
        modeHard: '困難',
        modeLocked: '尚未解鎖',
        language: '語系',
        adsBusy: '廣告載入中…',
        adsFail: '廣告播放失敗',
        getItem: '獲得道具',
        openEight: '開啟第8格',
        adsEight: '廣告開第8格',
        gameHelp: '遊戲說明',
        shop: '商店',
        share: '分享成績',
        removeAds: '去除廣告',
        adsRemoved: '已去除廣告',
        shareOk: '已分享',
        shareCopied: '已複製分享文案',
        iapFail: '購買失敗',
        iapRestore: '還原購買',
        iapRestored: '已還原購買',
        iapNothingToRestore: '沒有可還原項目',
        winCoinAd: '廣告領 +100 金幣',
    },
    cn: {
        loading: '载入中…',
        startGame: '进入游戏',
        level: '关卡',
        completeLevel: '完成关卡',
        nextLevel: '下一关',
        replay: '重新开始',
        backToMap: '回地图',
        revival: '复活',
        failed: '失败',
        mapTitle: '关卡地图',
        coinShort: '金币不足',
        itemBackEmpty: '无可撤回',
        itemNoTarget: '无可用目标',
        pause: '暂停',
        continue: '继续',
        skinShop: '皮肤商店',
        close: '关闭',
        selected: '使用中',
        useSkin: '使用',
        combo: '连击',
        modeEasy: '简单',
        modeNormal: '普通',
        modeHard: '困难',
        modeLocked: '尚未解锁',
        language: '语言',
        adsBusy: '广告加载中…',
        adsFail: '广告播放失败',
        getItem: '获得道具',
        openEight: '开启第8格',
        adsEight: '广告开第8格',
        gameHelp: '游戏说明',
        shop: '商店',
        share: '分享成绩',
        removeAds: '去除广告',
        adsRemoved: '已去除广告',
        shareOk: '已分享',
        shareCopied: '已复制分享文案',
        iapFail: '购买失败',
        iapRestore: '恢复购买',
        iapRestored: '已恢复购买',
        iapNothingToRestore: '没有可恢复项目',
        winCoinAd: '广告领 +100 金币',
    },
    en: {
        loading: 'Loading…',
        startGame: 'Start Game',
        level: 'Level',
        completeLevel: 'Level Clear',
        nextLevel: 'Next',
        replay: 'Replay',
        backToMap: 'Map',
        revival: 'Revive',
        failed: 'Failed',
        mapTitle: 'Level Map',
        coinShort: 'Not enough coins',
        itemBackEmpty: 'Nothing to undo',
        itemNoTarget: 'No target',
        pause: 'Pause',
        continue: 'Continue',
        skinShop: 'Skins',
        close: 'Close',
        selected: 'Selected',
        useSkin: 'Use',
        combo: 'Combo',
        modeEasy: 'Easy',
        modeNormal: 'Normal',
        modeHard: 'Hard',
        modeLocked: 'Locked',
        language: 'Language',
        adsBusy: 'Loading ad…',
        adsFail: 'Ad failed',
        getItem: 'Got items',
        openEight: '8th slot unlocked',
        adsEight: 'Ad: +1 slot',
        gameHelp: 'Help',
        shop: 'Shop',
        share: 'Share score',
        removeAds: 'Remove ads',
        adsRemoved: 'Ads removed',
        shareOk: 'Shared',
        shareCopied: 'Share text copied',
        iapFail: 'Purchase failed',
        iapRestore: 'Restore purchases',
        iapRestored: 'Purchases restored',
        iapNothingToRestore: 'Nothing to restore',
        winCoinAd: '+100 coins / AD',
    },
};

type I18nFile = {
    defaultLang?: string;
    langs?: string[];
    strings?: Record<string, Record<string, string>>;
};

/** i18n：內建 FALLBACK，resources/config/i18n.json 可覆蓋 */
export class I18n {
    private static _inst: I18n | null = null;
    static get inst(): I18n {
        if (!this._inst) this._inst = new I18n();
        return this._inst;
    }

    private _strings: Record<string, Record<string, string>> = {
        tw: { ...FALLBACK.tw },
        cn: { ...FALLBACK.cn },
        en: { ...FALLBACK.en },
    };
    private _loaded = false;

    async load(): Promise<void> {
        if (this._loaded) return;
        return new Promise((resolve) => {
            resources.load('config/i18n', JsonAsset, (err, asset) => {
                if (!err && asset?.json) {
                    const data = asset.json as I18nFile;
                    if (data.strings) {
                        for (const lang of Object.keys(data.strings)) {
                            this._strings[lang] = {
                                ...(this._strings[lang] ?? {}),
                                ...FALLBACK[lang],
                                ...data.strings[lang],
                            };
                        }
                    }
                    console.log('[I18n] loaded config/i18n.json langs=', Object.keys(this._strings));
                } else {
                    console.warn('[I18n] use FALLBACK only', err?.message);
                }
                this._loaded = true;
                resolve();
            });
        });
    }

    get lang(): string {
        return SaveData.inst.data.lang || 'tw';
    }

    setLang(lang: string): void {
        SaveData.inst.saveLang(lang);
        EventBus.emit(GameEvents.LANG_CHANGED, lang);
    }

    t(key: string, fallback = ''): string {
        const table = this._strings[this.lang] || this._strings.en;
        return table?.[key] ?? this._strings.en?.[key] ?? this._strings.tw?.[key] ?? (fallback || key);
    }
}
