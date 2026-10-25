import { underlayPlan, unionRect } from './underlay.util';


describe('unionRect', () => {
  it('is null for no rects', () => {
    expect(unionRect([])).toBeNull();
  });

  it('bounds every rect, ignoring empty ones (an empty group sits at the origin)', () => {
    expect(
      unionRect([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 0, y: 0, width: 0, height: 0 },
        { x: -5, y: 50, width: 10, height: 100 },
      ]),
    ).toEqual({ x: -5, y: 20, width: 45, height: 130 });
  });
});

describe('underlayPlan', () => {
  it('covers everything drawn, wherever it is: the copy is drawn once and serves every view', () => {
    const plan = underlayPlan({ x: -2000, y: -100, width: 5000, height: 300 }, 3072);
    expect(plan?.rect).toEqual({ x: -2000, y: -100, width: 5000, height: 300 });
  });

  it('draws the longest side at `maxSide` device pixels, however small or large it is on screen', () => {
    expect(underlayPlan({ x: -2000, y: -100, width: 5000, height: 300 }, 3072)?.pixelRatio).toBeCloseTo(3072 / 5000);
    // All on screen (just loaded): a later zoom will still need the detail.
    expect(underlayPlan({ x: 10, y: 10, width: 380, height: 600 }, 3072)?.pixelRatio).toBeCloseTo(3072 / 600);
  });

  it('snaps the region outward to whole CSS pixels', () => {
    const plan = underlayPlan({ x: -10.4, y: 0.6, width: 420.2, height: 10 }, 3072);
    expect(plan?.rect).toEqual({ x: -11, y: 0, width: 421, height: 11 });
  });
});
