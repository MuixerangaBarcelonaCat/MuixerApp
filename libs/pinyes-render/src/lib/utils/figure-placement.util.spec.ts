import {
  DEFAULT_PLACEMENT_GAP,
  PLACEMENT_SCREEN_WIDTH,
  PLACEMENT_SCREEN_HEIGHT,
  FigureLayoutSpec,
  NodeRect,
  PlacedFigurePosition,
  computeFigureBoundingBoxes,
  computeMargins,
  figureExtentFromNodes,
  placeFigures,
  placeNewFigure,
} from './figure-placement.util';
import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';

/** World-space AABB of a placed figure (x/y is the bounding-box center). */
function figureBox(placed: PlacedFigurePosition, spec: FigureLayoutSpec) {
  return {
    left: placed.x - spec.width / 2,
    right: placed.x + spec.width / 2,
    top: placed.y - spec.height / 2,
    bottom: placed.y + spec.height / 2,
  };
}

/** Gap between two axis-aligned rectangles (0 when they touch or overlap). */
function rectDistance(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): number {
  const dx = Math.max(b.left - a.right, a.left - b.right, 0);
  const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);
  return Math.hypot(dx, dy);
}

function boxesOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Envelope of placed figure boxes (ignoring troncs). */
function layoutEnvelope(placed: PlacedFigurePosition[], specs: FigureLayoutSpec[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach((p, i) => {
    const b = figureBox(p, specs[i]);
    minX = Math.min(minX, b.left);
    minY = Math.min(minY, b.top);
    maxX = Math.max(maxX, b.right);
    maxY = Math.max(maxY, b.bottom);
  });
  return { width: maxX - minX, height: maxY - minY };
}

function zoomFor(envelope: { width: number; height: number }): number {
  return Math.min(PLACEMENT_SCREEN_WIDTH / envelope.width, PLACEMENT_SCREEN_HEIGHT / envelope.height);
}

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

describe('placeFigures — space-optimizing row packing', () => {
  const sixFigures: FigureLayoutSpec[] = Array.from({ length: 6 }, (_, i) => ({
    instanceId: `f${i}`,
    width: 400,
    height: 300,
  }));

  it('wraps into multiple rows when a single row would limit the fit-to-screen zoom', () => {
    const placed = placeFigures(sixFigures);

    // 6 × 400 + 5 gaps = 2900 wide in one row → zoom capped by width.
    // Two rows of 3 give a much better min(screenW/W, screenH/H).
    const singleRowZoom = zoomFor({ width: 6 * 400 + 5 * DEFAULT_PLACEMENT_GAP, height: 300 });
    const actualZoom = zoomFor(layoutEnvelope(placed, sixFigures));
    expect(actualZoom).toBeGreaterThan(singleRowZoom);

    const distinctYs = new Set(placed.map((p) => p.y));
    expect(distinctYs.size).toBeGreaterThan(1);
  });

  it('never overlaps two figure bounding boxes', () => {
    const specs: FigureLayoutSpec[] = [
      { instanceId: 'a', width: 700, height: 500 },
      { instanceId: 'b', width: 300, height: 200 },
      { instanceId: 'c', width: 500, height: 350 },
      { instanceId: 'd', width: 900, height: 400 },
      { instanceId: 'e', width: 250, height: 600 },
    ];
    const placed = placeFigures(specs);

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(
          boxesOverlap(figureBox(placed[i], specs[i]), figureBox(placed[j], specs[j])),
        ).toBe(false);
      }
    }
  });

  it('is deterministic: identical input yields identical output', () => {
    const specs: FigureLayoutSpec[] = [
      { instanceId: 'a', width: 700, height: 500 },
      { instanceId: 'b', width: 300, height: 200 },
      { instanceId: 'c', width: 500, height: 350 },
      { instanceId: 'd', width: 900, height: 400 },
    ];
    expect(placeFigures(specs)).toEqual(placeFigures(specs));
  });

  it('keeps input order as reading order (left-to-right, then next row below)', () => {
    const placed = placeFigures(sixFigures);

    for (let i = 1; i < placed.length; i++) {
      const prev = placed[i - 1];
      const cur = placed[i];
      const sameRow = cur.y === prev.y;
      expect(sameRow ? cur.x > prev.x : cur.y > prev.y).toBe(true);
    }
  });

  it('preserves each figure input angle without modifying it', () => {
    const placed = placeFigures([
      { instanceId: 'a', width: 200, height: 100, angle: 45 },
      { instanceId: 'b', width: 200, height: 100 },
    ]);

    expect(placed[0].angle).toBe(45);
    expect(placed[1].angle).toBe(0);
  });
});

