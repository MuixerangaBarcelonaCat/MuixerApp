import { buildCategoricalPalette, formatHex } from '@muixer/ui';

/** Per-figure colors, in sortOrder: the theme's categorical palette (normal hues are mode-independent). */
export const FIGURE_PALETTE: readonly string[] = buildCategoricalPalette('light').normal.map(formatHex);

export function getFigureColor(index: number): string {
  return FIGURE_PALETTE[index % FIGURE_PALETTE.length];
}

/**
 * Fill and border for a card framing one figure (e.g. the Troncs tab): the figure color mixed into
 * the card's own base-100, so the card stays opaque and reads as that figure's tint.
 */
export function figureCardTint(color: string): { background: string; border: string } {
  return {
    background: `color-mix(in oklab, ${color} 12%, oklch(var(--b1)))`,
    border: `color-mix(in oklab, ${color} 60%, oklch(var(--b1)))`,
  };
}

/** Tronc panel color when a segment has a single figure — white instead of the palette color. */
export const SINGLE_FIGURE_PANEL_COLOR = '#ffffff';

/** Figure shadow/silhouette color when a segment has a single figure — gray instead of the palette color. */
export const SINGLE_FIGURE_SHADOW_COLOR = '#4b5563';
