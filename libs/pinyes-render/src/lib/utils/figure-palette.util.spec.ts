import { INK, PAPER, buildCategoricalPalette, formatHex } from '@muixer/ui';
import {
  FIGURE_PALETTE,
  SINGLE_FIGURE_PANEL_COLOR,
  SINGLE_FIGURE_SHADOW_COLOR,
  figureCardTint,
  getFigureColor,
  getFigureTint,
} from './figure-palette.util';

describe('figure palette', () => {
  const categorical = buildCategoricalPalette('light').normal.map(formatHex);

  it('uses the theme categorical colors, in order', () => {
    expect(FIGURE_PALETTE).toEqual(categorical);
  });

  it('wraps around once every color has been used', () => {
    expect(getFigureColor(0)).toBe(categorical[0]);
    expect(getFigureColor(categorical.length + 2)).toBe(categorical[2]);
  });

  it('gives each figure a light tint: what the projection tronc panel background looks like (its color at 0x33 alpha over the paper), as an opaque color', () => {
    // 0x33 / 0xff = 20%: each channel is 80% paper + 20% the figure color.
    expect(getFigureTint(0)).toBe(mixWithPaper(categorical[0], 0x33 / 0xff));
    expect(getFigureTint(categorical.length + 2)).toBe(getFigureTint(2));
  });

  it('draws a lone figure on paper, with an ink shadow, instead of a palette color', () => {
    expect(SINGLE_FIGURE_PANEL_COLOR).toBe(PAPER.white);
    expect(SINGLE_FIGURE_SHADOW_COLOR).toBe(INK.mid);
  });

  it('tints a figure card by mixing the figure color into the card surface: 12% fill, 60% border', () => {
    expect(figureCardTint('#c74007')).toEqual({
      background: 'color-mix(in oklab, #c74007 12%, oklch(var(--b1)))',
      border: 'color-mix(in oklab, #c74007 60%, oklch(var(--b1)))',
    });
  });
});

function mixWithPaper(hex: string, amount: number): string {
  const at = (color: string, i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const channel = (i: number) =>
    Math.round(at(PAPER.white, i) * (1 - amount) + at(hex, i) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
