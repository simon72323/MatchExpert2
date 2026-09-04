import { _decorator, Component, Node } from 'cc';
import { SaveData } from './SaveData';
import { AudioMgr } from './AudioMgr';
import { I18n } from './I18n';
import { LevelRepository } from '../data/LevelRepository';
import { EventBus, GameEvents } from './EventBus';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

export type AppView = 'loading' | 'map' | 'game';

/**
 * 對應 Unity MatchExpertMain：統一管理視圖切換與全域狀態。
 * 請在主場景掛到常駐節點上，並綁定各視圖根節點。
 */
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
    levelMode = 0; // 0 easy / 1 normal / 2 hard
    ready = false;

    onLoad(): void {
        GameApp.inst = this;
        if (this.audioHost) AudioMgr.inst.attach(this.audioHost);
        else AudioMgr.inst.attach(this.node);

        SaveData.inst.load();
        this.playingLevel = Math.min(SaveData.inst.data.level, GameConfig.levelMax);
        this.showView('loading');
        this.bootstrap();
    }

    onDestroy(): void {
        if (GameApp.inst === this) GameApp.inst = null;
    }

    private async bootstrap(): Promise<void> {
        try {
            await Promise.all([
                I18n.inst.load().catch(() => undefined),
                LevelRepository.inst.preloadAll(),
            ]);
            this.ready = true;
            EventBus.emit('app_ready');
            // MVP：地圖 UI 尚未完成，先直接進第 1 關方便預覽桌面生成
            // 地圖做好後改回 showView('map')
            this.enterLevel(1, 0);
            // this.showView('map');
            // AudioMgr.inst.playBgm('bg_NeckPillow');
        } catch (e) {
            console.error('[GameApp] bootstrap failed', e);
        }
    }

    showView(view: AppView): void {
        if (this.loadingView) this.loadingView.active = view === 'loading';
        if (this.levelMapView) this.levelMapView.active = view === 'map';
        if (this.gameView) this.gameView.active = view === 'game';

        if (view === 'game') {
            AudioMgr.inst.playBgm('BGM__Brain_Trust__Wayne_Jones');
        } else if (view === 'map') {
            AudioMgr.inst.playBgm('bg_NeckPillow');
        }
    }

    enterLevel(level: number, mode = 0): void {
        this.playingLevel = level;
        this.levelMode = mode;
        this.showView('game');
        EventBus.emit('enter_level', level, mode);
    }

    backToMap(): void {
        this.showView('map');
        EventBus.emit(GameEvents.CLOSE_POP);
    }
}
