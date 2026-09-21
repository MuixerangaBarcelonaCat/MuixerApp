/** How long a finger must stay on a node before it counts as a long press. */
export const LONG_PRESS_MS = 500;

/** How far the finger may drift before it is a scroll / pan instead of a press. */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/**
 * How long after the finger is lifted the browser's follow-ups (the emulated click, Android's
 * `contextmenu`) are still treated as part of the same touch.
 */
const TOUCH_TAIL_MS = 700;

/**
 * Long-press detection for touch. The web has no `longpress` event, and iOS Safari never fires
 * `contextmenu` on a long press, so it is built from a timer over the touch's start / move / end.
 * Renderer-agnostic: the canvas (Konva touch events) and the tronc view (DOM pointer events)
 * both feed it coordinates.
 *
 * Besides timing it deals with the two ways the browser gets in the way:
 * - Android also fires a native `contextmenu` around the moment the timer would fire →
 *   `absorbNativeContextMenu()` makes sure the gesture is reported exactly once.
 * - Lifting the finger after a long press still produces a click → `swallowsClick()` lets the
 *   renderer ignore it, otherwise it would immediately act on the node that was just long-pressed.
 */
export class LongPressDetector {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private origin: { x: number; y: number } | null = null;
  private onLongPress: (() => void) | null = null;
  private down = false;
  private fired = false;
  private lastTouchAt = 0;

  /** A finger went down: (re)starts waiting. `onLongPress` runs if it stays put for `LONG_PRESS_MS`. */
  start(x: number, y: number, onLongPress: () => void): void {
    this.clearTimer();
    this.origin = { x, y };
    this.onLongPress = onLongPress;
    this.down = true;
    this.fired = false;
    this.lastTouchAt = Date.now();
    this.timer = setTimeout(() => this.fire(), LONG_PRESS_MS);
  }

  /** The finger moved: too far from where it started means a scroll or pan, not a press. */
  move(x: number, y: number): void {
    if (!this.timer || !this.origin) return;
    if (Math.hypot(x - this.origin.x, y - this.origin.y) > LONG_PRESS_MOVE_TOLERANCE_PX) {
      this.clearTimer();
    }
  }

  /** Aborts a pending long press without ending the touch (e.g. a second finger arrived). */
  cancel(): void {
    this.clearTimer();
  }

  /** The finger was lifted (or the touch was cancelled by the browser). */
  end(): void {
    this.clearTimer();
    this.down = false;
    this.lastTouchAt = Date.now();
  }

  /**
   * A native `contextmenu` event arrived. Returns true when it belongs to a touch (the caller must
   * not treat it as a mouse right-click). If the long press is still pending it fires now, so the
   * gesture is reported once whichever of the timer and the native event comes first.
   */
  absorbNativeContextMenu(): boolean {
    const belongsToTouch = this.down || (this.fired && this.isRecent());
    if (!belongsToTouch) return false;
    if (this.timer) this.fire();
    return true;
  }

  /** True for the click the browser emits when the finger is lifted after a long press. */
  swallowsClick(): boolean {
    return this.fired && (this.down || this.isRecent());
  }

  private fire(): void {
    this.clearTimer();
    this.fired = true;
    this.onLongPress?.();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private isRecent(): boolean {
    return Date.now() - this.lastTouchAt < TOUCH_TAIL_MS;
  }
}
