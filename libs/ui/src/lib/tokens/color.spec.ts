import {
  hexToOklch,
  formatOklch,
  tone,
  contrastContent,
  generatePrimary,
  generateSecondary,
  sashFromHue,
  sashFromFill,
} from './color';
import { INK, PAPER } from './fixed-colors';

const INK_BLACK = hexToOklch(INK.black);
const PAPER_WHITE = hexToOklch(PAPER.white);

describe('hexToOklch', () => {
  it('converts pure white to L=1, C=0, H=0', () => {
    const result = hexToOklch('#ffffff');
    expect(result.l).toBeCloseTo(1, 3);
    expect(result.c).toBeCloseTo(0, 3);
    expect(result.h).toBe(0);
  });

  it('converts pure black to L=0, C=0, H=0', () => {
    const result = hexToOklch('#000000');
    expect(result.l).toBeCloseTo(0, 3);
    expect(result.c).toBeCloseTo(0, 3);
    expect(result.h).toBe(0);
  });

  it('converts a known chromatic color to its published OKLCH components', () => {
    // Reference values for #ff0000, matching the CSS Color 4 spec's own worked example
    // (oklch(62.8% 0.25768 29.2339)) and independently cross-checked against culori.
    const result = hexToOklch('#ff0000');
    expect(result.l).toBeCloseTo(0.6280, 3);
    expect(result.c).toBeCloseTo(0.2577, 3);
    expect(result.h).toBeCloseTo(29.23, 1);
  });

  it('throws on an invalid hex string', () => {
    expect(() => hexToOklch('not-a-color')).toThrow();
  });
});

describe('formatOklch', () => {
  it('formats an opaque color as a CSS oklch() string with percentage lightness', () => {
    expect(formatOklch({ l: 0.55, c: 0.18, h: 250 })).toBe('oklch(55% 0.18 250)');
  });

  it('rounds lightness to 1 decimal, chroma to 4 decimals, hue to 2 decimals', () => {
    expect(formatOklch({ l: 0.551234, c: 0.171867, h: 24.7791 })).toBe(
      'oklch(55.1% 0.1719 24.78)',
    );
  });

  it('includes an alpha component only when alpha is below 1', () => {
    expect(formatOklch({ l: 0.55, c: 0.18, h: 250 }, 0.5)).toBe('oklch(55% 0.18 250 / 0.5)');
    expect(formatOklch({ l: 0.55, c: 0.18, h: 250 }, 1)).toBe('oklch(55% 0.18 250)');
  });
});

