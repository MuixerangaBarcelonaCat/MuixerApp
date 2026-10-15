import { buildCategoricalPalette, formatHex } from '@muixer/ui';
import { FIGURE_PALETTE, figureCardTint, getFigureColor, getFigureTint } from './figure-palette.util';

describe('figure palette', () => {
  const categorical = buildCategoricalPalette('light').normal.map(formatHex);

  it('uses the theme categorical colors, in order', () => {
    expect(FIGURE_PALETTE).toEqual(categorical);
  });

  it('wraps around once every color has been used', () => {
    expect(getFigureColor(0)).toBe(categorical[0]);
    expect(getFigureColor(categorical.length + 2)).toBe(categorical[2]);
  });

  it('gives each figure a light tint: what the projection tronc panel background looks like (its color at 0x33 alpha over white), as an opaque color', () => {
    // 0x33 / 0xff = 20%: each channel is 80% white + 20% the figure color.
    expect(getFigureTint(0)).toBe(mixWithWhite(categorical[0], 0x33 / 0xff));
    expect(getFigureTint(categorical.length + 2)).toBe(getFigureTint(2));
  });

  it('tints a figure card by mixing the figure color into the card surface: 12% fill, 60% border', () => {
    expect(figureCardTint('#c74007')).toEqual({
      background: 'color-mix(in oklab, #c74007 12%, oklch(var(--b1)))',
      border: 'color-mix(in oklab, #c74007 60%, oklch(var(--b1)))',
    });
  });
});

function mixWithWhite(hex: string, amount: number): string {
  const channel = (i: number) =>
    Math.round(255 * (1 - amount) + parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
