import {
  FigureZone,
  PINYA_NODE_PRESETS,
  TRONC_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
} from '@muixer/shared';
import { FIGURE_PALETTE, SINGLE_FIGURE_SHADOW_COLOR } from './figure-palette.util';

const DECORATION_PALETTE = [...FIGURE_PALETTE, '#000000', SINGLE_FIGURE_SHADOW_COLOR, '#eeeeee'];

/** Returns the recommended swatch palette for a node's zone (deduplicated). Empty for BASE — no predefined colors. */
export function getPresetColorsForZone(zone: FigureZone): string[] {
  let colors: string[];
  switch (zone) {
    case FigureZone.PINYA:
      colors = PINYA_NODE_PRESETS.map((p) => p.color).filter(Boolean) as string[];
      break;
    case FigureZone.TRONC:
      colors = TRONC_NODE_PRESETS.map((p) => p.color).filter(Boolean) as string[];
      break;
    case FigureZone.FIGURE_DIRECTION:
    case FigureZone.XICALLA_DIRECTION:
      colors = DIRECTION_NODE_PRESETS.map((p) => p.color).filter(Boolean) as string[];
      break;
    case FigureZone.DECORATION:
      colors = DECORATION_PALETTE;
      break;
    default:
      colors = [];
  }
  return [...new Set(colors)];
}

/** Whether a node's color can be changed by the user. Editable for every zone except BASE. */
export function isNodeColorEditable(node: { zone: FigureZone; positionType?: string | null }): boolean {
  return node.zone !== FigureZone.BASE;
}