describe('tone', () => {
  const base = { l: 0.55, c: 0.18, h: 250 };

  it('preserves hue for every variant', () => {
    for (const variant of ['hover', 'active', 'focus', 'disabled', 'muted', 'weave'] as const) {
      expect(tone(base, variant, 'light').h).toBe(base.h);
    }
  });

  describe('emphasis variants (hover/active/focus) — move away from the surface', () => {
    it('darken in light mode', () => {
      expect(tone(base, 'hover', 'light').l).toBeLessThan(base.l);
      expect(tone(base, 'active', 'light').l).toBeLessThan(base.l);
      expect(tone(base, 'focus', 'light').l).toBeLessThan(base.l);
    });

    it('lighten in dark mode', () => {
      expect(tone(base, 'hover', 'dark').l).toBeGreaterThan(base.l);
      expect(tone(base, 'active', 'dark').l).toBeGreaterThan(base.l);
      expect(tone(base, 'focus', 'dark').l).toBeGreaterThan(base.l);
    });

    it('leave chroma unchanged', () => {
      expect(tone(base, 'hover', 'light').c).toBeCloseTo(base.c, 5);
      expect(tone(base, 'active', 'light').c).toBeCloseTo(base.c, 5);
      expect(tone(base, 'focus', 'light').c).toBeCloseTo(base.c, 5);
    });

    it('active shifts further than hover, hover further than focus', () => {
      const activeDelta = base.l - tone(base, 'active', 'light').l;
      const hoverDelta = base.l - tone(base, 'hover', 'light').l;
      const focusDelta = base.l - tone(base, 'focus', 'light').l;
      expect(activeDelta).toBeGreaterThan(hoverDelta);
      expect(hoverDelta).toBeGreaterThan(focusDelta);
    });
  });

  describe('recede variants (disabled/muted) — move toward the surface, opposite of emphasis', () => {
    it('lighten and desaturate in light mode', () => {
      const disabled = tone(base, 'disabled', 'light');
      const muted = tone(base, 'muted', 'light');
      expect(disabled.l).toBeGreaterThan(base.l);
      expect(disabled.c).toBeLessThan(base.c);
      expect(muted.l).toBeGreaterThan(base.l);
      expect(muted.c).toBeLessThan(base.c);
    });

    it('darken and desaturate in dark mode', () => {
      const disabled = tone(base, 'disabled', 'dark');
      const muted = tone(base, 'muted', 'dark');
      expect(disabled.l).toBeLessThan(base.l);
      expect(disabled.c).toBeLessThan(base.c);
      expect(muted.l).toBeLessThan(base.l);
      expect(muted.c).toBeLessThan(base.c);
    });
  });

  describe('weave — a fixed decorative micro-shift, not surface-relative', () => {
    it('produces the same result regardless of mode', () => {
      const lightMode = tone(base, 'weave', 'light');
      const darkMode = tone(base, 'weave', 'dark');
      expect(lightMode.l).toBe(darkMode.l);
      expect(lightMode.c).toBe(darkMode.c);
    });

    it('shifts lightness only slightly', () => {
      const result = tone(base, 'weave', 'light');
      expect(Math.abs(result.l - base.l)).toBeLessThan(0.1);
    });
  });

  it('clamps lightness to [0, 1] rather than overflowing', () => {
    const nearWhite = { l: 0.98, c: 0.05, h: 100 };
    const result = tone(nearWhite, 'hover', 'dark');
    expect(result.l).toBeLessThanOrEqual(1);

    const nearBlack = { l: 0.02, c: 0.05, h: 100 };
    const result2 = tone(nearBlack, 'hover', 'light');
    expect(result2.l).toBeGreaterThanOrEqual(0);
  });

  it('never produces negative chroma', () => {
    const lowChroma = { l: 0.5, c: 0.02, h: 100 };
    expect(tone(lowChroma, 'disabled', 'light').c).toBeGreaterThanOrEqual(0);
    expect(tone(lowChroma, 'muted', 'dark').c).toBeGreaterThanOrEqual(0);
  });

  describe('disabled stays visible even when the base is already close to the surface', () => {
    // Regression: secondary's base is L=0.75 (deliberately light, to separate it from primary).
    // A flat +dl shift pushed it to L=0.95, a hair from paper-white's L=0.985 — nearly invisible
    // against the surface it's rendered on. Disabled must keep a minimum gap from the extreme
    // regardless of how light/dark the base already was, not just apply the same flat delta.
    it('never exceeds a visible ceiling in light mode, even for an already-light base', () => {
      const alreadyLight = { l: 0.75, c: 0.08, h: 224 };
      expect(tone(alreadyLight, 'disabled', 'light').l).toBeLessThanOrEqual(0.88);
    });

    it('never drops below a visible floor in dark mode, even for an already-dark base', () => {
      const alreadyDark = { l: 0.3, c: 0.01, h: 90 };
      expect(tone(alreadyDark, 'disabled', 'dark').l).toBeGreaterThanOrEqual(0.12);
    });

    it('leaves an ordinary mid-lightness base unaffected by the clamp', () => {
      const base = { l: 0.55, c: 0.18, h: 250 };
      expect(tone(base, 'disabled', 'light').l).toBeCloseTo(0.75, 5);
    });
  });
});

