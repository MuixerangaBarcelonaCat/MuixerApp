export interface CordoObertPositionable {
  id: string;
  x: number;
  y: number;
  renglaId: string | null;
  renglaPosition: number | null;
  positionType?: string | null;
}

/**
 * Computes x/y position overrides for `cordo-obert` nodes in each rengla.
 *
 * @param nodes - All instance nodes for the figure.
 * @param selectTarget - Called per rengla with the cordo-obert node and the
 *   other sorted rengla nodes. Return the node whose position the cordo-obert
 *   should adopt, or `undefined` to leave it in place.
 */
export function computeCordoObertOverrides<T extends CordoObertPositionable>(
  nodes: T[],
  selectTarget: (cordoObert: T, sortedRenglaNodes: T[]) => T | undefined,
): Map<string, { x: number; y: number }> {
  const overrides = new Map<string, { x: number; y: number }>();

  const byRengla = new Map<string, T[]>();
  for (const node of nodes) {
    if (!node.renglaId) continue;
    const list = byRengla.get(node.renglaId) ?? [];
    list.push(node);
    byRengla.set(node.renglaId, list);
  }

  for (const renglaNodes of byRengla.values()) {
    const sorted = [...renglaNodes].sort(
      (a, b) => (a.renglaPosition ?? 0) - (b.renglaPosition ?? 0),
    );
    const cordoObert = sorted.find((n) => n.positionType === 'cordo-obert');
    if (!cordoObert) continue;

    const others = sorted.filter((n) => n.id !== cordoObert.id);
    const target = selectTarget(cordoObert, others);
    if (target) {
      overrides.set(cordoObert.id, { x: target.x, y: target.y });
    }
  }

  return overrides;
}

/**
 * Repositions cordo-obert nodes onto the first node hidden by numberOfCordons
 * (the node right past the visible boundary), so the "extra cord" always sits
 * at the last possible rengla position instead of its own stored spot.
 *
 * @param allNodes - Unfiltered nodes for the figure (needed to find the hidden target).
 * @param visibleNodes - The nodes actually being rendered (already cordons-filtered).
 */
export function repositionCordoObertNodes<T extends CordoObertPositionable>(
  allNodes: CordoObertPositionable[],
  visibleNodes: T[],
  numberOfCordons: number | null,
): T[] {
  if (numberOfCordons === null) return visibleNodes;

  const overrides = computeCordoObertOverrides(allNodes, (_, others) =>
    others.find((n) => n.renglaPosition !== null && n.renglaPosition > numberOfCordons),
  );
  if (overrides.size === 0) return visibleNodes;

  return visibleNodes.map((n) => {
    const pos = overrides.get(n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : n;
  });
}
