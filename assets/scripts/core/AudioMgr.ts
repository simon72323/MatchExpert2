import { AudioClip, AudioSource, Node, resources, director } from 'cc';
import { SaveData } from './SaveData';

/**
 * 對應 Unity soundM / musicM AudioSource 節點樹。
 * 音檔路徑：assets/audio/sfx|bgm（需在編輯器設為可動態載入，或改放 resources）。
 */
export class AudioMgr {
    private static _inst: AudioMgr | null = null;
    static get inst(): AudioMgr {
        if (!this._inst) this._inst = new AudioMgr();
        return this._inst;
    }

    private _sfx: AudioSource | null = null;
    private _bgm: AudioSource | null = null;
    private _clipCache = new Map<string, AudioClip>();
    private _currentBgm = '';

    attach(host: Node): void {
        let sfxNode = host.getChildByName('AudioSfx');
        if (!sfxNode) {
            sfxNode = new Node('AudioSfx');
            host.addChild(sfxNode);
        }
        this._sfx = sfxNode.getComponent(AudioSource) || sfxNode.addComponent(AudioSource);

        let bgmNode = host.getChildByName('AudioBgm');
        if (!bgmNode) {
            bgmNode = new Node('AudioBgm');
            host.addChild(bgmNode);
        }
        this._bgm = bgmNode.getComponent(AudioSource) || bgmNode.addComponent(AudioSource);
        this._bgm.loop = true;
        director.addPersistRootNode(host);
    }

    playSfx(name: string, volume = 1): void {
        if (!SaveData.inst.data.sound || !this._sfx) return;
        this.loadClip(`audio/sfx/${name}`, (clip) => {
            if (!clip || !this._sfx) return;
            this._sfx.playOneShot(clip, volume);
        });
    }

    playBgm(name: string, volume = 0.6): void {
        if (!this._bgm) return;
        if (this._currentBgm === name && this._bgm.playing) {
            this._bgm.volume = SaveData.inst.data.music ? volume : 0;
            return;
        }
        this.loadClip(`audio/bgm/${name}`, (clip) => {
            if (!clip || !this._bgm) return;
            this._currentBgm = name;
            this._bgm.clip = clip;
            this._bgm.volume = SaveData.inst.data.music ? volume : 0;
            this._bgm.play();
        });
    }

    stopBgm(): void {
        this._bgm?.stop();
        this._currentBgm = '';
    }

    refreshMute(): void {
        if (this._bgm) {
            this._bgm.volume = SaveData.inst.data.music ? 0.6 : 0;
        }
    }

    private loadClip(pathNoExt: string, cb: (clip: AudioClip | null) => void): void {
        const cached = this._clipCache.get(pathNoExt);
        if (cached) {
            cb(cached);
            return;
        }
        // 預設從 resources 載入；若音檔仍在 assets/audio，請在編輯器搬到 resources/audio 或改用 bundle
        resources.load(pathNoExt, AudioClip, (err, clip) => {
            if (err || !clip) {
                cb(null);
                return;
            }
            this._clipCache.set(pathNoExt, clip);
            cb(clip);
        });
    }
}
