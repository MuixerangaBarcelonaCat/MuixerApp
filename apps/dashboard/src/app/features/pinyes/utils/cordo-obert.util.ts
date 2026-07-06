import { InstanceNodeItem } from '../models/assignment.model';

/**
 * Computes x/y position overrides for `cordo-obert` nodes in each rengla.
 *
 * @param nodes - All instance nodes for the figure.
 * @param selectTarget - Called per rengla with the cordo-obert node and the
 *   other sorted rengla nodes. Return the node whose position the cordo-obert
 *   should adopt, or `undefined` to leave it in place.
 */
export function computeCordoObertOverrides(
  nodes: InstanceNodeItem[],
  selectTarget: (
    cordoObert: InstanceNodeItem,
    sortedRenglaNodes: InstanceNodeItem[],
  ) => InstanceNodeItem | undefined,
): Map<string, { x: number; y: number }> {
  const overrides = new Map<string, { x: number; y: number }>();

  const byRengla = new Map<string, InstanceNodeItem[]>();
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
