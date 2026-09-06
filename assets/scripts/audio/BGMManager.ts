import { AudioManager } from './AudioManager';

/** 對齊 Games-S5G-H5-99916：BGM 一律走 BGMManager，勿直接 AudioManager.play BGM key */
export class BGMManager {
    private static instance: BGMManager;
    private allowed = true;
    private bgm = '';
    private bgmVolume = 1;

    public static getInstance(): BGMManager {
        if (!BGMManager.instance) BGMManager.instance = new BGMManager();
        return BGMManager.instance;
    }

    public play(key: string, volume = 1, duration?: number): void {
        if (!this.allowed) {
            this.bgm = key;
            return;
        }
        if (!key) return;
        this.bgmVolume = volume;
        if (this.bgm !== key) {
            AudioManager.getInstance().stop(this.bgm, duration);
            AudioManager.getInstance().play(key, volume, duration);
        } else if (!AudioManager.getInstance().isPlaying(key)) {
            AudioManager.getInstance().play(key, volume, duration);
        }
        this.bgm = key;
    }

    public edit(volume: number, duration?: number): void {
        if (!this.allowed || !this.bgm) return;
        this.bgmVolume = volume;
        AudioManager.getInstance().edit(this.bgm, volume, duration);
    }

    public stop(duration?: number): void {
        if (!this.bgm) return;
        AudioManager.getInstance().stop(this.bgm, duration);
        this.bgm = '';
    }

    public setAllowed(allowed: boolean): void {
        if (this.allowed === allowed) return;
        this.allowed = allowed;
        if (!this.allowed) {
            AudioManager.getInstance().stop(this.bgm, 0.3);
            return;
        }
        if (this.bgm) {
            const key = this.bgm;
            this.bgm = '';
            this.play(key, this.bgmVolume);
        }
    }

    public ready(): void {
        this.play(this.bgm, this.bgmVolume);
    }

    public getCurrent(): string {
        return this.bgm;
    }
}
