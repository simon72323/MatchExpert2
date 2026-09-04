import { _decorator, Component } from 'cc';
import { GameApp } from './core/GameApp';

const { ccclass } = _decorator;

/**
 * 場景入口：建議在 Canvas 或常駐節點同時掛 GameApp。
 * 保留此檔以相容既有 scripts/main.ts 引用。
 */
@ccclass('main')
export class main extends Component {
    start() {
        if (!GameApp.inst) {
            console.warn('[main] 請在場景掛上 GameApp 元件並綁定 loading/map/game 節點');
        }
    }
}