describe('contrastContent', () => {
  // Picks between the *actual* dark/light content colors passed in — never a hardcoded pure
  // black/white — so callers stay on the warm ink/paper scale instead of breaking it. The
  // decision itself uses APCA (the perceptual contrast model), not the naive WCAG 2.x
  // relative-luminance formula this originally ported: WCAG 2.x is known to under-rate how dark
  // saturated colors — especially blues — actually read, because it weights the blue channel
  // very low (0.0722) in its luminance sum. That's not hypothetical here: the fixed primary
  // target (L=0.58, C=0.17) at a blue hue computes a WCAG luminance of 0.188, just over the old
  // 0.179 threshold, so the old formula picked dark content — while APCA scores white text at
  // ~76 vs. black text's ~34 against that same color (APCA's own guideline wants >=60 for body
  // text), i.e. black text there would have read as too low-contrast in practice.
  it('returns the dark-content color for a light, pale background', () => {
    expect(contrastContent(hexToOklch('#ffffff'), INK_BLACK, PAPER_WHITE)).toEqual(INK_BLACK);
  });

  it('returns the light-content color for a dark background', () => {
    expect(contrastContent(hexToOklch('#000000'), INK_BLACK, PAPER_WHITE)).toEqual(PAPER_WHITE);
  });

  it('returns the light-content color for a vivid mid-tone background', () => {
    const vividRed = hexToOklch('#C23B3B');
    expect(contrastContent(vividRed, INK_BLACK, PAPER_WHITE)).toEqual(PAPER_WHITE);
  });

  it('returns the dark-content color for a pastel light enough that it already reads fine', () => {
    const pastelRed = hexToOklch('#E8A0A0');
    expect(contrastContent(pastelRed, INK_BLACK, PAPER_WHITE)).toEqual(INK_BLACK);
  });

  it('picks light content for a vivid saturated blue, where WCAG 2.x luminance would wrongly pick dark', () => {
    // The regression this test guards: primary at the fixed L=0.58/C=0.17 target, blue hue —
    // #4972de. WCAG 2.x relative luminance (0.188) narrowly favors dark text (4.76:1 vs
    // 4.41:1); APCA correctly identifies white text as dramatically more legible (~76 vs ~34).
    const vividBlue = { l: 0.58, c: 0.17, h: 265.52 };
    expect(contrastContent(vividBlue, INK_BLACK, PAPER_WHITE)).toEqual(PAPER_WHITE);
  });

  it('picks light content for a background whose OKLCH values fall outside the sRGB gamut', () => {
    // Regression: the sash's fixed L=0.52/C=0.2 target combined with certain hues (e.g. a
    // red-orange shirt color around h=33, reported against #B32400) produces an OKLCH triple
    // that's out of sRGB gamut — culori's rgb converter returns a negative blue channel for it
    // uncorrected. Feeding that straight into the APCA luminance calculation collapsed both
    // candidates' contrast to 0 (a tie, wrongly resolved to dark/ink by the >= tie-break) even
    // though the color is clearly dark enough to need light content — confirmed by computing
    // contrast against the same L/C/H after gamut-mapping (culori's clampChroma), which scores
    // light content at ~80 vs. dark's ~24.
    const outOfGamutRedOrange = { l: 0.52, c: 0.2, h: 33.24 };
    expect(contrastContent(outOfGamutRedOrange, INK_BLACK, PAPER_WHITE)).toEqual(PAPER_WHITE);
  });

  it('never falls back to a hardcoded pure black or white — only the two colors passed in', () => {
    const customDark = hexToOklch('#123456');
    const customLight = hexToOklch('#f0e6d2');
    const result = contrastContent(hexToOklch('#000000'), customDark, customLight);
    expect(result).toEqual(customLight);
    expect(result).not.toEqual(hexToOklch('#ffffff'));
  });
});

describe('generatePrimary', () => {
  it('re-normalizes a dark, low-chroma shirt color to the same fixed L/C as a vivid one', () => {
    // The entire point of the formula (per the plan): don't use the raw shirt color — a dark
    // navy and a bright sky blue should land on the SAME lightness/chroma target, only
    // differing in hue.
    const fromDarkNavy = generatePrimary('#1E3A8A');
    const fromVividBlue = generatePrimary('#3B82F6');
    expect(fromDarkNavy.l).toBeCloseTo(fromVividBlue.l, 5);
    expect(fromDarkNavy.c).toBeCloseTo(fromVividBlue.c, 5);
  });

  it("preserves each input's own hue rather than normalizing that too", () => {
    const { h: navyHue } = hexToOklch('#1E3A8A');
    const { h: blueHue } = hexToOklch('#3B82F6');
    expect(generatePrimary('#1E3A8A').h).toBeCloseTo(navyHue, 1);
    expect(generatePrimary('#3B82F6').h).toBeCloseTo(blueHue, 1);
    // Sanity: these two inputs are NOT the same hue, so the test above isn't vacuous.
    expect(Math.abs(navyHue - blueHue)).toBeGreaterThan(1);
  });
});

