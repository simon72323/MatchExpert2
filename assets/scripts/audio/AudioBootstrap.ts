import { AudioClip, Node, resources, director } from 'cc';
import { AudioManager } from './AudioManager';
import { AudioKey } from './AudioKey';
import { BGMManager } from './BGMManager';
import { SaveData } from '../core/SaveData';

type RegRow = { key: AudioKey; path: string; res: string; loop?: boolean; volume?: number };

/** 實際會播到的音檔（resources/audio/...） */
const REGISTRY: RegRow[] = [
    { key: AudioKey.btnClick, path: 'game_sfx/btnClick', res: 'audio/sfx/btnClick' },
    { key: AudioKey.btnClose, path: 'game_sfx/btnClose', res: 'audio/sfx/btnClose' },
    { key: AudioKey.hitError, path: 'game_sfx/hitError', res: 'audio/sfx/hitError' },
    // Unity 曾用 boxTouch；資源若無則退回 btnTouch
    { key: AudioKey.boxTouch, path: 'game_sfx/boxTouch', res: 'audio/sfx/btnTouch' },
    { key: AudioKey.fireHit, path: 'game_sfx/fireHit', res: 'audio/sfx/fireHit' },
    { key: AudioKey.stoneHit, path: 'game_sfx/stoneHit', res: 'audio/sfx/stoneHit' },
    { key: AudioKey.iceHit, path: 'game_sfx/iceHit', res: 'audio/sfx/iceHit' },
    { key: AudioKey.UI_Drag_PutIn, path: 'game_sfx/UI_Drag_PutIn', res: 'audio/sfx/UI_Drag_PutIn' },
    { key: AudioKey.hideOpen, path: 'game_sfx/hideOpen', res: 'audio/sfx/hideOpen' },
    { key: AudioKey.matchAllTile, path: 'game_sfx/matchAllTile', res: 'audio/sfx/matchAllTile' },
    { key: AudioKey.boxBomb, path: 'game_sfx/boxBomb', res: 'audio/sfx/btnBomb' },
    { key: AudioKey.tip, path: 'game_sfx/tip', res: 'audio/sfx/tip' },
    { key: AudioKey.win, path: 'game_sfx/win', res: 'audio/sfx/win' },
    { key: AudioKey.lose, path: 'game_sfx/lose', res: 'audio/sfx/lose' },
    {
        key: AudioKey.bgm_game,
        path: 'game_bgm/bgm_game',
        res: 'audio/bgm/BGM__Brain_Trust__Wayne_Jones',
        loop: true,
        volume: 0.6,
    },
    {
        key: AudioKey.bgm_map,
        path: 'game_bgm/bgm_map',
        res: 'audio/bgm/bg_NeckPillow',
        loop: true,
        volume: 0.6,
    },
];

/**
 * 對齊 S5G Game.registerAudio：initialize → 建節點／載 clip → register。
 * MatchExpert2 無 audio.prefab，改由 resources 載入後 registerClip。
 */
export class AudioBootstrap {
    private static _ready = false;

    static get ready(): boolean {
        return this._ready;
    }

    static attachHost(host: Node): void {
        director.addPersistRootNode(host);
        AudioManager.getInstance().initialize(host);
    }

    static async preloadAll(): Promise<void> {
        const am = AudioManager.getInstance();
        await Promise.all(
            REGISTRY.map(
                (row) =>
                    new Promise<void>((resolve) => {
                        resources.load(row.res, AudioClip, (err, clip) => {
                            if (err || !clip) {
                                console.warn(`[AudioBootstrap] load fail ${row.res}`, err?.message);
                                resolve();
                                return;
                            }
                            am.registerClip(row.key, row.path, clip, !!row.loop, row.volume ?? 1);
                            resolve();
                        });
                    }),
            ),
        );
        this._ready = true;
        this.refreshMuteFromSave();
        console.log('[AudioBootstrap] registered', REGISTRY.length);
    }

    static refreshMuteFromSave(): void {
        BGMManager.getInstance().setAllowed(!!SaveData.inst.data.music);
    }
}

/** SFX：尊重存檔 sound 開關（BGM 走 BGMManager） */
export function playSfx(key: AudioKey | string, volume = 1): void {
    if (!SaveData.inst.data.sound) return;
    AudioManager.getInstance().playOneShot(key, volume);
}
