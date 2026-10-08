import { FigureZone } from '../enums/figure-zone.enum';

/** The minimum a node needs for the «who stands on whom» rule. */
export interface TroncSupportNode {
  id: string;
  zone: FigureZone | `${FigureZone}`;
  z: number;
  standsOnNodeIds?: readonly string[];
}

/**
 * Whether `holder` may stand on `target` once the figure is built: only a TRONC node, and only on
 * a BASE or TRONC node of the floor strictly below it (`z - 1`). Floors are expected to be
 * contiguous — an empty floor leaves the one above it with nothing to stand on.
 */
export function isValidStandsOnTarget(holder: TroncSupportNode, target: TroncSupportNode): boolean {
  if (holder.id === target.id) return false;
  if (holder.zone !== FigureZone.TRONC) return false;
  if (target.zone !== FigureZone.TRONC && target.zone !== FigureZone.BASE) return false;
  return target.z === holder.z - 1;
}

/**
 * Drops every `standsOnNodeIds` entry that no longer holds within `nodes` — missing, duplicated,
 * or failing {@link isValidStandsOnTarget} — and clears it on non-TRONC nodes. Lets callers
 * delete or move nodes freely and clean the links once, before saving.
 */
export function sanitizeStandsOn<T extends TroncSupportNode>(
  nodes: readonly T[],
): (T & { standsOnNodeIds: string[] })[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return nodes.map((node) => {
    const valid = new Set<string>();
    for (const id of node.standsOnNodeIds ?? []) {
      const target = byId.get(id);
      if (target && isValidStandsOnTarget(node, target)) valid.add(id);
    }
    return { ...node, standsOnNodeIds: [...valid] };
  });
}
