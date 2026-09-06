import { AudioClip, AudioSource, Node, tween, Tween } from 'cc';

export interface AudioOptions {
    volume?: number;
    duration?: number;
    callback?: Function;
    debounceKey?: string;
    debounceMs?: number;
    isPlayLast?: boolean;
}

/**
 * 對齊 Games-S5G-H5-99916 AudioManager：
 * initialize(audioNode) → register(key, 節點路徑) → play / playOneShot / stop
 */
export class AudioManager {
    private static instance: AudioManager;
    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private soundMap: Map<string, { source: AudioSource; gameVolume: number }> = new Map();
    private audioNode: Node | null = null;
    private isMute = false;
    private systemVolume = 1;
    private isActivate = true;
    private playThrottleMap: Map<string, number> = new Map();
    private _debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    public setIsActivate(isActivate: boolean): void {
        this.isActivate = isActivate;
    }

    public initialize(audioNode: Node): void {
        this.audioNode = audioNode;
    }

    public register(key: string, path: string): void {
        if (!this.isActivate || !this.audioNode) return;
        const node = this.audioNode.getChildByPath(path);
        if (!node) {
            console.warn(`[AudioManager] 找不到節點 = ${path}`);
            return;
        }
        const source = node.getComponent(AudioSource);
        if (!source) {
            console.warn(`[AudioManager] 節點無 AudioSource = ${path}`);
            return;
        }
        if (this.soundMap.has(key)) {
            console.warn(`[AudioManager] 已有 key = ${key}`);
        }
        this.soundMap.set(key, { source, gameVolume: source.volume });
    }

    /** 執行期建立節點並綁 clip（無 audio.prefab 時用） */
    public registerClip(key: string, path: string, clip: AudioClip, loop = false, volume = 1): void {
        if (!this.isActivate || !this.audioNode) return;
        let node = this.audioNode.getChildByPath(path);
        if (!node) {
            const parts = path.split('/');
            let cur = this.audioNode;
            for (const name of parts) {
                let child = cur.getChildByName(name);
                if (!child) {
                    child = new Node(name);
                    cur.addChild(child);
                }
                cur = child;
            }
            node = cur;
        }
        let source = node.getComponent(AudioSource);
        if (!source) source = node.addComponent(AudioSource);
        source.clip = clip;
        source.loop = loop;
        source.playOnAwake = false;
        source.volume = volume;
        this.soundMap.set(key, { source, gameVolume: volume });
    }

    public getClip(key: string): AudioClip | null {
        return this.getItem(key)?.source.clip ?? null;
    }

    public play(key: string, volume = 1, duration?: number, callback?: Function): void {
        if (!this.isActivate) return;
        const item = this.getItem(key);
        if (!item) {
            console.warn(`[AudioManager] 找不到 key = ${key}`);
            return;
        }
        const now = Date.now();
        const last = this.playThrottleMap.get(key);
        if (last && now - last < 50) return;
        this.playThrottleMap.set(key, now);

        const source = item.source;
        Tween.stopAllByTarget(item);
        if (source.playing) source.stop();
        source.node.off(AudioSource.EventType.ENDED);
        if (callback) {
            source.node.once(AudioSource.EventType.ENDED, () => callback(), source);
        }
        source.play();
        if (duration) {
            item.gameVolume = source.volume;
            tween(item)
                .to(
                    duration,
                    { gameVolume: volume },
                    {
                        onUpdate: () => {
                            item.source.volume = item.gameVolume * this.systemVolume;
                        },
                    },
                )
                .start();
        } else {
            item.gameVolume = volume;
            source.volume = item.gameVolume * this.systemVolume;
        }
    }

    public playOneShot(key: string, volume = 1): void {
        if (!this.isActivate) return;
        const item = this.getItem(key);
        if (!item?.source.clip) {
            console.warn(`[AudioManager] 找不到 key = ${key}`);
            return;
        }
        item.source.playOneShot(item.source.clip, volume * this.systemVolume);
    }

    public stop(key: string, duration?: number): void {
        if (!this.isActivate) return;
        const item = this.getItem(key);
        if (!item) return;
        const source = item.source;
        Tween.stopAllByTarget(item);
        if (duration) {
            tween(item)
                .to(
                    duration,
                    { gameVolume: 0 },
                    {
                        onUpdate: () => {
                            item.source.volume = item.gameVolume * this.systemVolume;
                        },
                    },
                )
                .call(() => source.stop())
                .start();
        } else {
            source.stop();
        }
    }

    public setMute(mute: boolean): void {
        this.isMute = mute;
        this.systemVolume = mute ? 0 : 1;
        this.soundMap.forEach((item) => {
            item.source.volume = item.gameVolume * this.systemVolume;
        });
    }

    public getIsMute(): boolean {
        return this.isMute;
    }

    public isPlaying(key: string): boolean {
        return this.getItem(key)?.source.playing ?? false;
    }

    public edit(key: string, volume?: number, duration?: number): void {
        const item = this.getItem(key);
        if (!item) return;
        Tween.stopAllByTarget(item);
        if (duration && volume !== undefined) {
            tween(item)
                .to(
                    duration,
                    { gameVolume: volume },
                    {
                        onUpdate: () => {
                            item.source.volume = item.gameVolume * this.systemVolume;
                        },
                    },
                )
                .start();
        } else if (volume !== undefined) {
            item.gameVolume = volume;
            item.source.volume = item.gameVolume * this.systemVolume;
        }
    }

    public playWith(key: string, options?: AudioOptions): void {
        const debounceKey = options?.debounceKey;
        const volume = options?.volume ?? 1;
        const duration = options?.duration;
        const callback = options?.callback;
        if (debounceKey === undefined) {
            this.play(key, volume, duration, callback);
            return;
        }
        const ms = options?.debounceMs ?? 50;
        if (options?.isPlayLast) {
            const existing = this._debounceTimers.get(debounceKey);
            if (existing) clearTimeout(existing);
            this._debounceTimers.set(
                debounceKey,
                setTimeout(() => {
                    this.play(key, volume, duration, callback);
                    this._debounceTimers.delete(debounceKey);
                }, ms),
            );
        } else {
            if (this._debounceTimers.has(debounceKey)) return;
            this.play(key, volume, duration, callback);
            this._debounceTimers.set(
                debounceKey,
                setTimeout(() => this._debounceTimers.delete(debounceKey), ms),
            );
        }
    }

    public resetDebounce(): void {
        this._debounceTimers.forEach((t) => clearTimeout(t));
        this._debounceTimers.clear();
    }

    public hasKey(key: string): boolean {
        return this.soundMap.has(key);
    }

    private getItem(key: string): { source: AudioSource; gameVolume: number } | null {
        return this.soundMap.get(key) ?? null;
    }
}
