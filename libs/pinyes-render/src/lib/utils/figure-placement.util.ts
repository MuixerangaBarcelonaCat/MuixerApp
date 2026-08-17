/**
 * Figure geometry for the segment canvas (P5.9): space-optimizing placement,
 * node-extent measurement, and world-space bounding boxes derived from that
 * geometry (used by the troncs minimap).
 *
 * Placement packs figures into horizontal rows (shelf packing), preserving
 * input order as reading order, choosing the row partition that maximizes the
 * fit-to-screen zoom `min(screenW / layoutW, screenH / layoutH)` for a
 * reference screen (PLACEMENT_SCREEN_WIDTH/HEIGHT). Tronc panels are then
 * placed near their own figure by scoring candidate positions: a tronc may
 * overlap a figure only where that figure has no nodes, never overlaps
 * another tronc, and candidates that keep the layout envelope small win.
 * The algorithm is fully deterministic and never modifies figure angles.
 *
 * Coordinates follow the distribution-slot convention: x/y is the world
 * position of the figure's bounding-box center. Tronc panel coordinates are
 * the panel's top-left corner (canvas convention); null means "linked"
 * (auto-rendered above the figure).
 */

import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';
import { TRONC_GAP_PX } from './tronc-size.util';
import { boundingBoxCenter, pivotNodesFor } from './segment-assignment-render.util';

export const DEFAULT_PLACEMENT_GAP = 100;

/** Reference screen the layout is optimized to fill (adjust as needed). */
export const PLACEMENT_SCREEN_WIDTH = 1920;
export const PLACEMENT_SCREEN_HEIGHT = 1080;

export interface FigureExtent {
  instanceId: string;
  width: number;
  height: number;
}

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Placement input: extent plus optional geometry for tronc placement. */
export interface FigureLayoutSpec extends FigureExtent {
  /** Figure rotation in degrees; preserved verbatim, never modified. */
  angle?: number;
  /**
   * Node rectangles (template-local coordinates) defining the figure's pivot:
   * the world position placed for this figure is exactly this set's bbox
   * center. Must match whatever the renderer uses as its rotation pivot, or
   * everything drawn for the figure (including occupiedNodes) will end up
   * shifted from where placement assumed it would be.
   */
  nodes?: NodeRect[];
  /**
   * Node rectangles that must not be overlapped by any tronc panel, rotated
   * around the same pivot as `nodes` (not their own bbox center). Defaults to
   * `nodes` when omitted. Use this to include content that is always drawn
   * but must not shift the pivot (e.g. decoration nodes, or content excluded
   * from the pivot bbox by the renderer's own convention).
   */
  occupiedNodes?: NodeRect[];
  /** Natural size of the figure's tronc panel; omit/null when it has none. */
  tronc?: { width: number; height: number } | null;
}

export interface PlacedFigurePosition {
  instanceId: string;
  x: number;
  y: number;
  angle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Gap between two boxes (0 when they touch or overlap). */
function boxDistance(a: Box, b: Box): number {
  const dx = Math.max(b.left - a.right, a.left - b.right, 0);
  const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);
  return Math.hypot(dx, dy);
}

function unionBox(boxes: Box[]): Box {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const b of boxes) {
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.right);
    bottom = Math.max(bottom, b.bottom);
  }
  return { left, top, right, bottom };
}

function fitZoom(envelope: Box): number {
  const width = Math.max(envelope.right - envelope.left, 1);
  const height = Math.max(envelope.bottom - envelope.top, 1);
  return Math.min(PLACEMENT_SCREEN_WIDTH / width, PLACEMENT_SCREEN_HEIGHT / height);
}

interface Margins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Distances from a figure's pivot to the edges of its occupancy footprint
 * (rotated, defaulting to the pivot's own bbox when no occupiedNodes is
 * given). Generally asymmetric: a figure's *position* is always its pivot
 * bbox center (see FigureLayoutSpec.nodes), but the *packing space* reserved
 * for it is based on what's actually occupied — e.g. cordons/assignment can
 * make the occupancy footprint much smaller than the pivot bbox without
 * moving the figure.
 */
