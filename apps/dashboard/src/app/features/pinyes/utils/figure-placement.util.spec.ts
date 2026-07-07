import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLACEMENT_GAP,
  figureExtentFromNodes,
  placeFigures,
  placeNewFigure,
} from './figure-placement.util';

describe('placeFigures', () => {
  it('returns an empty array when there are no figures', () => {
    expect(placeFigures([])).toEqual([]);
  });

  it('places a single figure with its bounding box starting at x=0 and tronc panel linked (auto above)', () => {
    const [placed] = placeFigures([{ instanceId: 'a', width: 200, height: 100 }]);

    expect(placed).toEqual({
      instanceId: 'a',
      x: 100,
      y: 0,
      angle: 0,
      troncPanelX: null,
      troncPanelY: null,
    });
  });

  it('places figures left to right without overlap, separated by the gap', () => {
    const [first, second] = placeFigures([
      { instanceId: 'a', width: 200, height: 100 },
      { instanceId: 'b', width: 300, height: 150 },
    ]);

    const firstRightEdge = first.x + 200 / 2;
    const secondLeftEdge = second.x - 300 / 2;
    expect(secondLeftEdge).toBe(firstRightEdge + DEFAULT_PLACEMENT_GAP);
    expect(second.y).toBe(0);
  });

  it('keeps zero-width figures separated by the gap instead of stacking them', () => {
    const [first, second] = placeFigures([
      { instanceId: 'a', width: 0, height: 0 },
      { instanceId: 'b', width: 0, height: 0 },
    ]);

    expect(second.x - first.x).toBe(DEFAULT_PLACEMENT_GAP);
  });
});

describe('placeNewFigure', () => {
  it('places the first figure like placeFigures when nothing exists yet', () => {
    const placed = placeNewFigure([], { instanceId: 'a', width: 200, height: 100 });

    expect(placed).toEqual({
      instanceId: 'a',
      x: 100,
      y: 0,
      angle: 0,
      troncPanelX: null,
      troncPanelY: null,
    });
  });

  it('places the new figure to the right of the rightmost existing edge', () => {
    const placed = placeNewFigure(
      [
        { x: 500, width: 200 },
        { x: 100, width: 100 },
      ],
      { instanceId: 'new', width: 300, height: 100 },
    );

    // Rightmost edge is 500 + 100 = 600; new left edge sits one gap beyond it.
    expect(placed.x - 300 / 2).toBe(600 + DEFAULT_PLACEMENT_GAP);
    expect(placed.y).toBe(0);
    expect(placed.troncPanelX).toBeNull();
    expect(placed.troncPanelY).toBeNull();
  });
});

describe('figureExtentFromNodes', () => {
  it('computes the bounding box of node rectangles (centers ± half size)', () => {
    const extent = figureExtentFromNodes('a', [
      { x: 0, y: 0, width: 40, height: 40 },
      { x: 100, y: 50, width: 20, height: 60 },
    ]);

    // minX = -20, maxX = 110 → width 130; minY = -20, maxY = 80 → height 100
    expect(extent).toEqual({ instanceId: 'a', width: 130, height: 100 });
  });

  it('returns a zero-size extent when there are no nodes', () => {
    expect(figureExtentFromNodes('a', [])).toEqual({ instanceId: 'a', width: 0, height: 0 });
  });
});
