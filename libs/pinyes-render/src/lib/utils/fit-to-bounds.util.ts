export interface BoundsNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitTransform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Computes stage scale + position so all nodes fit inside the viewport with padding.
 * Treats node (x, y) as the center; uses axis-aligned bounding boxes (ignores rotation).
 * Returns null when the node list is empty or the bounding box has zero area.
 */
export function computeFitTransform(
  nodes: BoundsNode[],
  viewportWidth: number,
  viewportHeight: number,
  options?: { padding?: number; maxScale?: number },
): FitTransform | null {
  if (nodes.length === 0) return null;

  const padding = options?.padding ?? 20;
  const maxScale = options?.maxScale ?? 4;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }

  const bbW = maxX - minX;
  const bbH = maxY - minY;
  if (bbW <= 0 || bbH <= 0) return null;

  const scaleX = (viewportWidth - padding * 2) / bbW;
  const scaleY = (viewportHeight - padding * 2) / bbH;
  const scale = Math.min(scaleX, scaleY, maxScale);

  const x = (viewportWidth - bbW * scale) / 2 - minX * scale;
  const y = (viewportHeight - bbH * scale) / 2 - minY * scale;

  return { x, y, scale };
}
