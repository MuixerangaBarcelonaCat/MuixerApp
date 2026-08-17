import { generateCollaTheme } from './theme';
import { hexToOklch, formatOklch, generatePrimary, generateSecondary, tone } from './color';
import { INK, PAPER, ACCENT, SEMANTIC } from './fixed-colors';
import { SHADOW } from './shadow';
import { DURATION, EASE_SPRING } from './motion';

const INK_BLACK_OKLCH = formatOklch(hexToOklch(INK.black));
const PAPER_WHITE_OKLCH = formatOklch(hexToOklch(PAPER.white));

describe('generateCollaTheme', () => {
  it('returns both a light and a dark theme block', () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
    expect(theme.light).toBeDefined();
    expect(theme.dark).toBeDefined();
  });

  it("derives primary from the shirt color's hue, at the fixed primary L/C, in both modes", () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
    const expected = formatOklch(generatePrimary('#1E3A8A'));
    expect(theme.light.primary).toBe(expected);
    expect(theme.dark.primary).toBe(expected); // one L/C target for both modes, per §2.2
  });

  it("derives secondary as a muted sibling of primary — never sash-derived, so it's safe for generic UI use", () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
    const expected = formatOklch(generateSecondary(generatePrimary('#1E3A8A')));
    expect(theme.light.secondary).toBe(expected);
    // Same regardless of sash — secondary has nothing to do with the sash spec.
    const themeWithWhiteSash = generateCollaTheme('#1E3A8A', { kind: 'white' });
    expect(themeWithWhiteSash.light.secondary).toBe(expected);
  });

  describe('accent — fixed, not colla-dependent', () => {
    it('is always the fixed accent color, regardless of shirt or sash', () => {
      const expected = formatOklch(hexToOklch(ACCENT));
      const withRedSash = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
      const withWhiteSash = generateCollaTheme('#2E7D32', { kind: 'white' });
      const withBlackSash = generateCollaTheme('#8A2BE2', { kind: 'black' });
      expect(withRedSash.light.accent).toBe(expected);
      expect(withWhiteSash.light.accent).toBe(expected);
      expect(withBlackSash.light.accent).toBe(expected);
    });

    it('is the same in light and dark mode too', () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
      expect(theme.light.accent).toBe(theme.dark.accent);
    });
  });

  describe('the sash motif — its own custom tokens, not mapped into any DaisyUI color slot', () => {
    it('derives --ds-sash-fill from a real-hue sash via the fixed sash L/C', () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
      const sashHue = hexToOklch(theme.light['--ds-sash-fill'] as unknown as string);
      const inputSashHue = hexToOklch('#C23B3B').h;
      expect(sashHue.h).toBeCloseTo(inputSashHue, 1);
      // Must not just be the raw sash hex re-exported unmodified.
      expect(theme.light['--ds-sash-fill']).not.toBe('#C23B3B');
    });

    it('uses the fixed paper-white preset for a white sash, contrasted with dark content', () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      expect(theme.light['--ds-sash-fill']).toBe(formatOklch(hexToOklch(PAPER.white)));
      expect(theme.light['--ds-sash-content']).toBe(INK_BLACK_OKLCH);
    });

    it('uses the fixed ink-black preset for a black sash, contrasted with light content', () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'black' });
      expect(theme.light['--ds-sash-fill']).toBe(formatOklch(hexToOklch(INK.black)));
      expect(theme.light['--ds-sash-content']).toBe(PAPER_WHITE_OKLCH);
    });

    it('never leaks into the fixed accent value, even with a matching hue', () => {
      // Orange sash should NOT make accent (which is already fixed to orange) look coincidentally
      // "derived" — accent stays constant, sash is fully independent.
      const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: ACCENT });
      expect(theme.light.accent).toBe(formatOklch(hexToOklch(ACCENT)));
      expect(theme.light['--ds-sash-fill']).not.toBe(theme.light.accent);
    });
  });

  it('never produces a pure black/white content color anywhere — always the ink/paper pair', () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
    const contentKeys = [
      'primary-content',
      'secondary-content',
      'accent-content',
      'neutral-content',
      'base-content',
      'info-content',
      'success-content',
      'warning-content',
      'error-content',
    ] as const;
    for (const key of contentKeys) {
      const value = theme.light[key];
      expect(value === '#000000' || value === '#ffffff').toBe(false);
      expect(value === INK_BLACK_OKLCH || value === PAPER_WHITE_OKLCH).toBe(true);
    }
  });

  it('routes neutral through the fixed ink scale, not an arbitrary unrelated gray', () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
    expect(theme.light.neutral).toBe(formatOklch(hexToOklch(INK.dark)));
  });

  describe('surface ordering — elevation lightens in both modes, just at different ends of the scale', () => {
    it('light mode: base-100 (card) is lighter than base-200 (page)', () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      const base100 = hexToOklch(theme.light['base-100'] as unknown as string);
      const base200 = hexToOklch(theme.light['base-200'] as unknown as string);
      expect(base100.l).toBeGreaterThan(base200.l);
    });

    it('dark mode: base-100 (card) is STILL lighter than base-200 (page) — same relative ordering', () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      const base100 = hexToOklch(theme.dark['base-100'] as unknown as string);
      const base200 = hexToOklch(theme.dark['base-200'] as unknown as string);
      expect(base100.l).toBeGreaterThan(base200.l);
    });

    it("dark mode's surfaces are genuinely darker overall than light mode's", () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      const lightBase100 = hexToOklch(theme.light['base-100'] as unknown as string);
      const darkBase100 = hexToOklch(theme.dark['base-100'] as unknown as string);
      expect(darkBase100.l).toBeLessThan(lightBase100.l);
    });
  });

  it('includes the fixed radius and DaisyUI animation slots', () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
    expect(theme.light['--rounded-box']).toBe('0.6rem');
    expect(theme.light['--rounded-btn']).toBe('0.4rem');
    expect(theme.light['--rounded-badge']).toBe('1.9rem');
    expect(theme.light['--tab-radius']).toBe('0.4rem');
  });

  it("exposes the button lift shadow, reusing SHADOW.overlay rather than inventing a new value", () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
    expect(theme.light['--ds-btn-lift-shadow']).toBe(SHADOW.overlay);
  });

  it('exposes the shared press/release spring easing and a base motion duration, so every pressable component reads from one place', () => {
    const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
    expect(theme.light['--ds-ease-spring']).toBe(EASE_SPRING);
    expect(theme.light['--ds-motion-base']).toBe(DURATION.base);
  });

  describe('interactive state tokens — hover/active/disabled per role, derived via tone()', () => {
    const ROLES = ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'] as const;

    it.each(ROLES)('exposes --ds-%s-hover/-active/-disabled', (role) => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#C23B3B' });
      expect(theme.light[`--ds-${role}-hover`]).toBeDefined();
      expect(theme.light[`--ds-${role}-active`]).toBeDefined();
      expect(theme.light[`--ds-${role}-disabled`]).toBeDefined();
    });

    it("derives primary's hover/active/disabled from tone(primary, variant, mode) exactly, in both modes", () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      const primary = generatePrimary('#1E3A8A');
      expect(theme.light['--ds-primary-hover']).toBe(formatOklch(tone(primary, 'hover', 'light')));
      expect(theme.light['--ds-primary-active']).toBe(formatOklch(tone(primary, 'active', 'light')));
      expect(theme.light['--ds-primary-disabled']).toBe(formatOklch(tone(primary, 'disabled', 'light')));
      expect(theme.dark['--ds-primary-hover']).toBe(formatOklch(tone(primary, 'hover', 'dark')));
    });

    it("derives error's hover/active/disabled from tone(error, variant, mode) exactly — a fixed semantic role, not colla-dependent", () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      const error = hexToOklch(SEMANTIC.error);
      expect(theme.light['--ds-error-hover']).toBe(formatOklch(tone(error, 'hover', 'light')));
      expect(theme.light['--ds-error-active']).toBe(formatOklch(tone(error, 'active', 'light')));
      expect(theme.light['--ds-error-disabled']).toBe(formatOklch(tone(error, 'disabled', 'light')));
    });

    it("derives secondary's states from the muted secondary color, not primary", () => {
      const theme = generateCollaTheme('#1E3A8A', { kind: 'white' });
      const secondary = generateSecondary(generatePrimary('#1E3A8A'));
      expect(theme.light['--ds-secondary-hover']).toBe(formatOklch(tone(secondary, 'hover', 'light')));
    });
  });
});
