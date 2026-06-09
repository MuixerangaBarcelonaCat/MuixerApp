import { InstanceNodeItem } from '../models/assignment.model';

/**
 * Repositions `cordo-obert` nodes so they appear just behind the last visible
 * cordon instead of at their fixed template position (which may leave a gap
 * when numberOfCordons < max).
 *
 * Strategy: for each CO node, find its rengla sibling at renglaPosition ==
 * numberOfCordons (the last visible node) and the one before it. Use the
 * radial vector between them to place the CO one step further out.
 */
export function repositionCordoObertNodes(
  nodes: InstanceNodeItem[],
  numberOfCordons: number | null,
): InstanceNodeItem[] {
  if (numberOfCordons === null) return nodes;

  return nodes.map((node) => {
    if (node.positionType !== 'cordo-obert' || !node.renglaId) return node;

    const siblings = nodes.filter(
      (n) => n.renglaId === node.renglaId && n.positionType !== 'cordo-obert',
    );
    const ref = siblings.find((n) => n.renglaPosition === numberOfCordons);
    const prev = siblings.find((n) => n.renglaPosition === numberOfCordons - 1);

    if (!ref) return node;

    const dx = prev ? ref.x - prev.x : 0;
    const dy = prev ? ref.y - prev.y : 0;

    return { ...node, x: ref.x + dx, y: ref.y + dy };
  });
}