export function computeMargins(spec: FigureLayoutSpec): Margins {
  const box = unionBox(occupiedWorldRects(spec, { x: 0, y: 0 }));
  return { left: -box.left, right: box.right, top: -box.top, bottom: box.bottom };
}

/**
 * Partition figures into contiguous rows (preserving order) and lay each row
 * out left to right. Tries every row count 1..n and keeps the partition whose
 * envelope maximizes the fit-to-screen zoom; ties prefer fewer rows. Row
 * spacing is based on each figure's occupancy margins, not a symmetric width,
 * so a figure's placed position always lands exactly on its pivot bbox center
 * even when its reserved packing space is asymmetric or smaller/larger.
 */
function packFigureRows(
  figures: FigureLayoutSpec[],
  gap: number,
): { x: number; y: number }[] {
  const n = figures.length;
  const margins = figures.map(computeMargins);
  const logicalWidth = (i: number) => margins[i].left + margins[i].right;

  let bestRows: number[][] = [figures.map((_, i) => i)];
  let bestZoom = -Infinity;

  for (let k = 1; k <= n; k++) {
    const totalWidth = margins.reduce((sum, _, i) => sum + logicalWidth(i), 0) + (n - k) * gap;
    const targetWidth = totalWidth / k;

    const rows: number[][] = [];
    let current: number[] = [];
    let currentWidth = 0;
    figures.forEach((_, i) => {
      const added = current.length > 0 ? gap + logicalWidth(i) : logicalWidth(i);
      if (current.length > 0 && currentWidth + added > targetWidth + 1e-9 && rows.length < k - 1) {
        rows.push(current);
        current = [i];
        currentWidth = logicalWidth(i);
      } else {
        current.push(i);
        currentWidth += added;
      }
    });
    rows.push(current);

    const rowWidth = (row: number[]) =>
      row.reduce((sum, i) => sum + logicalWidth(i), 0) + (row.length - 1) * gap;
    const rowTop = (row: number[]) => Math.max(...row.map((i) => margins[i].top));
    const rowBottom = (row: number[]) => Math.max(...row.map((i) => margins[i].bottom));
    const envelopeWidth = Math.max(...rows.map(rowWidth));
    const envelopeHeight =
      rows.reduce((sum, row) => sum + rowTop(row) + rowBottom(row), 0) + (rows.length - 1) * gap;
    const zoom = fitZoom({ left: 0, top: 0, right: envelopeWidth, bottom: envelopeHeight });

    if (zoom > bestZoom + 1e-9) {
      bestZoom = zoom;
      bestRows = rows;
    }
  }

  const positions: { x: number; y: number }[] = new Array(n);
  let rowCenterY = 0;
  let previousBottom: number | null = null;
  for (const row of bestRows) {
    const top = Math.max(...row.map((i) => margins[i].top));
    const bottom = Math.max(...row.map((i) => margins[i].bottom));
    if (previousBottom !== null) {
      rowCenterY += previousBottom + gap + top;
    }
    previousBottom = bottom;

    let cursor = 0;
    for (const i of row) {
      positions[i] = { x: cursor + margins[i].left, y: rowCenterY };
      cursor += logicalWidth(i) + gap;
    }
  }
  return positions;
}

/**
 * World-space AABBs of a figure's occupied areas: its node rectangles
 * (rotated by the figure angle around the node-extent center) when known,
 * or the whole figure box as a conservative fallback.
 */
