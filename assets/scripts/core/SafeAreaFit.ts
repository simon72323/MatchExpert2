import { _decorator, Component, Widget, view, screen, sys } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 安全區適配：以 Widget 對齊 screen.safeAreaRect / CSS env。
 * 建議掛在 Canvas（或全螢幕 UI 根）上。
 */
@ccclass('SafeAreaFit')
export class SafeAreaFit extends Component {
    @property
    applyTop = true;

    @property
    applyBottom = true;

    @property
    applyLeft = true;

    @property
    applyRight = true;

    /** 額外邊距（設計解析度像素） */
    @property
    padding = 0;

    onLoad(): void {
        this.apply();
        view.on('canvas-resize', this.apply, this);
    }

    onDestroy(): void {
        view.off('canvas-resize', this.apply, this);
    }

    apply = (): void => {
        let widget = this.getComponent(Widget);
        if (!widget) widget = this.addComponent(Widget);

        const insets = this.readInsets();
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAbsoluteTop = true;
        widget.isAbsoluteBottom = true;
        widget.isAbsoluteLeft = true;
        widget.isAbsoluteRight = true;
        widget.top = (this.applyTop ? insets.top : 0) + this.padding;
        widget.bottom = (this.applyBottom ? insets.bottom : 0) + this.padding;
        widget.left = (this.applyLeft ? insets.left : 0) + this.padding;
        widget.right = (this.applyRight ? insets.right : 0) + this.padding;
        widget.updateAlignment();
    };

    private readInsets(): { top: number; bottom: number; left: number; right: number } {
        const visible = view.getVisibleSize();
        let top = 0;
        let bottom = 0;
        let left = 0;
        let right = 0;

        try {
            const sa = (screen as unknown as { safeAreaRect?: { x: number; y: number; width: number; height: number } })
                .safeAreaRect;
            const win = screen.windowSize;
            if (sa && win && win.width > 0 && win.height > 0 && visible.width > 0 && visible.height > 0) {
                const sx = visible.width / win.width;
                const sy = visible.height / win.height;
                left = sa.x * sx;
                bottom = sa.y * sy;
                right = (win.width - sa.x - sa.width) * sx;
                top = (win.height - sa.y - sa.height) * sy;
            }
        } catch {
            /* ignore */
        }

        if (!sys.isNative && typeof document !== 'undefined') {
            try {
                const probe = document.createElement('div');
                probe.style.cssText =
                    'position:fixed;visibility:hidden;pointer-events:none;' +
                    'padding-top:env(safe-area-inset-top);' +
                    'padding-bottom:env(safe-area-inset-bottom);' +
                    'padding-left:env(safe-area-inset-left);' +
                    'padding-right:env(safe-area-inset-right);';
                document.body.appendChild(probe);
                const cs = getComputedStyle(probe);
                top = Math.max(top, parseFloat(cs.paddingTop) || 0);
                bottom = Math.max(bottom, parseFloat(cs.paddingBottom) || 0);
                left = Math.max(left, parseFloat(cs.paddingLeft) || 0);
                right = Math.max(right, parseFloat(cs.paddingRight) || 0);
                document.body.removeChild(probe);
            } catch {
                /* ignore */
            }
        }

        return {
            top: Math.max(0, top),
            bottom: Math.max(0, bottom),
            left: Math.max(0, left),
            right: Math.max(0, right),
        };
    }
}
