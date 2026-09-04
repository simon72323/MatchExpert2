import { resources, JsonAsset } from 'cc';
import { SaveData } from './SaveData';
import { EventBus, GameEvents } from './EventBus';

interface I18nJson {
    defaultLang: string;
    langs: string[];
    strings: Record<string, Record<string, string>>;
}

export class I18n {
    private static _inst: I18n | null = null;
    static get inst(): I18n {
        if (!this._inst) this._inst = new I18n();
        return this._inst;
    }

    private _data: I18nJson | null = null;

    async load(): Promise<void> {
        return new Promise((resolve, reject) => {
            resources.load('config/i18n', JsonAsset, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error('i18n load failed'));
                    return;
                }
                this._data = asset.json as I18nJson;
                resolve();
            });
        });
    }

    get lang(): string {
        return SaveData.inst.data.lang || this._data?.defaultLang || 'tw';
    }

    setLang(lang: string): void {
        SaveData.inst.saveLang(lang);
        EventBus.emit(GameEvents.LANG_CHANGED, lang);
    }

    t(key: string, fallback = ''): string {
        if (!this._data) return fallback || key;
        const table = this._data.strings[this.lang] || this._data.strings.en;
        return table?.[key] ?? this._data.strings.en?.[key] ?? (fallback || key);
    }
}
