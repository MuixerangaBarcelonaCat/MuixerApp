import {
  ProjectionAssignment,
  projectionShoulderHeight,
} from '../models/projection.model';

export type VarianceLevel = 'success' | 'warning' | 'error';

/**
 * Returns the height variance (max - min shoulderHeight) for all assigned
 * nodes in a given floor. Returns null if fewer than 2 nodes are assigned
 * (no meaningful variance can be computed).
 */
export function floorVariance(
  nodeIds: string[],
  assignments: ProjectionAssignment[],
): number | null {
  const heights: number[] = [];

  for (const nodeId of nodeIds) {
    const assignment = assignments.find((a) => a.node.id === nodeId);
    const shoulderHeight = assignment
      ? projectionShoulderHeight(assignment.person)
      : null;
    if (shoulderHeight != null) {
      heights.push(shoulderHeight);
    }
  }

  if (heights.length < 2) return null;

  return Math.max(...heights) - Math.min(...heights);
}

/**
 * Maps a variance value to a semantic level:
 * - 'success': ≤2 cm (well balanced)
 * - 'warning': 3–4 cm (acceptable)
 * - 'error':   ≥5 cm (needs attention)
 */
export function varianceLevel(variance: number): VarianceLevel {
  if (variance <= 2) return 'success';
  if (variance <= 4) return 'warning';
  return 'error';
}
