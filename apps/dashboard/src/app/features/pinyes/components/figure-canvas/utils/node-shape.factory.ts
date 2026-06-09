import Konva from 'konva';
import { FigureZone, NodeShape } from '@muixer/shared';

export const NODE_COLORS: Record<string, string> = {
  [FigureZone.BASE]: '#EEEEEE',
  [FigureZone.PINYA]: '#3b82f6',
  [FigureZone.TRONC]: '#8b5cf6',
  [FigureZone.FIGURE_DIRECTION]: '#f59e0b',
  [FigureZone.XICALLA_DIRECTION]: '#ec4899',
};
export const DEFAULT_NODE_COLOR = '#6b7280';
export const SELECTED_STROKE = '#f59e0b';
export const NORMAL_STROKE = '#1e1b4b';
export const COMPOSITION_SLOT_SCALE = 0.5;

export interface ShapeNode {
  shape: string;
  width: number;
  height: number;
}

/**
 * Builds an Ellipse or Rect Konva shape based on the node's `shape` field.
 * Centered at origin (0, 0) — caller must set group position.
 */
export function buildNodeShape(
  node: ShapeNode,
  fill: string,
  stroke: string,
  strokeWidth: number,
): Konva.Shape {
  if (node.shape === NodeShape.ELLIPSE) {
    return new Konva.Ellipse({
      radiusX: node.width / 2,
      radiusY: node.height / 2,
      fill,
      stroke,
      strokeWidth,
    });
  }
  return new Konva.Rect({
    x: -node.width / 2,
    y: -node.height / 2,
    width: node.width,
    height: node.height,
    cornerRadius: 4,
    fill,
    stroke,
    strokeWidth,
  });
}

/** Returns #000 or #fff depending on background luminance. */
export function getContrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
