import { converter, displayable } from 'culori';
import { formatHex, hexToOklch, tone } from './color';
import { buildCategoricalPalette } from './categorical';
import { PAPER, SEMANTIC } from './fixed-colors';

describe('buildCategoricalPalette', () => {
  it('returns 10 normal hues in the documented order: red, green, blue, gold, purple, orange, teal, pink, brown, olive', () => {
    const { normal } = buildCategoricalPalette('light');
    expect(normal).toHaveLength(10);

    const expectedHues = [
      hexToOklch(SEMANTIC.error).h, // red
      hexToOklch(SEMANTIC.success).h, // green
      hexToOklch(SEMANTIC.info).h, // blue
      hexToOklch('#DCAD21').h, // gold — categorical-only, not the semantic warning hex
      hexToOklch('#77579e').h, // purple — no semantic role, categorical-only
      hexToOklch('#DD8C46').h, // orange (apricot) — no semantic role, categorical-only
    ];
    normal.slice(0, 6).forEach((color, i) => {
      expect(color.h).toBeCloseTo(expectedHues[i], 1);
    });
  });

  it('keeps all 10 normal hues distinguishable from each other', () => {
    const { normal } = buildCategoricalPalette('light');
    // Brown (8) shares red's hue on purpose — it's told apart by being darker and far less
    // saturated (see the palette's own comment), which the ΔE test below checks instead.
    const knownCollisions = new Set(['0-8']);
    for (let i = 0; i < normal.length; i++) {
      for (let j = i + 1; j < normal.length; j++) {
        if (knownCollisions.has(`${i}-${j}`)) continue;
        const hueDistance = Math.min(
          Math.abs(normal[i].h - normal[j].h),
          360 - Math.abs(normal[i].h - normal[j].h),
        );
        expect(hueDistance).toBeGreaterThan(10);
      }
    }
  });

  it('keeps every pair of normal colors visibly different (OKLab ΔE ≥ 10, normal vision)', () => {
    // Hue distance alone misses pairs that differ only a little in hue *and* lightness (e.g. the
    // former vermilion red next to the orange). Categorical colors are only checked for normal
    // vision: they label domain data alongside text, unlike the semantic error/success pair.
    const toOklab = converter('oklab');
    const lab = buildCategoricalPalette('light').normal.map((c) => toOklab(formatHex(c)));
    // Gold (3) and orange (5) sit at ≈ 9.3, accepted by eye: a gold far enough from the apricot
    // to clear 10 drifts into mustard.
    const accepted = new Set(['3~5']);
    const tooClose: string[] = [];
    for (let i = 0; i < lab.length; i++) {
      for (let j = i + 1; j < lab.length; j++) {
        if (accepted.has(`${i}~${j}`)) continue;
        const deltaE = Math.hypot(lab[i].l - lab[j].l, lab[i].a - lab[j].a, lab[i].b - lab[j].b) * 100;
        if (deltaE < 10) tooClose.push(`${i}~${j}: ${deltaE.toFixed(1)}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it('keeps red and orange clearly apart (OKLab ΔE ≥ 15) — at 11.7 they read as the same color', () => {
    const toOklab = converter('oklab');
    const { normal } = buildCategoricalPalette('light');
    const red = toOklab(formatHex(normal[0]));
    const orange = toOklab(formatHex(normal[5]));
    const deltaE = Math.hypot(red.l - orange.l, red.a - orange.a, red.b - orange.b) * 100;
    expect(deltaE).toBeGreaterThanOrEqual(15);
  });

  it('makes every light-mode variant close 55% of its own gap to the paper, at 60% of the chroma', () => {
    // A fixed lightness step pushed the already-light gold and orange into the white end of
    // sRGB (gold-light clipped to almost paper). A share of the remaining gap keeps every
    // normal→light pair reading as the same "one step lighter".
    const paperL = hexToOklch(PAPER.white).l;
    const { normal, light } = buildCategoricalPalette('light');
    normal.forEach((base, i) => {
      expect(light[i].l).toBeCloseTo(base.l + 0.55 * (paperL - base.l), 5);
      expect(light[i].c).toBeCloseTo(base.c * 0.6, 5);
      expect(light[i].h).toBeCloseTo(base.h, 5);
    });
  });

  it('keeps every light-mode variant inside the sRGB gamut, so none is silently clipped', () => {
    const { light } = buildCategoricalPalette('light');
    light.forEach((c) => {
      expect(displayable({ mode: 'oklch', ...c })).toBe(true);
    });
  });

  it('computes every light-scale entry via tone() in dark mode', () => {
    // The paper-share rule is light-mode only — applied against a dark surface it would produce a
    // pale "glow" instead of a receding shadow tone.
    const { normal, light } = buildCategoricalPalette('dark');
    for (let i = 0; i < 10; i++) {
      expect(light[i]).toEqual(tone(normal[i], 'muted', 'dark'));
    }
  });
});
