import { buildCategoricalPalette, formatHex } from '@muixer/ui';
import { FIGURE_PALETTE, getFigureColor } from './figure-palette.util';

describe('figure palette', () => {
  const categorical = buildCategoricalPalette('light').normal.map(formatHex);

  it('uses the theme categorical colors, in order', () => {
    expect(FIGURE_PALETTE).toEqual(categorical);
  });

  it('wraps around once every color has been used', () => {
    expect(getFigureColor(0)).toBe(categorical[0]);
    expect(getFigureColor(categorical.length + 2)).toBe(categorical[2]);
  });
});
