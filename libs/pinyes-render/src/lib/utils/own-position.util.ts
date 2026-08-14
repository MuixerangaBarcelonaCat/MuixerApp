import { FigureZone, getSegmentInstanceLabel } from '@muixer/shared';
import { AssignmentDetail, InstanceNodeItem } from '../models/assignment.model';
import { ProjectionInstance, ProjectionSegmentData } from '../models/projection.model';

const TRONC_ZONES = new Set<string>([
  FigureZone.TRONC,
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
]);

export interface OwnPlacement {
  instance: ProjectionInstance;
  instanceIndex: number;
  node: InstanceNodeItem;
  assignment: AssignmentDetail;
}

/** Every assignment `personId` holds in this segment. Normally 0 or 1; invariant 4 permits more. */
export function findOwnPlacements(data: ProjectionSegmentData, personId: string): OwnPlacement[] {
  const placements: OwnPlacement[] = [];

  data.instances.forEach((instance, instanceIndex) => {
    for (const assignment of instance.assignments) {
      if (assignment.person.id !== personId) continue;
      const node = instance.nodes.find((n) => n.id === assignment.node.id);
      if (!node) continue;
      placements.push({ instance, instanceIndex, node, assignment });
    }
  });

  return placements;
}

/**
 * The alias one rengla position inward — position `renglaPosition - 1` of the same `renglaId` —
 * or null when there is nobody there: no rengla, the innermost position, the predecessor node
 * doesn't exist, or it does but is unassigned. «darrere d'un buit» is worse than silence.
 */
export function findRenglaPredecessor(node: InstanceNodeItem, instance: ProjectionInstance): string | null {
  if (node.renglaId == null || node.renglaPosition == null || node.renglaPosition <= 1) return null;

  const predecessor = instance.nodes.find(
    (n) => n.renglaId === node.renglaId && n.renglaPosition === node.renglaPosition! - 1,
  );
  if (!predecessor) return null;

  return findAlias(instance, predecessor.id);
}

export interface TroncNeighbours {
  /** Aliases of the people this node stands on — the floor one z below (or BASE at z=1). */
  below: string[];
  /** Aliases of the people standing on this node — the floor one z above. */
  above: string[];
}

/**
 * Neighbours on the adjacent tronc floors, by span overlap rather than a 1:1 `z` lookup — a
 * node's relative-unit span `[x, x + width)` can cover more than one narrower node on the floor
 * below or above it, and vice versa. BASE nodes (z=0) are positioned by sorted index rather than
 * `x`/`width`, so they get a synthetic `[index, index + 1)` span to join the same coordinate
 * space — the tronc panel's own CSS grid does exactly this
 * (`tronc-view.component.ts` `getTroncNodeGridColumn` / `getBaseNodeGridColumn`).
 */
export function findTroncNeighbours(node: InstanceNodeItem, instance: ProjectionInstance): TroncNeighbours {
  const floors = buildTroncFloors(instance);
  const ownSpan: Span = { start: node.x, end: node.x + node.width };

  return {
    below: namesOverlapping(findNearestFloor(floors, node.z, -1), ownSpan, instance),
    above: namesOverlapping(findNearestFloor(floors, node.z, 1), ownSpan, instance),
  };
}

export type OwnPlacementDescription =
  | {
      kind: 'PINYA';
      instanceIndex: number;
      nodeLabel: string;
      cordon: number | null;
      figureName: string | null;
      behind: string | null;
    }
  | {
      kind: 'TRONC';
      instanceIndex: number;
      nodeLabel: string;
      figureName: string | null;
      below: string[];
      above: string[];
    };

/**
 * Turns a raw placement into the shape `@muixer/shared`'s `formatOwnPosition` renders. BASE
 * counts as `PINYA`: it is drawn on the canvas alongside the pinya nodes
 * (`pinya-projection.component.ts` includes BASE in `getInstanceProjectionNodes`), and that is
 * the position a base member needs to find — their row in the tronc panel is reference only.
 */
export function describeOwnPlacement(placement: OwnPlacement, instanceCount: number): OwnPlacementDescription {
  const { instance, instanceIndex, node } = placement;
  const figureName = instanceCount > 1 ? getSegmentInstanceLabel(instance) : null;

  if (TRONC_ZONES.has(node.zone)) {
    const neighbours = node.zone === FigureZone.TRONC ? findTroncNeighbours(node, instance) : { below: [], above: [] };
    return {
      kind: 'TRONC',
      instanceIndex,
      nodeLabel: node.label,
      figureName,
      below: neighbours.below,
      above: neighbours.above,
    };
  }

  return {
    kind: 'PINYA',
    instanceIndex,
    nodeLabel: node.label,
    figureName,
    cordon: node.renglaPosition ?? null,
    behind: findRenglaPredecessor(node, instance),
  };
}

// ── Internals ────────────────────────────────────────────────────────────────

interface Span {
  start: number;
  end: number;
}

interface TroncFloorNode {
  id: string;
  span: Span;
}

/** Every tronc/base floor in the instance, keyed by `z` (BASE nodes synthesised as `z = 0`). */
function buildTroncFloors(instance: ProjectionInstance): Map<number, TroncFloorNode[]> {
  const floors = new Map<number, TroncFloorNode[]>();

  const troncNodes = instance.nodes.filter((n) => n.zone === FigureZone.TRONC);
  for (const n of troncNodes) {
    const list = floors.get(n.z) ?? [];
    list.push({ id: n.id, span: { start: n.x, end: n.x + n.width } });
    floors.set(n.z, list);
  }

  const baseNodes = [...instance.nodes.filter((n) => n.zone === FigureZone.BASE)].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  if (baseNodes.length > 0) {
    floors.set(
      0,
      baseNodes.map((n, index) => ({ id: n.id, span: { start: index, end: index + 1 } })),
    );
  }

  return floors;
}

/** Walks `direction` (-1 or 1) away from `fromZ`, skipping gaps, until a populated floor is found. */
function findNearestFloor(
  floors: Map<number, TroncFloorNode[]>,
  fromZ: number,
  direction: -1 | 1,
): TroncFloorNode[] | null {
  const MAX_TRONC_Z = 5;
  for (let z = fromZ + direction; z >= 0 && z <= MAX_TRONC_Z; z += direction) {
    const floor = floors.get(z);
    if (floor && floor.length > 0) return floor;
  }
  return null;
}

function namesOverlapping(floor: TroncFloorNode[] | null, ownSpan: Span, instance: ProjectionInstance): string[] {
  if (!floor) return [];

  return floor
    .filter((n) => n.span.start < ownSpan.end && ownSpan.start < n.span.end)
    .sort((a, b) => a.span.start - b.span.start)
    .map((n) => findAlias(instance, n.id))
    .filter((alias): alias is string => alias != null);
}

function findAlias(instance: ProjectionInstance, nodeId: string): string | null {
  return instance.assignments.find((a) => a.node.id === nodeId)?.person.alias ?? null;
}