describe('placeFigures — tronc panel placement', () => {
  /** Nodes fully covering the figure box (dense pinya, no free interior). */
  const denseNodes = (width: number, height: number) => [
    { x: width / 2, y: height / 2, width, height },
  ];

  /** Ring of nodes leaving a large empty interior (hollow pinya). */
  const ringNodes = (width: number, height: number, thickness: number) => [
    { x: width / 2, y: thickness / 2, width, height: thickness }, // top edge
    { x: width / 2, y: height - thickness / 2, width, height: thickness }, // bottom edge
    { x: thickness / 2, y: height / 2, width: thickness, height }, // left edge
    { x: width - thickness / 2, y: height / 2, width: thickness, height }, // right edge
  ];

  const troncBox = (p: PlacedFigurePosition, tronc: { width: number; height: number }) => ({
    left: p.troncPanelX as number,
    right: (p.troncPanelX as number) + tronc.width,
    top: p.troncPanelY as number,
    bottom: (p.troncPanelY as number) + tronc.height,
  });

  it('gives figures with a tronc an explicit tronc panel position near their figure', () => {
    const tronc = { width: 300, height: 200 };
    const [placed] = placeFigures([
      { instanceId: 'a', width: 600, height: 400, nodes: denseNodes(600, 400), tronc },
    ]);

    expect(placed.troncPanelX).not.toBeNull();
    expect(placed.troncPanelY).not.toBeNull();
    const tb = troncBox(placed, tronc);
    const troncCenter = { x: (tb.left + tb.right) / 2, y: (tb.top + tb.bottom) / 2 };
    const dist = Math.hypot(troncCenter.x - placed.x, troncCenter.y - placed.y);
    // "Near": within one figure diagonal of its own figure.
    expect(dist).toBeLessThan(Math.hypot(600, 400));
  });

  it('never overlaps a tronc panel with any node of any figure', () => {
    const tronc = { width: 300, height: 200 };
    const specs: FigureLayoutSpec[] = [
      { instanceId: 'a', width: 600, height: 400, nodes: denseNodes(600, 400), tronc },
      { instanceId: 'b', width: 500, height: 500, nodes: denseNodes(500, 500), tronc },
    ];
    const placed = placeFigures(specs);

    for (const p of placed) {
      const tb = troncBox(p, tronc);
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const fig = placed[i];
        for (const n of spec.nodes ?? []) {
          // Node world rect: node coords are figure-local; figure x/y is the extent center.
          const extentCenterX = spec.width / 2;
          const extentCenterY = spec.height / 2;
          const nodeBox = {
            left: fig.x + (n.x - extentCenterX) - n.width / 2,
            right: fig.x + (n.x - extentCenterX) + n.width / 2,
            top: fig.y + (n.y - extentCenterY) - n.height / 2,
            bottom: fig.y + (n.y - extentCenterY) + n.height / 2,
          };
          expect(boxesOverlap(tb, nodeBox)).toBe(false);
        }
      }
    }
  });

  it('never overlaps two tronc panels', () => {
    const tronc = { width: 400, height: 250 };
    const specs: FigureLayoutSpec[] = Array.from({ length: 4 }, (_, i) => ({
      instanceId: `f${i}`,
      width: 450,
      height: 350,
      nodes: denseNodes(450, 350),
      tronc,
    }));
    const placed = placeFigures(specs);

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(boxesOverlap(troncBox(placed[i], tronc), troncBox(placed[j], tronc))).toBe(false);
      }
    }
  });

  it('places the tronc inside a hollow figure interior when it fits (node-free overlap allowed)', () => {
    const tronc = { width: 200, height: 150 };
    const [placed] = placeFigures([
      {
        instanceId: 'a',
        width: 800,
        height: 700,
        nodes: ringNodes(800, 700, 100),
        tronc,
      },
    ]);

    const tb = troncBox(placed, tronc);
    const fig = figureBox(placed, { instanceId: 'a', width: 800, height: 700 });
    // Fits fully inside the figure box (in the hollow interior), so the
    // layout envelope stays exactly the figure envelope.
    expect(tb.left).toBeGreaterThanOrEqual(fig.left);
    expect(tb.right).toBeLessThanOrEqual(fig.right);
    expect(tb.top).toBeGreaterThanOrEqual(fig.top);
    expect(tb.bottom).toBeLessThanOrEqual(fig.bottom);
  });

  it('leaves the tronc panel linked (null) when the figure has no tronc', () => {
    const [placed] = placeFigures([{ instanceId: 'a', width: 200, height: 100 }]);

    expect(placed.troncPanelX).toBeNull();
    expect(placed.troncPanelY).toBeNull();
  });

  it('prefers a spot whose nearest figure is its own over a closer spot beside another figure', () => {
    // Row 1: A (200×400, dense) next to B (200×600, left half node-free);
    // row 2: a very wide dense C makes the envelope width-bound, so growing
    // it sideways loses zoom while there is vertical slack. The spot right of
    // A (in the A–B gap, closest to A's center) ends up nearest to B; the
    // spot above A is zoom-free too and nearest to A — it must win.
    const specs: FigureLayoutSpec[] = [
      {
        instanceId: 'a',
        width: 200,
        height: 400,
        nodes: [{ x: 100, y: 200, width: 200, height: 400 }],
        tronc: { width: 80, height: 60 },
      },
      {
        instanceId: 'b',
        width: 200,
        height: 600,
        nodes: [
          { x: 0.5, y: 0.5, width: 1, height: 1 },
          { x: 150, y: 300, width: 100, height: 600 },
        ],
      },
      {
        instanceId: 'c',
        width: 3000,
        height: 600,
        nodes: [{ x: 1500, y: 300, width: 3000, height: 600 }],
      },
    ];

    const placed = placeFigures(specs);
    const [a, b, c] = placed;

    const troncBoxA = {
      left: a.troncPanelX as number,
      right: (a.troncPanelX as number) + 80,
      top: a.troncPanelY as number,
      bottom: (a.troncPanelY as number) + 60,
    };
    const distToOwn = rectDistance(troncBoxA, figureBox(a, specs[0]));
    const distToOthers = Math.min(
      rectDistance(troncBoxA, figureBox(b, specs[1])),
      rectDistance(troncBoxA, figureBox(c, specs[2])),
    );
    expect(distToOwn).toBeLessThanOrEqual(distToOthers);
  });

  it("still enters another figure's node-free area rather than losing zoom near its own figure", () => {
    // A (800×900, dense) and B (800×900, left half node-free) fill a nearly
    // screen-shaped envelope: any growth — sideways or vertical — loses zoom.
    // The only zoom-preserving spot for A's tronc is inside B's free area, so
    // the own-figure proximity preference must yield to zoom.
    const specs: FigureLayoutSpec[] = [
      {
        instanceId: 'a',
        width: 800,
        height: 900,
        nodes: [{ x: 400, y: 450, width: 800, height: 900 }],
        tronc: { width: 200, height: 100 },
      },
      {
        instanceId: 'b',
        width: 800,
        height: 900,
        nodes: [
          { x: 0.5, y: 0.5, width: 1, height: 1 },
          { x: 600, y: 450, width: 400, height: 900 },
        ],
      },
    ];

    const placed = placeFigures(specs);
    const [a] = placed;

    const troncBoxA = {
      left: a.troncPanelX as number,
      right: (a.troncPanelX as number) + 200,
      top: a.troncPanelY as number,
      bottom: (a.troncPanelY as number) + 100,
    };
    const envelope = {
      left: Math.min(...placed.map((p, i) => figureBox(p, specs[i]).left)),
      right: Math.max(...placed.map((p, i) => figureBox(p, specs[i]).right)),
      top: Math.min(...placed.map((p, i) => figureBox(p, specs[i]).top)),
      bottom: Math.max(...placed.map((p, i) => figureBox(p, specs[i]).bottom)),
    };
    expect(troncBoxA.left).toBeGreaterThanOrEqual(envelope.left);
    expect(troncBoxA.right).toBeLessThanOrEqual(envelope.right);
    expect(troncBoxA.top).toBeGreaterThanOrEqual(envelope.top);
    expect(troncBoxA.bottom).toBeLessThanOrEqual(envelope.bottom);
  });

  it('positions a figure by its pivot node bbox (nodes), while extra occupiedNodes only block tronc placement without shifting the pivot', () => {
    // Pivot set: a plain 200×100 box. occupiedNodes additionally includes a
    // decoration far to the right — must not inflate/shift figure.width or x.
    const pivotOnly = figureExtentFromNodes('solo', [{ x: 100, y: 50, width: 200, height: 100 }]);
    const [withExtra] = placeFigures([
      {
        instanceId: 'a',
        width: pivotOnly.width,
        height: pivotOnly.height,
        nodes: [{ x: 100, y: 50, width: 200, height: 100 }],
        occupiedNodes: [
          { x: 100, y: 50, width: 200, height: 100 },
          { x: 900, y: 50, width: 100, height: 100 }, // decoration far away
        ],
      },
    ]);
    const [pivotOnlyPlaced] = placeFigures([
      { instanceId: 'a', width: pivotOnly.width, height: pivotOnly.height, nodes: [{ x: 100, y: 50, width: 200, height: 100 }] },
    ]);

    expect(withExtra.x).toBe(pivotOnlyPlaced.x);
    expect(withExtra.y).toBe(pivotOnlyPlaced.y);
  });

  it('rejects a tronc candidate that overlaps an occupiedNodes-only rect (e.g. a decoration outside the pivot bbox)', () => {
    const decorationRect = { x: -150, y: 50, width: 80, height: 300 }; // to the left of the pivot bbox
    const [a] = placeFigures([
      {
        instanceId: 'a',
        width: 200,
        height: 100,
        nodes: [{ x: 100, y: 50, width: 200, height: 100 }],
        occupiedNodes: [{ x: 100, y: 50, width: 200, height: 100 }, decorationRect],
        tronc: { width: 60, height: 60 },
      },
    ]);

    const troncBox = {
      left: a.troncPanelX as number,
      right: (a.troncPanelX as number) + 60,
      top: a.troncPanelY as number,
      bottom: (a.troncPanelY as number) + 60,
    };
    // World position of the decoration center: position + (local - pivotBboxCenter).
    // Pivot node spans x:[0,200] y:[0,100] (x=100,w=200 / y=50,h=100) → center (100,50).
    const decoCenterX = a.x + (decorationRect.x - 100);
    const decoCenterY = a.y + (decorationRect.y - 50);
    const decorationBox = {
      left: decoCenterX - decorationRect.width / 2,
      right: decoCenterX + decorationRect.width / 2,
      top: decoCenterY - decorationRect.height / 2,
      bottom: decoCenterY + decorationRect.height / 2,
    };
    expect(boxesOverlap(troncBox, decorationBox)).toBe(false);
  });

  it('is deterministic including tronc placement', () => {
    const tronc = { width: 300, height: 200 };
    const specs: FigureLayoutSpec[] = Array.from({ length: 3 }, (_, i) => ({
      instanceId: `f${i}`,
      width: 500,
      height: 400,
      nodes: denseNodes(500, 400),
      tronc,
    }));
    expect(placeFigures(specs)).toEqual(placeFigures(specs));
  });
});

