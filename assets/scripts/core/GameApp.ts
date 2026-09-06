import { _decorator, Component, Node, Layers, UITransform } from 'cc';
import { SaveData } from './SaveData';
import { LevelRepository } from '../data/LevelRepository';
import { SkinCatalog } from '../data/SkinCatalog';
import { EventBus, GameEvents } from './EventBus';
import { GameConfig, PLAY_MODE } from './GameConfig';
import { UIMgr } from './UIMgr';
import { ResultPop } from '../ui/ResultPop';
import { LevelMapView } from '../ui/LevelMapView';
import { ItemBar } from '../ui/ItemBar';
import { PausePop } from '../ui/PausePop';
import { ShopPop } from '../ui/ShopPop';
import { TipToast } from '../ui/TipToast';
import { LevelPop } from '../ui/LevelPop';
import { AdsLoading } from '../ui/AdsLoading';
import { HelpPop } from '../ui/HelpPop';
import { LoadingView } from '../ui/LoadingView';
import { AudioBootstrap } from '../audio/AudioBootstrap';
import { BGMManager } from '../audio/BGMManager';
import { AudioKey } from '../audio/AudioKey';
import { I18n } from './I18n';
import { SdkConfig } from './SdkConfig';
import { AdsService } from './AdsService';
import { IapService } from './IapService';
import { SafeAreaFit } from './SafeAreaFit';
import { COMMON_UI_PATHS, preloadUiSprites } from '../ui/UiFactory';

const { ccclass, property } = _decorator;
const UI_LAYER = Layers.Enum.UI_2D;

export type AppView = 'loading' | 'map' | 'game';

@ccclass('GameApp')
export class GameApp extends Component {
    static inst: GameApp | null = null;

    @property(Node)
    loadingView: Node | null = null;

    @property(Node)
    levelMapView: Node | null = null;

    @property(Node)
    gameView: Node | null = null;

    @property(Node)
    audioHost: Node | null = null;

    playingLevel = 1;
    /** 固定為簡單難度（PLAY_MODE=0）；普通／困難不進遊戲 */
    levelMode = PLAY_MODE;
    ready = false;

    onLoad(): void {
        GameApp.inst = this;
        console.log('[GameApp] onLoad');

        const host = this.audioHost ?? this.node;
        AudioBootstrap.attachHost(host);

        if (this.loadingView) UIMgr.inst.register('loading', this.loadingView);
        if (this.levelMapView) UIMgr.inst.register('map', this.levelMapView);
        if (this.gameView) UIMgr.inst.register('game', this.gameView);

        this.safeEnsure('ResultPop', () => this.ensureResultPop());
        this.safeEnsure('PausePop', () => this.ensurePausePop());
        this.safeEnsure('ShopPop', () => this.ensureShopPop());
        this.safeEnsure('TipToast', () => this.ensureTipToast());
        this.safeEnsure('LevelPop', () => this.ensureLevelPop());
        this.safeEnsure('AdsLoading', () => this.ensureAdsLoading());
        this.safeEnsure('Help', () => this.ensureHelp());
        this.safeEnsure('LoadingView', () => this.ensureLoadingView());
        this.safeEnsure('LevelMap', () => this.ensureLevelMap());
        this.safeEnsure('ItemBar', () => this.ensureItemBar());
        this.safeEnsure('SafeArea', () => this.ensureSafeArea());

        EventBus.on(GameEvents.GAME_WIN, this.onGameWin as (...a: unknown[]) => void);
        EventBus.on(GameEvents.GAME_LOSE, this.onGameLose as (...a: unknown[]) => void);

        SaveData.inst.load();
        this.playingLevel = Math.min(Math.max(1, SaveData.inst.data.level), GameConfig.levelMax);
        this.showView('loading');
        this.bootstrap();
    }

    private onGameWin = (): void => {
        this.showResult('win');
    };

    private onGameLose = (): void => {
        this.showResult('lose');
    };

    /** 勝負結算（可直接呼叫，不依賴 EventBus） */
    showResult(kind: 'win' | 'lose', _stars = 0): void {
        this.ensureResultPop();
        console.log('[GameApp] show ResultPop', kind, 'inst=', !!ResultPop.inst);
        if (kind === 'win') ResultPop.inst?.show('win');
        else ResultPop.inst?.show('lose');
    }

    private safeEnsure(label: string, fn: () => void): void {
        try {
            fn();
        } catch (e) {
            console.error(`[GameApp] ensure ${label} failed`, e);
        }
    }

    onDestroy(): void {
        EventBus.off(GameEvents.GAME_WIN, this.onGameWin as (...a: unknown[]) => void);
        EventBus.off(GameEvents.GAME_LOSE, this.onGameLose as (...a: unknown[]) => void);
        if (GameApp.inst === this) GameApp.inst = null;
    }

    private ensureResultPop(): void {
        this.ensureCanvasPop('ResultPop', ResultPop);
    }

    private ensurePausePop(): void {
        this.ensureCanvasPop('PausePop', PausePop);
    }

    private ensureShopPop(): void {
        this.ensureCanvasPop('ShopPop', ShopPop);
    }

    private ensureTipToast(): void {
        this.ensureCanvasPop('TipToast', TipToast);
    }

    private ensureLevelPop(): void {
        this.ensureCanvasPop('LevelPop', LevelPop);
    }

