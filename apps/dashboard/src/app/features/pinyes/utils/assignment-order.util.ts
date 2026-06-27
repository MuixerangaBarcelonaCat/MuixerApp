import { FigureZone } from '@muixer/shared';

export interface AssignmentOrderNode {
  id: string;
  zone: string;
  positionType: string | null;
  renglaPosition: number | null;
  x: number;
  y: number;
  z: number;
  sortOrder: number;
}

const NAMED_PINYA_TYPES = new Set(['agulla', 'contrafort', 'crossa', 'cordo-obert', 'mans', 'vents', 'laterals']);

/**
 * Returns priority buckets for the pinya canvas view.
 * Includes BASE and PINYA nodes only; excludes TRONC, DIRECTION, DECORATION.
 *
 * Order: BASE → agulla → crossa → contrafort →
 *   [mans/vents/laterals/others per cordon ascending] → cordo-obert → pinya-rest
 */
export function buildPinyaBuckets(
  nodes: readonly AssignmentOrderNode[],
): AssignmentOrderNode[][] {
  const buckets: AssignmentOrderNode[][] = [];

  const sorted = (fn: (node: AssignmentOrderNode) => boolean): AssignmentOrderNode[] =>
    [...nodes.filter(fn)].sort((a, b) => a.sortOrder - b.sortOrder);

  const push = (fn: (node: AssignmentOrderNode) => boolean): void => {
    const group = sorted(fn);
    if (group.length > 0) buckets.push(group);
  };

  push((n) => n.zone === FigureZone.BASE);
  push((n) => n.zone === FigureZone.PINYA && n.positionType === 'agulla');
  push((n) => n.zone === FigureZone.PINYA && n.positionType === 'crossa');
  push((n) => n.zone === FigureZone.PINYA && n.positionType === 'contrafort');

  const cordons = [
    ...new Set(
      nodes
        .filter((n) => n.zone === FigureZone.PINYA && n.renglaPosition !== null)
        .map((n) => n.renglaPosition as number),
    ),
  ].sort((a, b) => a - b);

  for (const cordon of cordons) {
    const inCordon = (type: string): AssignmentOrderNode[] =>
      sorted((n) => n.zone === FigureZone.PINYA && n.positionType === type && n.renglaPosition === cordon);

    const mans = inCordon('mans');
    if (mans.length > 0) buckets.push(mans);

    const vents = inCordon('vents');
    if (vents.length > 0) buckets.push(vents);

    const laterals = inCordon('laterals');
    if (laterals.length > 0) buckets.push(laterals);

    push(
      (n) =>
        n.zone === FigureZone.PINYA &&
        n.renglaPosition === cordon &&
        n.positionType !== 'mans' &&
        n.positionType !== 'vents' &&
        n.positionType !== 'laterals' &&
        n.positionType !== 'agulla' &&
        n.positionType !== 'contrafort' &&
        n.positionType !== 'crossa' &&
        n.positionType !== 'cordo-obert',
    );
  }

  push((n) => n.zone === FigureZone.PINYA && n.positionType === 'cordo-obert');
  push(
    (n) =>
      n.zone === FigureZone.PINYA &&
      n.renglaPosition === null &&
      !NAMED_PINYA_TYPES.has(n.positionType ?? ''),
  );

  return buckets;
}

/**
 * Returns priority buckets for the tronc panel view.
 * Includes BASE, TRONC, and DIRECTION nodes only; excludes PINYA and DECORATION.
 *
 * Order: BASE → [TRONC floor z=1] → [TRONC floor z=2] → … → DIRECTION
 * Within each floor, nodes are sorted left-to-right (ascending x).
 */
export function buildTroncBuckets(
  nodes: readonly AssignmentOrderNode[],
): AssignmentOrderNode[][] {
  const buckets: AssignmentOrderNode[][] = [];

  const sorted = (fn: (node: AssignmentOrderNode) => boolean): AssignmentOrderNode[] =>
    [...nodes.filter(fn)].sort((a, b) => a.sortOrder - b.sortOrder);

  const push = (fn: (node: AssignmentOrderNode) => boolean): void => {
    const group = sorted(fn);
    if (group.length > 0) buckets.push(group);
  };

  push((n) => n.zone === FigureZone.BASE);

  // TRONC: group by z (ascending = bottom floor first), sort within floor by x
  const zLevels = [
    ...new Set(
      nodes.filter((n) => n.zone === FigureZone.TRONC).map((n) => n.z),
    ),
  ].sort((a, b) => a - b);

  for (const z of zLevels) {
    const floor = [...nodes.filter((n) => n.zone === FigureZone.TRONC && n.z === z)].sort(
      (a, b) => a.x - b.x,
    );
    if (floor.length > 0) buckets.push(floor);
  }

  push((n) => n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION);

  return buckets;
}

/**
 * Given the priority buckets, finds the next unassigned visible node starting
 * from the bucket that contains `justAssignedId`. Searches the same bucket
 * first, then advances to the next (wrapping around). Returns null when all
 * visible nodes are assigned.
 *
 * `justAssignedId` is always skipped regardless of `assignedIds` state.
 */
export function pickNextAssignableNode(
  buckets: AssignmentOrderNode[][],
  justAssignedId: string,
  assignedIds: ReadonlySet<string>,
  visibleIds: ReadonlySet<string>,
): AssignmentOrderNode | null {
  const bucketIndex = buckets.findIndex((b) => b.some((n) => n.id === justAssignedId));
  if (bucketIndex === -1) return null;

  for (let offset = 0; offset < buckets.length; offset++) {
    const idx = (bucketIndex + offset) % buckets.length;
    for (const node of buckets[idx]) {
      if (node.id !== justAssignedId && visibleIds.has(node.id) && !assignedIds.has(node.id)) {
        return node;
      }
    }
  }

  return null;
}
