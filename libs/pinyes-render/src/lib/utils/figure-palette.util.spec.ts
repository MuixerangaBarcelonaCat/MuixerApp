import { buildCategoricalPalette, formatHex } from '@muixer/ui';
import { FIGURE_PALETTE, figureCardTint, getFigureColor } from './figure-palette.util';

describe('figure palette', () => {
  const categorical = buildCategoricalPalette('light').normal.map(formatHex);

  it('uses the theme categorical colors, in order', () => {
    expect(FIGURE_PALETTE).toEqual(categorical);
  });

  it('wraps around once every color has been used', () => {
    expect(getFigureColor(0)).toBe(categorical[0]);
    expect(getFigureColor(categorical.length + 2)).toBe(categorical[2]);
  });

  it('tints a figure card by mixing the figure color into the card surface: 12% fill, 60% border', () => {
    expect(figureCardTint('#c74007')).toEqual({
      background: 'color-mix(in oklab, #c74007 12%, oklch(var(--b1)))',
      border: 'color-mix(in oklab, #c74007 60%, oklch(var(--b1)))',
    });
  });
});