describe('generateSecondary', () => {
  // Secondary is no longer sash-derived — it's a muted sibling of primary (same hue, lighter
  // AND lower chroma), safe for generic "second button" use anywhere in the app. The sash motif
  // isn't mapped into any DaisyUI color slot at all (see sashFromHue/sashFromFill below) —
  // DaisyUI's own accent is a separate, fixed color untouched by any colla-specific data.
  it("shares primary's hue but at a distinctly lower chroma", () => {
    const primary = generatePrimary('#1E3A8A');
    const secondary = generateSecondary(primary);
    expect(secondary.h).toBeCloseTo(primary.h, 5);
    expect(secondary.c).toBeLessThan(primary.c);
  });

  it('is also distinctly lighter than primary, not just less saturated', () => {
    // A same-lightness, chroma-only difference reads as too subtle — pairing it with a
    // lightness shift gives two independent perceptual dimensions of separation instead of one.
    const primary = generatePrimary('#1E3A8A');
    const secondary = generateSecondary(primary);
    expect(secondary.l).toBeGreaterThan(primary.l + 0.05);
  });

  it('is deterministic — always the same fixed L/C, only hue varies with the input primary', () => {
    const fromNavy = generateSecondary(generatePrimary('#1E3A8A'));
    const fromGreen = generateSecondary(generatePrimary('#2E7D32'));
    expect(fromNavy.l).toBeCloseTo(fromGreen.l, 5);
    expect(fromNavy.c).toBeCloseTo(fromGreen.c, 5);
    expect(fromNavy.h).not.toBeCloseTo(fromGreen.h, 1);
  });
});

describe('sashFromHue', () => {
  it("uses the sash color's hue but the fixed sash L/C, distinct from primary's", () => {
    const sash = sashFromHue('#C23B3B', 'light', INK_BLACK, PAPER_WHITE);
    const primary = generatePrimary('#C23B3B');
    expect(sash.fill.l).not.toBeCloseTo(primary.l, 2);
    expect(sash.fill.c).not.toBeCloseTo(primary.c, 2);
  });

  it("stays distinct from the fixed error token's L/C even when the hue matches", () => {
    // The confusability mitigation from the plan (§2.1a): a red sash must not chromatically
    // coincide with the fixed error color, even though both are "red".
    const redSash = sashFromHue('#C23B3B', 'light', INK_BLACK, PAPER_WHITE);
    const errorOklch = hexToOklch('#C23B3B'); // the fixed error token itself
    const sameL = Math.abs(redSash.fill.l - errorOklch.l) < 0.01;
    const sameC = Math.abs(redSash.fill.c - errorOklch.c) < 0.01;
    expect(sameL && sameC).toBe(false);
  });

  it('picks light (paper) content for #B32400 — a real colla sash color whose fixed L/C target falls outside the sRGB gamut', () => {
    const sash = sashFromHue('#B32400', 'light', INK_BLACK, PAPER_WHITE);
    expect(sash.content).toEqual(PAPER_WHITE);
  });

  it('derives content and edge from the same ink/paper pair contrastContent would pick, and weaveFill from the generated fill', () => {
    const sash = sashFromHue('#C23B3B', 'light', INK_BLACK, PAPER_WHITE);
    expect(sash.content).toEqual(contrastContent(sash.fill, INK_BLACK, PAPER_WHITE));
    expect(sash.edge).toEqual(sash.content);
    expect(sash.weaveFill).toEqual(tone(sash.fill, 'weave', 'light'));
    // Never pure black/white — always the ink/paper tokens passed in.
    expect(sash.content).not.toEqual(hexToOklch('#000000'));
    expect(sash.content).not.toEqual(hexToOklch('#ffffff'));
  });
});

describe('sashFromFill', () => {
  it('builds the same token shape from a hand-picked preset fill (the white/black sash case)', () => {
    const sash = sashFromFill(PAPER_WHITE, 'light', INK_BLACK, PAPER_WHITE);
    expect(sash.fill).toEqual(PAPER_WHITE);
    expect(sash.content).toEqual(INK_BLACK); // paper-white fill needs dark (ink) content
    expect(sash.weaveFill).toEqual(tone(PAPER_WHITE, 'weave', 'light'));
  });

  it('picks the light-content color for a near-black preset fill', () => {
    const sash = sashFromFill(INK_BLACK, 'light', INK_BLACK, PAPER_WHITE);
    expect(sash.content).toEqual(PAPER_WHITE);
  });
});
