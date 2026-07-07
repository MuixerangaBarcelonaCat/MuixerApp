/**
 * Figure geometry for the segment canvas (P5.9): placement (mock
 * space-optimizing algorithm), node-extent measurement, and world-space
 * bounding boxes derived from that geometry (used by the troncs minimap).
 *
 * Placement lays figures out in a horizontal line, left to right, separated
 * by a fixed gap. Tronc panels are left "linked" (troncPanelX/Y = null),
 * which the canvas renders automatically above each figure. To be replaced
 * by a real space-optimizing algorithm with the same signatures.
 *
 * Coordinates follow the distribution-slot convention: x/y is the world
 * position of the figure's bounding-box center.
 */

import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';

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
 * minimap. `slot.offsetX/offsetY` is the visual center of the slot's node
 * extents (the same pivot convention used by the canvas), so the box
 * top-left is derived by subtracting half the extent from
 * `figureExtentFromNodes`.
 */
export function computeFigureBoundingBoxes(
  slots: CompositionSlotWithNodes[],
): FigureBoundingBox[] {
  const boxes: FigureBoundingBox[] = [];

  for (const slot of slots) {
    const nodes = slot.figureTemplate.nodes;
    if (nodes.length === 0) continue;

    const { width, height } = figureExtentFromNodes(slot.slotId, nodes);
    boxes.push({
      slotId: slot.slotId,
      label: slot.label ?? slot.figureTemplate.name,
      x: slot.offsetX - width / 2,
      y: slot.offsetY - height / 2,
      width,
      height,
    });
  }

  return boxes;
}
