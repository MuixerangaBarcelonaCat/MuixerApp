import {
  FigureZone,
  PINYA_NODE_PRESETS,
  TRONC_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
} from '@muixer/shared';

const GENERIC_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#d946ef',
  '#e2e8f0', '#94a3b8', '#1e293b', '#ffffff',
];

/** Returns the recommended swatch palette for a node's zone (deduplicated). */
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
    default:
      colors = GENERIC_PALETTE;
  }
  return [...new Set(colors)];
}
