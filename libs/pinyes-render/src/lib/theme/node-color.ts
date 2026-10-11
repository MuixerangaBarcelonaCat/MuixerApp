import { FigureZone } from '@muixer/shared';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_PALETTE, NodeTones } from '@muixer/ui';

/**
 * The tones a figure node is drawn with. A stored `color` means the user customized it and is drawn
 * as it is; `null` means "follow the type" and resolves here, at render time, to the type palette.
 * BASE nodes are always neutral: their color can't be edited.
 */
export function resolveNodeTones(node: { zone: string; positionType: string | null | undefined; color: string | null }): NodeTones {
  if (node.zone === FigureZone.BASE) return NODE_TYPE_NEUTRAL;
  if (node.color) return { wash: node.color, pencil: node.color };
  return (node.positionType && NODE_TYPE_PALETTE[node.positionType]) || NODE_TYPE_NEUTRAL;
}

/** The color that stands for a position type outside the canvas (tag chips, preset swatches): its pencil tone. */
export function positionTypeColor(positionType: string): string {
  return (NODE_TYPE_PALETTE[positionType] ?? NODE_TYPE_NEUTRAL).pencil;
}

type PaintableNode = { zone: string; positionType: string | null | undefined; color: string | null };

/** A node's fill: the wash of its type, its customized color, or nothing for an uncolored decoration. */
export function nodeFill(node: PaintableNode): string {
  if (node.zone === FigureZone.DECORATION) return node.color ?? 'transparent';
  return resolveNodeTones(node).wash;
}
