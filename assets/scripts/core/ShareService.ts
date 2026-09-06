import { sys } from 'cc';
import { EventBus, GameEvents } from './EventBus';
import { I18n } from './I18n';
import { SdkConfig } from './SdkConfig';
import { NativeBridge } from './NativeBridge';

/**
 * 分享：優先 NativeBridge → Web Share API → 剪貼簿 → localStorage 備份。
 */
export class ShareService {
    private static _inst: ShareService | null = null;
    static get inst(): ShareService {
        if (!this._inst) this._inst = new ShareService();
        return this._inst;
    }

    async shareScore(level: number, _stars = 0): Promise<boolean> {
        await SdkConfig.inst.load();
        const cfg = SdkConfig.inst.data.share;
        const text = `${cfg.title} — Level ${level} ${cfg.hashtag}`.trim();
        return this.share({ title: cfg.title, text, url: cfg.url });
    }

    async shareText(text: string): Promise<boolean> {
        await SdkConfig.inst.load();
        const cfg = SdkConfig.inst.data.share;
        return this.share({ title: cfg.title, text, url: cfg.url });
    }

    private async share(payload: { title: string; text: string; url?: string }): Promise<boolean> {
        const bridge = NativeBridge.inst.share;
        if (bridge?.share) {
            try {
                const ok = await bridge.share(payload);
                if (ok) {
                    EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('shareOk'));
                    return true;
                }
            } catch {
                /* fall through */
            }
        }

        try {
            const nav =
                typeof navigator !== 'undefined'
                    ? (navigator as Navigator & {
                          share?: (d: ShareData) => Promise<void>;
                          canShare?: (d: ShareData) => boolean;
                      })
                    : null;
            if (nav?.share) {
                const data: ShareData = { title: payload.title, text: payload.text };
                if (payload.url) data.url = payload.url;
                if (!nav.canShare || nav.canShare(data)) {
                    await nav.share(data);
                    EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('shareOk'));
                    return true;
                }
            }
        } catch (e) {
            // 使用者取消 share 不算失敗提示
            const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
            if (name === 'AbortError') return false;
        }

        const full = payload.url ? `${payload.text}\n${payload.url}` : payload.text;
        if (await this.copyToClipboard(full)) {
            EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('shareCopied'));
            return true;
        }

        try {
            sys.localStorage.setItem('MatchExpert2_LastShare', full);
        } catch {
            /* ignore */
        }
        EventBus.emit(GameEvents.SHOW_TIP, I18n.inst.t('shareCopied'));
        console.log('[ShareService]', full);
        return true;
    }

    private async copyToClipboard(text: string): Promise<boolean> {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {
            /* ignore */
        }
        // 舊瀏覽器 fallback
        try {
            if (typeof document === 'undefined') return false;
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}
