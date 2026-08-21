import { hexToOklch, tone } from './color';
import { buildCategoricalPalette } from './categorical';
import { SEMANTIC } from './fixed-colors';

describe('buildCategoricalPalette', () => {
  it('returns 10 normal hues in the documented order: red, green, blue, gold, purple, orange, teal, pink, brown, olive', () => {
    const { normal } = buildCategoricalPalette('light');
    expect(normal).toHaveLength(10);

    const expectedHues = [
      hexToOklch(SEMANTIC.error).h, // red
      hexToOklch(SEMANTIC.success).h, // green
      hexToOklch(SEMANTIC.info).h, // blue
      hexToOklch('#cfa72b').h, // gold — categorical-only, not the semantic warning hex
      hexToOklch('#77579e').h, // purple — no semantic role, categorical-only
      hexToOklch('#D4793B').h, // orange — no semantic role, categorical-only
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

  it('uses the fixed hand-tuned light variants for red, gold, orange and pink in light mode', () => {
    const { normal, light } = buildCategoricalPalette('light');
    const handTuned: Record<number, string> = {
      0: '#f39891', // red-light
      3: '#fcd97b', // gold-light
      5: '#facfb6', // orange-light
      7: '#f0b7d8', // pink-light
    };
    for (const [index, hex] of Object.entries(handTuned)) {
      expect(light[Number(index)]).toEqual(hexToOklch(hex));
    }
    // Sanity: these are genuinely lighter than their base, not just some other fixed color.
    for (const index of Object.keys(handTuned)) {
      expect(light[Number(index)].l).toBeGreaterThan(normal[Number(index)].l);
    }
  });

  it('computes a light-mode muted variant for the 6 hues with no hand-tuned original', () => {
    const { normal, light } = buildCategoricalPalette('light');
    for (const i of [1, 2, 4, 6, 8, 9]) {
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
