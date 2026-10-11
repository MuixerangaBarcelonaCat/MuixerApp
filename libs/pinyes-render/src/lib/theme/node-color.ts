import { FigureZone } from '@muixer/shared';
import { NODE_TYPE_NEUTRAL, NODE_TYPE_NEUTRAL_DARK, NODE_TYPE_PALETTE, NODE_TYPE_PALETTE_DARK, NodeTones, ThemeMode } from '@muixer/ui';

/**
 * The tones a figure node is drawn with. A stored `color` means the user customized it and is drawn
 * as it is; `null` means "follow the type" and resolves here, at render time, to the type palette.
 * BASE nodes are always neutral: their color can't be edited. A customized color is the same in both
 * modes; the type palette has a dark version.
 */
export function resolveNodeTones(
  node: { zone: string; positionType: string | null | undefined; color: string | null },
  mode: ThemeMode = 'light',
): NodeTones {
  const [palette, neutral] = mode === 'dark' ? [NODE_TYPE_PALETTE_DARK, NODE_TYPE_NEUTRAL_DARK] : [NODE_TYPE_PALETTE, NODE_TYPE_NEUTRAL];
  if (node.zone === FigureZone.BASE) return neutral;
  if (node.color) return { wash: node.color, pencil: node.color };
  return (node.positionType && palette[node.positionType]) || neutral;
}

/** The color that stands for a position type outside the canvas (tag chips, preset swatches): its pencil tone. */
export function positionTypeColor(positionType: string, mode: ThemeMode = 'light'): string {
  const [palette, neutral] = mode === 'dark' ? [NODE_TYPE_PALETTE_DARK, NODE_TYPE_NEUTRAL_DARK] : [NODE_TYPE_PALETTE, NODE_TYPE_NEUTRAL];
  return (palette[positionType] ?? neutral).pencil;
}

type PaintableNode = { zone: string; positionType: string | null | undefined; color: string | null };

/** A node's fill: the wash of its type, its customized color, or nothing for an uncolored decoration. */
export function nodeFill(node: PaintableNode, mode: ThemeMode = 'light'): string {
  if (node.zone === FigureZone.DECORATION) return node.color ?? 'transparent';
  return resolveNodeTones(node, mode).wash;
}
