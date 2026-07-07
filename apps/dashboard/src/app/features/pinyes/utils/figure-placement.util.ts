/**
 * Mock placement algorithm for figures on the segment canvas (P5.9).
 *
 * Lays figures out in a horizontal line, left to right, separated by a fixed
 * gap. Tronc panels are left "linked" (troncPanelX/Y = null), which the canvas
 * renders automatically above each figure. To be replaced by a real
 * space-optimizing algorithm with the same signatures.
 *
 * Coordinates follow the distribution-slot convention: x/y is the world
 * position of the figure's bounding-box center.
 */

export const DEFAULT_PLACEMENT_GAP = 100;

export interface FigureExtent {
  instanceId: string;
  width: number;
  height: number;
}

export interface PlacedFigurePosition {
  instanceId: string;
  x: number;
  y: number;
  angle: number;
  troncPanelX: null;
  troncPanelY: null;
}

export function placeFigures(
  figures: FigureExtent[],
  gap: number = DEFAULT_PLACEMENT_GAP,
): PlacedFigurePosition[] {
  const placed: PlacedFigurePosition[] = [];
  let cursor = 0;
  for (const figure of figures) {
    placed.push({
      instanceId: figure.instanceId,
      x: cursor + figure.width / 2,
      y: 0,
      angle: 0,
      troncPanelX: null,
      troncPanelY: null,
    });
    cursor += figure.width + gap;
  }
  return placed;
}

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