function occupiedWorldRects(
  spec: FigureLayoutSpec,
  position: { x: number; y: number },
): Box[] {
  const figureBox: Box = {
    left: position.x - spec.width / 2,
    top: position.y - spec.height / 2,
    right: position.x + spec.width / 2,
    bottom: position.y + spec.height / 2,
  };
  const pivotNodes = spec.nodes ?? [];
  const occupancyNodes = spec.occupiedNodes ?? pivotNodes;
  if (occupancyNodes.length === 0) return [figureBox];

  // Pivot center: the pivot node bbox center, or local (0,0) when there is no
  // pivot at all (e.g. a NETA figure with no PINYA/BASE) — matching
  // distributionNodes' own fallback (centerX/centerY default to 0), so
  // occupancy (e.g. decoration) still gets measured/positioned consistently
  // with the renderer instead of being silently ignored.
  let centerX = 0;
  let centerY = 0;
  if (pivotNodes.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of pivotNodes) {
      minX = Math.min(minX, n.x - n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    }
    centerX = (minX + maxX) / 2;
    centerY = (minY + maxY) / 2;
  }
  const radians = ((spec.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return occupancyNodes.map((n) => {
    const corners = [
      { x: n.x - n.width / 2, y: n.y - n.height / 2 },
      { x: n.x + n.width / 2, y: n.y - n.height / 2 },
      { x: n.x - n.width / 2, y: n.y + n.height / 2 },
      { x: n.x + n.width / 2, y: n.y + n.height / 2 },
    ].map((c) => {
      const dx = c.x - centerX;
      const dy = c.y - centerY;
      return {
        x: position.x + dx * cos - dy * sin,
        y: position.y + dx * sin + dy * cos,
      };
    });
    return unionBox(corners.map((c) => ({ left: c.x, top: c.y, right: c.x, bottom: c.y })));
  });
}

/**
 * Candidate tronc-panel centers for a figure, in deterministic order: the
 * figure interior (center + coarse grid, for hollow pinyes), the four
 * adjacent sides, then expanding rings outward for crowded layouts.
 */
function troncCandidateCenters(
  figureBox: Box,
  tronc: { width: number; height: number },
  gap: number,
): { x: number; y: number }[] {
  const cx = (figureBox.left + figureBox.right) / 2;
  const cy = (figureBox.top + figureBox.bottom) / 2;
  const halfW = (figureBox.right - figureBox.left) / 2;
  const halfH = (figureBox.bottom - figureBox.top) / 2;

  const candidates: { x: number; y: number }[] = [];
  // Interior: center first, then a coarse grid.
  for (const fy of [0, -0.25, 0.25]) {
    for (const fx of [0, -0.25, 0.25]) {
      candidates.push({ x: cx + fx * halfW * 2, y: cy + fy * halfH * 2 });
    }
  }
  // Adjacent sides and expanding rings.
  const stepX = halfW + tronc.width / 2 + TRONC_GAP_PX;
  const stepY = halfH + tronc.height / 2 + TRONC_GAP_PX;
  for (let ring = 0; ring < 40; ring++) {
    const extra = ring * gap;
    candidates.push({ x: cx, y: cy - stepY - extra }); // above
    candidates.push({ x: cx, y: cy + stepY + extra }); // below
    candidates.push({ x: cx - stepX - extra, y: cy }); // left
    candidates.push({ x: cx + stepX + extra, y: cy }); // right
  }
  return candidates;
}

/**
 * Space-optimizing placement of a segment's figures and tronc panels.
 * Deterministic; preserves input order and figure angles. See file header.
 */
export function placeFigures(
  figures: FigureLayoutSpec[],
  gap: number = DEFAULT_PLACEMENT_GAP,
): PlacedFigurePosition[] {
  const positions = packFigureRows(figures, gap);

  const occupied: Box[] = figures.flatMap((spec, i) => occupiedWorldRects(spec, positions[i]));
  // Actual occupancy envelope per figure (not the symmetric pivot box), so
  // tronc distance/overlap reasoning matches the real, possibly asymmetric
  // reserved footprint.
  const figureBoxes: Box[] = figures.map((spec, i) => unionBox(occupiedWorldRects(spec, positions[i])));
  const placedTroncs: Box[] = [];
  let envelope = figures.length > 0 ? unionBox(figureBoxes) : null;

  return figures.map((spec, i) => {
    const position = positions[i];
    const placed: PlacedFigurePosition = {
      instanceId: spec.instanceId,
      x: position.x,
      y: position.y,
      angle: spec.angle ?? 0,
      troncPanelX: null,
      troncPanelY: null,
    };
    if (!spec.tronc || !envelope) return placed;

    const tronc = spec.tronc;
    const candidates = troncCandidateCenters(figureBoxes[i], tronc, gap);

    // Ranking: fit-to-screen zoom first, then "my nearest figure is my own
    // figure" (users read tronc↔figure adjacency), then distance to own figure.
    let best: { box: Box; zoom: number; ownNearest: boolean; distance: number } | null = null;
    for (const center of candidates) {
      const box: Box = {
        left: center.x - tronc.width / 2,
        top: center.y - tronc.height / 2,
        right: center.x + tronc.width / 2,
        bottom: center.y + tronc.height / 2,
      };
      if (occupied.some((r) => boxesOverlap(box, r))) continue;
      if (placedTroncs.some((r) => boxesOverlap(box, r))) continue;

      const zoom = fitZoom(unionBox([envelope, box]));
      const distToOwn = boxDistance(box, figureBoxes[i]);
      const distToOthers = figureBoxes.reduce(
        (min, figBox, j) => (j === i ? min : Math.min(min, boxDistance(box, figBox))),
        Infinity,
      );
      const ownNearest = distToOwn <= distToOthers + 1e-9;
      const distance = Math.hypot(center.x - position.x, center.y - position.y);
      const zoomTied = best !== null && zoom > best.zoom - 1e-9;
      if (
        !best ||
        zoom > best.zoom + 1e-9 ||
        (zoomTied && ownNearest && !best.ownNearest) ||
        (zoomTied && ownNearest === best.ownNearest && distance < best.distance - 1e-9)
      ) {
        best = { box, zoom, ownNearest, distance };
      }
    }
    if (!best) return placed; // No valid spot: leave linked (auto above figure).

    placedTroncs.push(best.box);
    envelope = unionBox([envelope, best.box]);
    placed.troncPanelX = best.box.left;
    placed.troncPanelY = best.box.top;
    return placed;
  });
}

/**
 * Places one additional figure into an existing layout, to the right of the
 * rightmost occupied edge (never overlapping what is already placed). Used
 * when adding a figure to an already-distributed segment.
 */
export function placeNewFigure(
  existing: { x: number; width: number }[],
  figure: FigureExtent,
  gap: number = DEFAULT_PLACEMENT_GAP,
): PlacedFigurePosition {
  if (existing.length === 0) {
    return placeFigures([figure], gap)[0];
  }
  const rightmostEdge = Math.max(...existing.map((e) => e.x + e.width / 2));
  return {
    instanceId: figure.instanceId,
    x: rightmostEdge + gap + figure.width / 2,
    y: 0,
    angle: 0,
    troncPanelX: null,
    troncPanelY: null,
  };
}

export function figureExtentFromNodes(
  instanceId: string,
  nodes: { x: number; y: number; width: number; height: number }[],
): FigureExtent {
  if (nodes.length === 0) {
    return { instanceId, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }
  return { instanceId, width: maxX - minX, height: maxY - minY };
}

export interface FigureBoundingBox {
  slotId: string;
  label: string;
  /** World-space top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * World-space bounding box of each slot's rendered nodes, for the troncs
 * minimap. `slot.offsetX/offsetY` is the world position of the slot's
 * PINYA+BASE pivot (the same rotation-pivot convention every canvas mode
 * uses) — NOT the center of the full rendered node set. When DECORATION
 * nodes sit off-center from that pivot, the box must be translated by the
 * offset between the two, or it silently drifts from where the figure
 * actually renders.
 */
export function computeFigureBoundingBoxes(
  slots: CompositionSlotWithNodes[],
): FigureBoundingBox[] {
  const boxes: FigureBoundingBox[] = [];

  for (const slot of slots) {
    const nodes = slot.figureTemplate.nodes;
    if (nodes.length === 0) continue;

    const pivotNodes = pivotNodesFor(nodes);
    const pivotCenter = boundingBoxCenter(pivotNodes.length > 0 ? pivotNodes : nodes);
    const nodesCenter = boundingBoxCenter(nodes);
    const { width, height } = figureExtentFromNodes(slot.slotId, nodes);
    boxes.push({
      slotId: slot.slotId,
      label: slot.label ?? slot.figureTemplate.name,
      x: slot.offsetX + (nodesCenter.x - width / 2 - pivotCenter.x),
      y: slot.offsetY + (nodesCenter.y - height / 2 - pivotCenter.y),
      width,
      height,
    });
  }

  return boxes;
}
