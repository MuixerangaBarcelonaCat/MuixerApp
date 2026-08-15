import { computeFitTransform } from './fit-to-bounds.util';

describe('computeFitTransform', () => {
  it('returns null for an empty node list', () => {
    expect(computeFitTransform([], 800, 600)).toBeNull();
  });

  it('returns null when the bounding box has zero area', () => {
    expect(computeFitTransform([{ x: 0, y: 0, width: 0, height: 40 }], 800, 600)).toBeNull();
  });

  it('centres a single node and scales it up to fill the viewport, respecting padding', () => {
    const fit = computeFitTransform([{ x: 100, y: 100, width: 40, height: 40 }], 800, 600, { padding: 20 })!;

    // scaleX = (800-40)/40 = 19, scaleY = (600-40)/40 = 14, both above the default maxScale (4).
    expect(fit.scale).toBeCloseTo(4, 5);
    // The node's centre (100,100) must land on the viewport's centre (400,300) at that scale.
    expect(fit.x + 100 * fit.scale).toBeCloseTo(400, 5);
    expect(fit.y + 100 * fit.scale).toBeCloseTo(300, 5);
  });

  describe('the two shapes the Troba\'m flight uses', () => {
    it('a tight single node, capped by maxScale: 2.5 — pinya/base destination', () => {
      // A small node in a big viewport would otherwise scale up far past a useful zoom level.
      const fit = computeFitTransform([{ x: 0, y: 0, width: 20, height: 20 }], 1000, 800, { maxScale: 2.5 })!;
      expect(fit.scale).toBe(2.5);
    });

    it('a single panel-sized rect with modest padding — tronc destination', () => {
      const panelBounds = { x: 200, y: 150, width: 300, height: 180 };
      const fit = computeFitTransform([panelBounds], 1000, 800, { padding: 32 })!;

      // scaleX = (1000-64)/300 = 3.12, scaleY = (800-64)/180 ≈ 4.09 → capped by the smaller axis.
      expect(fit.scale).toBeCloseTo(936 / 300, 5);
      expect(fit.x + panelBounds.x * fit.scale).toBeCloseTo(500, 5);
      expect(fit.y + panelBounds.y * fit.scale).toBeCloseTo(400, 5);
    });
  });
});
