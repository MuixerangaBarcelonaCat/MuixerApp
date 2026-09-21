import { LongPressDetector, LONG_PRESS_MS, LONG_PRESS_MOVE_TOLERANCE_PX } from './long-press.util';

describe('LongPressDetector', () => {
  let detector: LongPressDetector;
  let fired: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    detector = new LongPressDetector();
    fired = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('firing', () => {
    it('fires once the finger has stayed down for the delay', () => {
      detector.start(10, 10, fired);

      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(fired).toHaveBeenCalledTimes(1);
    });

    it('does not fire before the delay', () => {
      detector.start(10, 10, fired);

      jest.advanceTimersByTime(LONG_PRESS_MS - 1);

      expect(fired).not.toHaveBeenCalled();
    });

    it('does not fire when the finger is lifted first (a plain tap)', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS - 100);

      detector.end();
      jest.advanceTimersByTime(1000);

      expect(fired).not.toHaveBeenCalled();
    });

    it('fires only once, however long the finger stays down', () => {
      detector.start(10, 10, fired);

      jest.advanceTimersByTime(LONG_PRESS_MS * 5);

      expect(fired).toHaveBeenCalledTimes(1);
    });

    it('a new start replaces the previous one (only the latest callback fires)', () => {
      const first = jest.fn();
      detector.start(10, 10, first);
      jest.advanceTimersByTime(LONG_PRESS_MS / 2);

      detector.start(50, 50, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(first).not.toHaveBeenCalled();
      expect(fired).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelling', () => {
    it('keeps waiting while the finger jitters within the tolerance', () => {
      detector.start(10, 10, fired);

      detector.move(10 + LONG_PRESS_MOVE_TOLERANCE_PX - 1, 10);
      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(fired).toHaveBeenCalledTimes(1);
    });

    it('cancels when the finger moves beyond the tolerance (it is a scroll or a pan)', () => {
      detector.start(10, 10, fired);

      detector.move(10, 10 + LONG_PRESS_MOVE_TOLERANCE_PX + 1);
      jest.advanceTimersByTime(LONG_PRESS_MS * 2);

      expect(fired).not.toHaveBeenCalled();
    });

    it('measures the distance from where the touch started, not from the last move', () => {
      detector.start(0, 0, fired);

      detector.move(6, 0);
      detector.move(12, 0);
      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(fired).not.toHaveBeenCalled();
    });

    it('cancel() aborts a pending long press (e.g. a second finger arrived)', () => {
      detector.start(10, 10, fired);

      detector.cancel();
      jest.advanceTimersByTime(LONG_PRESS_MS * 2);

      expect(fired).not.toHaveBeenCalled();
    });

    it('move and end with nothing pending are harmless', () => {
      expect(() => {
        detector.move(1, 1);
        detector.end();
        detector.cancel();
      }).not.toThrow();
    });
  });

  describe('native contextmenu (Android fires one on long-press, around the same time as the timer)', () => {
    it('is not absorbed when there is no touch sequence (a mouse right-click)', () => {
      expect(detector.absorbNativeContextMenu()).toBe(false);
    });

    it('is absorbed while a finger is down', () => {
      detector.start(10, 10, fired);

      expect(detector.absorbNativeContextMenu()).toBe(true);
    });

    it('fires the long press right away when it arrives before the timer, and only once', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS - 100);

      detector.absorbNativeContextMenu();
      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(fired).toHaveBeenCalledTimes(1);
    });

    it('does not fire a second time when it arrives after the timer already fired', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);

      expect(detector.absorbNativeContextMenu()).toBe(true);
      expect(fired).toHaveBeenCalledTimes(1);
    });

    it('is absorbed without firing when the long press was cancelled by movement', () => {
      detector.start(10, 10, fired);
      detector.move(100, 100);

      expect(detector.absorbNativeContextMenu()).toBe(true);
      expect(fired).not.toHaveBeenCalled();
    });

    it('is still absorbed just after the finger is lifted, if the long press had fired', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);
      detector.end();
      jest.advanceTimersByTime(100);

      expect(detector.absorbNativeContextMenu()).toBe(true);
    });

    it('is a normal right-click again once the touch sequence is long over', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);
      detector.end();
      jest.advanceTimersByTime(5000);

      expect(detector.absorbNativeContextMenu()).toBe(false);
    });

    it('is not absorbed after a plain tap that never fired', () => {
      detector.start(10, 10, fired);
      detector.end();

      expect(detector.absorbNativeContextMenu()).toBe(false);
    });
  });

  describe('swallowing the click that follows a long press', () => {
    it('does not swallow anything before any touch', () => {
      expect(detector.swallowsClick()).toBe(false);
    });

    it('does not swallow the click of a plain tap', () => {
      detector.start(10, 10, fired);
      detector.end();

      expect(detector.swallowsClick()).toBe(false);
    });

    it('swallows the click when the finger is lifted after a long press', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);
      detector.end();

      expect(detector.swallowsClick()).toBe(true);
    });

    it('swallows it even if the finger was held for a long time before lifting', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS * 10);
      detector.end();

      expect(detector.swallowsClick()).toBe(true);
    });

    it('stops swallowing after the touch sequence is long over (a later mouse click is a real click)', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);
      detector.end();
      jest.advanceTimersByTime(5000);

      expect(detector.swallowsClick()).toBe(false);
    });

    it('a new touch clears it', () => {
      detector.start(10, 10, fired);
      jest.advanceTimersByTime(LONG_PRESS_MS);
      detector.end();

      detector.start(20, 20, fired);

      expect(detector.swallowsClick()).toBe(false);
    });
  });
});
