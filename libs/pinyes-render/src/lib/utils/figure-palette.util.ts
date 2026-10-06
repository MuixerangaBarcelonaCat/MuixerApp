import { buildCategoricalPalette, formatHex } from '@muixer/ui';

/** Per-figure colors, in sortOrder: the theme's categorical palette (normal hues are mode-independent). */
export const FIGURE_PALETTE: readonly string[] = buildCategoricalPalette('light').normal.map(formatHex);

export function getFigureColor(index: number): string {
  return FIGURE_PALETTE[index % FIGURE_PALETTE.length];
}

/** Tronc panel color when a segment has a single figure — white instead of the palette color. */
export const SINGLE_FIGURE_PANEL_COLOR = '#ffffff';

/** Figure shadow/silhouette color when a segment has a single figure — gray instead of the palette color. */
export const SINGLE_FIGURE_SHADOW_COLOR = '#4b5563';