    private ensureAdsLoading(): void {
        this.ensureCanvasPop('AdsLoading', AdsLoading);
    }

    private ensureHelp(): void {
        this.ensureCanvasPop('HelpPop', HelpPop);
    }

    private ensureLoadingView(): void {
        if (!this.loadingView) return;
        if (!this.loadingView.getComponent(LoadingView)) {
            this.loadingView.addComponent(LoadingView);
        }
    }

    private findCanvas(): Node {
        const scene = this.node.scene;
        if (!scene) return this.gameView?.parent ?? this.node;
        const direct = scene.getChildByName('Canvas');
        if (direct) return direct;
        const stack: Node[] = [...scene.children];
        while (stack.length) {
            const n = stack.pop()!;
            if (n.name === 'Canvas') return n;
            for (const c of n.children) stack.push(c);
        }
        return this.gameView?.parent ?? this.node;
    }

    private ensureCanvasPop(name: string, Comp: new () => Component): void {
        const host = this.findCanvas();
        let pop = host.getChildByName(name);
        if (!pop) {
            pop = new Node(name);
            pop.layer = UI_LAYER;
            host.addChild(pop);
            pop.addComponent(UITransform).setContentSize(720, 1280);
            pop.setPosition(0, 0, 0);
            pop.addComponent(Comp as never);
        } else if (!pop.getComponent(Comp as never)) {
            pop.addComponent(Comp as never);
        }
    }

    private ensureLevelMap(): void {
        if (!this.levelMapView) return;
        if (!this.levelMapView.getComponent(LevelMapView)) {
            this.levelMapView.addComponent(LevelMapView);
        }
    }

    private ensureItemBar(): void {
        if (!this.gameView) return;
        let bar = this.gameView.getChildByName('__itemBar');
        if (!bar) {
            bar = new Node('__itemBar');
            bar.layer = UI_LAYER;
            this.gameView.addChild(bar);
            bar.addComponent(ItemBar);
        } else if (!bar.getComponent(ItemBar)) {
            bar.addComponent(ItemBar);
        }
    }

    /** Canvas 掛 SafeAreaFit（設計 720×1280） */
    private ensureSafeArea(): void {
        const canvas = this.node;
        if (!canvas.getComponent(UITransform)) {
            canvas.addComponent(UITransform).setContentSize(720, 1280);
        }
        if (!canvas.getComponent(SafeAreaFit)) {
            canvas.addComponent(SafeAreaFit);
        }
    }

    private async bootstrap(): Promise<void> {
        const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T | void> =>
            Promise.race([
                p,
                new Promise<void>((resolve) =>
                    setTimeout(() => {
                        console.warn(`[GameApp] ${label} timeout ${ms}ms, continue`);
                        resolve();
                    }, ms),
                ),
            ]);
        try {
            await withTimeout(I18n.inst.load().catch((e) => console.warn('[GameApp] i18n skip', e)), 5000, 'i18n');
            await withTimeout(preloadUiSprites(COMMON_UI_PATHS).catch((e) => console.warn('[GameApp] ui preload skip', e)), 15000, 'ui');
            await withTimeout(SdkConfig.inst.load().catch((e) => console.warn('[GameApp] sdk_config skip', e)), 4000, 'sdk');
            await withTimeout(AdsService.inst.init().catch((e) => console.warn('[GameApp] ads init skip', e)), 5000, 'ads');
            await withTimeout(IapService.inst.init().catch((e) => console.warn('[GameApp] iap init skip', e)), 5000, 'iap');
            await withTimeout(AudioBootstrap.preloadAll(), 12000, 'audio');
            await LevelRepository.inst.preloadAll();
            if (LevelRepository.inst.easyCount > 0) {
                GameConfig.levelMax = LevelRepository.inst.easyCount;
            }
            await withTimeout(SkinCatalog.inst.preload(), 12000, 'skin');
            this.ready = true;
            EventBus.emit('app_ready');
            console.log('[GameApp] ready → map');
            this.backToMap();
        } catch (e) {
            console.error('[GameApp] bootstrap failed, force map', e);
            this.ready = true;
            this.backToMap();
        }
    }

    showView(view: AppView): void {
        if (this.loadingView) this.loadingView.active = view === 'loading';
        if (this.levelMapView) this.levelMapView.active = view === 'map';
        if (this.gameView) this.gameView.active = view === 'game';

        if (view === 'game') {
            BGMManager.getInstance().play(AudioKey.bgm_game, 0.6);
        } else if (view === 'map') {
            BGMManager.getInstance().play(AudioKey.bgm_map, 0.6);
            this.levelMapView?.getComponent(LevelMapView)?.refresh();
        }
    }

    enterLevel(level: number, _mode = PLAY_MODE): void {
        void level;
        // 線性進度：永遠只開存檔目前關；過關後舊關不可再進
        if (SaveData.inst.data.level > GameConfig.levelMax) {
            this.backToMap();
            return;
        }
        this.playingLevel = Math.max(1, Math.min(SaveData.inst.data.level, GameConfig.levelMax));
        this.levelMode = PLAY_MODE;
        this.showView('game');
        this.scheduleOnce(() => {
            EventBus.emit('enter_level', this.playingLevel, PLAY_MODE);
        }, 0);
    }

    backToMap(): void {
        this.showView('map');
        EventBus.emit(GameEvents.CLOSE_POP);
    }
}
