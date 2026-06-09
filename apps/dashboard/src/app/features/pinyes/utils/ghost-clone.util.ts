import { FigureZone } from '@muixer/shared';
import { isCentralNode } from './rengla-coordinates.util';

export interface GhostPositionInput {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Arithmetic mean of all node positions — acts as the radial origin
 * for ghost placement direction.
 */
export function calculatePinyaCentroid(
  nodes: readonly GhostPositionInput[],
): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const n of nodes) {
    sumX += n.x;
    sumY += n.y;
  }
  return { x: sumX / nodes.length, y: sumY / nodes.length };
}

const DEFAULT_GAP = 3;

/**
 * Computes the position for a ghost node placed directly behind the
 * source node, using the node's own rotation to determine direction.
 *
 * Convention: a node rotated R degrees faces outward at angle R.
 * The direction vector is (sin(R), -cos(R)), which maps:
 *   0°   → up (north)
 *   90°  → right (east)
 *   180° → down (south)
 *   270° → left (west)
 *   45°  → upper-right, etc.
 *
 * The offset is node.height + gap (tight placement, ~3px visible gap).
 */
export function calculateGhostPosition(
  node: GhostPositionInput,
  gap: number = DEFAULT_GAP,
): { x: number; y: number } {
  const rad = (node.rotation * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirY = -Math.cos(rad);
  const offset = node.height + gap;

  return {
    x: Math.round(node.x + dirX * offset),
    y: Math.round(node.y + dirY * offset),
  };
}

/**
 * Only PINYA nodes that are not central (agulla, crossa, contrafort, tap)
 * and not cordó obert are eligible for ghost clone.
 */
export function isGhostEligible(node: {
  zone: string;
  positionType: string | null;
}): boolean {
  if (node.zone !== FigureZone.PINYA) return false;
  if (isCentralNode(node.positionType)) return false;
  if (node.positionType === 'cordo-obert') return false;
  return true;
}
