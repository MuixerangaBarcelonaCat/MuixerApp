import { PAPER, buildCategoricalPalette, formatHex } from '@muixer/ui';
import { pinDiscs } from './figure-link.util';
import {
  FIGURE_PALETTE,
  getFigureBand,
  getFigureColor,
  getFigureTint,
} from './figure-palette.util';

describe('figure palette', () => {
  const categorical = buildCategoricalPalette('light').normal.map(formatHex);

  it('uses the theme categorical colors, with scarlet moved last: it is the conflict red, and the first figure of every segment would get it', () => {
    expect(FIGURE_PALETTE).toEqual([...categorical.slice(1), categorical[0]]);
    expect(FIGURE_PALETTE.at(-1)).toBe(categorical[0]);
  });

  it('heads a figure\'s tronc card with a band in its light color, closed by a rule in the dark tone of its pin rim', () => {
    const light = buildCategoricalPalette('light').light.map(formatHex);
    expect(getFigureBand(0)).toEqual({ fill: light[1], rule: pinDiscs(0, 0, 9, FIGURE_PALETTE[0])[1].stroke });
    expect(getFigureBand(FIGURE_PALETTE.length - 1).fill).toBe(light[0]);
    expect(getFigureBand(FIGURE_PALETTE.length + 2)).toEqual(getFigureBand(2));
  });

  it('wraps around once every color has been used', () => {
    expect(getFigureColor(0)).toBe(FIGURE_PALETTE[0]);
    expect(getFigureColor(FIGURE_PALETTE.length + 2)).toBe(FIGURE_PALETTE[2]);
  });

  it('gives each figure a light tint: what the projection tronc panel background looks like (its color at 0x33 alpha over the paper), as an opaque color', () => {
    // 0x33 / 0xff = 20%: each channel is 80% paper + 20% the figure color.
    expect(getFigureTint(0)).toBe(mixWithPaper(FIGURE_PALETTE[0], 0x33 / 0xff));
    expect(getFigureTint(FIGURE_PALETTE.length + 2)).toBe(getFigureTint(2));
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
