type Handler = (...args: unknown[]) => void;

/** 簡易事件匯流排，解耦 UI / 對局 / 存檔 */
export class EventBus {
    private static _map = new Map<string, Set<Handler>>();

    static on(event: string, handler: Handler): void {
        if (!this._map.has(event)) this._map.set(event, new Set());
        this._map.get(event)!.add(handler);
    }

    static off(event: string, handler: Handler): void {
        this._map.get(event)?.delete(handler);
    }

    static emit(event: string, ...args: unknown[]): void {
        const set = this._map.get(event);
        if (!set) return;
        for (const h of [...set]) h(...args);
    }

    static clear(): void {
        this._map.clear();
    }
}

export const GameEvents = {
    COIN_CHANGED: 'coin_changed',
    LEVEL_CHANGED: 'level_changed',
    SOUND_CHANGED: 'sound_changed',
    MUSIC_CHANGED: 'music_changed',
    LANG_CHANGED: 'lang_changed',
    SHOW_TIP: 'show_tip',
    GAME_WIN: 'game_win',
    GAME_LOSE: 'game_lose',
    OPEN_POP: 'open_pop',
    CLOSE_POP: 'close_pop',
} as const;
