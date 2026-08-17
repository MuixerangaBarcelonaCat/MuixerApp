import { hexToOklch, tone } from './color';
import { buildCategoricalPalette } from './categorical';
import { SEMANTIC, SEMANTIC_LIGHT } from './fixed-colors';

describe('buildCategoricalPalette', () => {
  it('returns 10 normal hues in the documented order: red, green, blue, gold, purple, orange, teal, pink, brown, olive', () => {
    const { normal } = buildCategoricalPalette('light');
    expect(normal).toHaveLength(10);

    const expectedHues = [
      hexToOklch(SEMANTIC.error).h, // red
      hexToOklch(SEMANTIC.success).h, // green
      hexToOklch(SEMANTIC.info).h, // blue
      hexToOklch(SEMANTIC.warning).h, // gold
      hexToOklch('#6B4C91').h, // purple
      hexToOklch('#D4793B').h, // orange
    ];
    normal.slice(0, 6).forEach((color, i) => {
      expect(color.h).toBeCloseTo(expectedHues[i], 1);
    });
  });

  it('keeps all 10 normal hues distinguishable from each other', () => {
    const { normal } = buildCategoricalPalette('light');
    for (let i = 0; i < normal.length; i++) {
      for (let j = i + 1; j < normal.length; j++) {
        const hueDistance = Math.min(
          Math.abs(normal[i].h - normal[j].h),
          360 - Math.abs(normal[i].h - normal[j].h),
        );
        expect(hueDistance).toBeGreaterThan(10);
      }
    }
  });

  it('uses the fixed hand-tuned light variants for the first 6 hues in light mode', () => {
    const { normal, light } = buildCategoricalPalette('light');
    expect(light[0]).toEqual(hexToOklch(SEMANTIC_LIGHT.error));
    expect(light[1]).toEqual(hexToOklch(SEMANTIC_LIGHT.success));
    expect(light[2]).toEqual(hexToOklch(SEMANTIC_LIGHT.info));
    expect(light[3]).toEqual(hexToOklch(SEMANTIC_LIGHT.warning));
    expect(light[4]).toEqual(hexToOklch('#C4B0DC')); // purple-light
    expect(light[5]).toEqual(hexToOklch('#E8C0A0')); // orange-light
    // Sanity: these are genuinely lighter than their base, not just some other fixed color.
    for (let i = 0; i < 6; i++) {
      expect(light[i].l).toBeGreaterThan(normal[i].l);
    }
  });

  it('computes a light-mode muted variant for the 4 hues with no hand-tuned original', () => {
    const { normal, light } = buildCategoricalPalette('light');
    for (let i = 6; i < 10; i++) {
      expect(light[i]).toEqual(tone(normal[i], 'muted', 'light'));
    }
  });

  it('computes every light-scale entry via tone() in dark mode, even the 6 with a hand-tuned original', () => {
    // No dark-mode equivalent was authored for the hand-tuned light values — reusing the
    // light-mode hex here would produce a pale "glow" instead of a receding shadow tone against
    // a dark background.
    const { normal, light } = buildCategoricalPalette('dark');
    for (let i = 0; i < 10; i++) {
      expect(light[i]).toEqual(tone(normal[i], 'muted', 'dark'));
    }
  });
});
