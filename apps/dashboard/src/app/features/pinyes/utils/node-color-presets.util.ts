import { FigureZone } from '@muixer/shared';
import { buildCategoricalHexPresets } from '@muixer/ui';

/** The swatch palette offered when customizing a node's color: the categorical palette, for every zone. */
export function nodeColorPresets(): string[] {
  return buildCategoricalHexPresets();
}

/** Whether a node's color can be changed by the user. Editable for every zone except BASE. */
export function isNodeColorEditable(node: { zone: FigureZone; positionType?: string | null }): boolean {
  return node.zone !== FigureZone.BASE;
}