describe('placeFigures — asymmetric packing margins (pivot vs. occupancy can differ)', () => {
  it('computeMargins reserves packing space based on occupiedNodes, not the pivot bbox', () => {
    // Pivot (nodes): a wide 2000-unit box (e.g. raw, unfiltered PINYA+BASE
    // with unassigned/beyond-cordons content).
    const pivot: NodeRect[] = [{ x: 1000, y: 200, width: 2000, height: 400 }];

    // Case 1: everything visible (occupancy == pivot) — reserves the full width.
    const wideMargins = computeMargins({
      instanceId: 'a',
      width: 2000,
      height: 400,
      nodes: pivot,
      occupiedNodes: pivot,
    });

    // Case 2: only a small sliver is actually visible (e.g. cordons/assignment
    // hide most content) — must reserve much less packing space.
    const smallMargins = computeMargins({
      instanceId: 'a',
      width: 2000,
      height: 400,
      nodes: pivot,
      occupiedNodes: [{ x: 100, y: 200, width: 200, height: 400 }],
    });

    expect(smallMargins.left + smallMargins.right).toBeLessThan(wideMargins.left + wideMargins.right);
  });

  it('positions a figure by its pivot bbox regardless of how large or small its occupancy footprint is', () => {
    const pivot: NodeRect[] = [{ x: 1000, y: 200, width: 2000, height: 400 }];
    const wideSpec: FigureLayoutSpec = {
      instanceId: 'a',
      width: 2000,
      height: 400,
      nodes: pivot,
      occupiedNodes: pivot,
    };
    const smallSpec: FigureLayoutSpec = {
      instanceId: 'a',
      width: 2000,
      height: 400,
      nodes: pivot,
      occupiedNodes: [{ x: 100, y: 200, width: 200, height: 400 }],
    };

    const [aWide] = placeFigures([wideSpec]);
    const [aSmall] = placeFigures([smallSpec]);

    expect(aSmall.x).toBe(aWide.x);
    expect(aSmall.y).toBe(aWide.y);
  });

  it('still reserves packing space and blocks tronc overlap for a NETA-like figure with no pivot nodes at all', () => {
    // NETA figures have no PINYA/BASE (hasPinya: false), so `nodes` (pivot) is
    // empty — distributionNodes' own fallback for that case uses the local
    // (0,0) origin as the effective center (not a computed bbox), so this
    // must match: occupancy (e.g. decoration) must still be measured and
    // still block tronc overlap, rotated around local (0,0).
    const margins = computeMargins({
      instanceId: 'neta',
      width: 0,
      height: 0,
      nodes: [],
      occupiedNodes: [{ x: 0, y: 0, width: 200, height: 150 }],
    });
    expect(margins.left + margins.right).toBeGreaterThan(0);
    expect(margins.top + margins.bottom).toBeGreaterThan(0);
  });

  it('never lets a smaller occupancy footprint cause an actual occupancy overlap between figures', () => {
    const specs: FigureLayoutSpec[] = [
      {
        instanceId: 'a',
        width: 2000,
        height: 400,
        nodes: [{ x: 1000, y: 200, width: 2000, height: 400 }],
        occupiedNodes: [{ x: 100, y: 200, width: 200, height: 400 }],
      },
      {
        instanceId: 'b',
        width: 200,
        height: 200,
        nodes: [{ x: 100, y: 100, width: 200, height: 200 }],
      },
    ];
    const placed = placeFigures(specs);

    const occupancyBox = (p: PlacedFigurePosition, spec: FigureLayoutSpec) => {
      const local = spec.occupiedNodes ?? spec.nodes ?? [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of local) {
        minX = Math.min(minX, n.x - n.width / 2);
        minY = Math.min(minY, n.y - n.height / 2);
        maxX = Math.max(maxX, n.x + n.width / 2);
        maxY = Math.max(maxY, n.y + n.height / 2);
      }
      const pivot = spec.nodes ?? [];
      let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
      for (const n of pivot) {
        pMinX = Math.min(pMinX, n.x - n.width / 2);
        pMinY = Math.min(pMinY, n.y - n.height / 2);
        pMaxX = Math.max(pMaxX, n.x + n.width / 2);
        pMaxY = Math.max(pMaxY, n.y + n.height / 2);
      }
      const pivotCenterX = (pMinX + pMaxX) / 2;
      const pivotCenterY = (pMinY + pMaxY) / 2;
      return {
        left: p.x + (minX - pivotCenterX),
        right: p.x + (maxX - pivotCenterX),
        top: p.y + (minY - pivotCenterY),
        bottom: p.y + (maxY - pivotCenterY),
      };
    };

    expect(boxesOverlap(occupancyBox(placed[0], specs[0]), occupancyBox(placed[1], specs[1]))).toBe(false);
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

describe('computeFigureBoundingBoxes', () => {
  const makeSlotNode = (x: number, y: number, width: number, height: number) => ({
    id: `${x}-${y}`,
    label: 'n',
    zone: 'PINYA',
    positionType: null,
    x,
    y,
    z: 0,
    width,
    height,
    rotation: 0,
    color: null,
    shape: 'RECTANGLE',
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    renglaId: null,
    renglaPosition: null,
  });

  const makeSlot = (
    slotId: string,
    offsetX: number,
    offsetY: number,
    nodes: ReturnType<typeof makeSlotNode>[],
    label: string | null = null,
  ): CompositionSlotWithNodes => ({
    slotId,
    label,
    offsetX,
    offsetY,
    sortOrder: 0,
    angle: 0,
    figureTemplate: {
      id: `tpl-${slotId}`,
      name: slotId,
      hasPinya: true,
      nodes: nodes as unknown as CompositionSlotWithNodes['figureTemplate']['nodes'],
    },
  });

  it('returns an empty array for no slots', () => {
    expect(computeFigureBoundingBoxes([])).toEqual([]);
  });

  it('computes the world-space bounding box of a slot from its node extents and offset', () => {
    // Node spans x:[-20,20] y:[-10,10] -> width 40, height 20, centered at node origin.
    // Slot offset represents that center in world space (100, 200).
    const slot = makeSlot('a', 100, 200, [makeSlotNode(0, 0, 40, 20)]);

    const [box] = computeFigureBoundingBoxes([slot]);

    expect(box).toEqual({ slotId: 'a', label: 'a', x: 80, y: 190, width: 40, height: 20 });
  });

  it('uses the slot label when set, falling back to the template name', () => {
    const slot = makeSlot('a', 0, 0, [makeSlotNode(0, 0, 10, 10)], 'Pilar de 4');

    const [box] = computeFigureBoundingBoxes([slot]);

    expect(box.label).toBe('Pilar de 4');
  });

  it('skips slots with no nodes', () => {
    const slot = makeSlot('a', 0, 0, []);

    expect(computeFigureBoundingBoxes([slot])).toEqual([]);
  });

  it('unions the extents of multiple nodes in the same slot', () => {
    const slot = makeSlot('a', 0, 0, [makeSlotNode(-50, 0, 10, 10), makeSlotNode(50, 0, 10, 10)]);

    const [box] = computeFigureBoundingBoxes([slot]);

    expect(box.width).toBe(110);
  });

  const makeZonedSlotNode = (zone: string, x: number, y: number, width: number, height: number) => ({
    id: `${zone}-${x}-${y}`,
    label: 'n',
    zone,
    positionType: null,
    x,
    y,
    z: 0,
    width,
    height,
    rotation: 0,
    color: null,
    shape: 'RECTANGLE',
    sortOrder: 0,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    renglaId: null,
    renglaPosition: null,
  });

  it('places the box using the PINYA+BASE pivot, not the center of decoration-inclusive extents (offsetX/Y is the pivot, not the full-set center)', () => {
    // PINYA node at local (0,0) 40x20 defines the pivot: world (500,300) is
    // local (0,0). A DECORATION node sits far to the right of it. The full
    // node-set bbox center is NOT at local (0,0), so a box built by assuming
    // offsetX/Y is that center would misplace every node relative to reality.
    const pinya = makeZonedSlotNode('PINYA', 0, 0, 40, 20);
    const decoration = makeZonedSlotNode('DECORATION', 100, 0, 20, 20);
    const slot = makeSlot('a', 500, 300, [pinya, decoration]);

    const [box] = computeFigureBoundingBoxes([slot]);

    // World bbox: PINYA world x:[480,520] y:[290,310]; DECORATION world
    // x:[590,610] y:[290,310] (local x:[90,110] + pivot 500).
    expect(box).toEqual({ slotId: 'a', label: 'a', x: 480, y: 290, width: 130, height: 20 });
  });
});
