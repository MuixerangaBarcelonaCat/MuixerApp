import { PAPER, buildCategoricalPalette, formatHex } from '@muixer/ui';
import { pinRimColor } from './figure-link.util';

const CATEGORICAL_PALETTE = buildCategoricalPalette('light');
const CATEGORICAL = CATEGORICAL_PALETTE.normal.map(formatHex);
const CATEGORICAL_LIGHT = CATEGORICAL_PALETTE.light.map(formatHex);

/**
 * Per-figure colors, in sortOrder: the theme's categorical palette (normal hues are
 * mode-independent), with its first color, scarlet, moved last — it's the conflict red, and the
 * first figure of every segment would otherwise get it.
 */
export const FIGURE_PALETTE: readonly string[] = [...CATEGORICAL.slice(1), CATEGORICAL[0]];
/** Each figure color's light variant, in the same order. */
const FIGURE_PALETTE_LIGHT: readonly string[] = [...CATEGORICAL_LIGHT.slice(1), CATEGORICAL_LIGHT[0]];

export function getFigureColor(index: number): string {
  return FIGURE_PALETTE[index % FIGURE_PALETTE.length];
}

/** The band heading a figure's tronc card: its light color, closed by a rule in its pin's rim tone. */
export interface FigureBand {
  fill: string;
  rule: string;
}

export function getFigureBand(index: number): FigureBand {
  return {
    fill: FIGURE_PALETTE_LIGHT[index % FIGURE_PALETTE_LIGHT.length],
    rule: pinRimColor(getFigureColor(index)),
  };
}

/** Alpha of the figure color in its light tint. */
const FIGURE_TINT_ALPHA = 0x33 / 0xff;

/**
 * Light version of a figure's color (the color at `0x33` alpha over the paper), baked into an
 * opaque hex so a canvas shape filled with it doesn't let what's behind show through.
 */
export function getFigureTint(index: number): string {
  const color = getFigureColor(index);
  const at = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const channel = (i: number) =>
    Math.round(at(PAPER.white, i) * (1 - FIGURE_TINT_ALPHA) + at(color, i) * FIGURE_TINT_ALPHA)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
