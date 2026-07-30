import { describe, it, expect } from 'vitest';
import {
  touchDistance,
  touchMidpoint,
  clampScale,
  zoomAroundPoint,
  getEventClientPoint,
  computeRotationAngleDeg,
} from './gesture-math.util';

describe('touchDistance', () => {
  it('returns 0 for two identical points', () => {
    expect(touchDistance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });

  it('returns the Euclidean distance between two points', () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('touchMidpoint', () => {
  it('returns the average of the two points', () => {
    expect(touchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe('clampScale', () => {
  it('returns the scale unchanged when within bounds', () => {
    expect(clampScale(1.5, 0.25, 3)).toBe(1.5);
  });

  it('clamps to the minimum when below it', () => {
    expect(clampScale(0.1, 0.25, 3)).toBe(0.25);
  });

  it('clamps to the maximum when above it', () => {
    expect(clampScale(10, 0.25, 3)).toBe(3);
  });
});

describe('zoomAroundPoint', () => {
  it('keeps the focal point fixed in world space when zooming in', () => {
    // Stage at origin, scale 1, focal point at (100, 100) — zooming to scale 2
    // should keep the world point under (100, 100) still under (100, 100).
    const result = zoomAroundPoint({ x: 0, y: 0 }, 1, 2, { x: 100, y: 100 });
    expect(result).toEqual({ x: -100, y: -100 });
  });

  it('is a no-op (unchanged position) when scale does not change', () => {
    const result = zoomAroundPoint({ x: 20, y: 30 }, 1.5, 1.5, { x: 100, y: 100 });
    expect(result).toEqual({ x: 20, y: 30 });
  });
});

describe('getEventClientPoint', () => {
  it('extracts clientX/clientY from a MouseEvent', () => {
    const event = new MouseEvent('mousemove', { clientX: 42, clientY: 7 });
    expect(getEventClientPoint(event)).toEqual({ x: 42, y: 7 });
  });

  it('extracts the first touch point from a touchmove TouchEvent', () => {
    const event = {
      type: 'touchmove',
      touches: [{ clientX: 5, clientY: 6 }],
      changedTouches: [],
    } as unknown as TouchEvent;
    expect(getEventClientPoint(event)).toEqual({ x: 5, y: 6 });
  });

  it('extracts the first changedTouches point from a touchend TouchEvent', () => {
    const event = {
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 9, clientY: 11 }],
    } as unknown as TouchEvent;
    expect(getEventClientPoint(event)).toEqual({ x: 9, y: 11 });
  });

  it('returns null when a TouchEvent has no touch points', () => {
    const event = {
      type: 'touchend',
      touches: [],
      changedTouches: [],
    } as unknown as TouchEvent;
    expect(getEventClientPoint(event)).toBeNull();
  });
});

describe('computeRotationAngleDeg', () => {
  it('computes the angle so pointing straight up is 0 degrees', () => {
    // pointer directly above center → 0deg (matches existing atan2(...) + 90 convention)
    const angle = computeRotationAngleDeg({ x: 0, y: -10 }, { x: 0, y: 0 }, false);
    expect(angle).toBeCloseTo(0);
  });

  it('computes the angle so pointing right is 90 degrees', () => {
    const angle = computeRotationAngleDeg({ x: 10, y: 0 }, { x: 0, y: 0 }, false);
    expect(angle).toBeCloseTo(90);
  });

  it('snaps to the nearest 15 degree increment when snapToGrid is true', () => {
    // ~10deg raw angle should snap to 15
    const angle = computeRotationAngleDeg({ x: 1.76, y: -9.85 }, { x: 0, y: 0 }, true);
    expect(angle).toBe(15);
  });

  it('does not snap when snapToGrid is false', () => {
    const angle = computeRotationAngleDeg({ x: 1.76, y: -9.85 }, { x: 0, y: 0 }, false);
    expect(angle).not.toBe(15);
  });
});
