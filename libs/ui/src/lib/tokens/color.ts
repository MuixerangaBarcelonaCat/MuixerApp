import { clampChroma, converter, formatHex as culoriFormatHex } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';

const toOklch = converter('oklch');
const toRgb = converter('rgb');

export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export function hexToOklch(hex: string): OklchColor {
  const result = toOklch(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return { l: result.l, c: result.c, h: result.h ?? 0 };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatOklch(color: OklchColor, alpha = 1): string {
  const lPercent = round(color.l * 100, 1);
  const c = round(color.c, 4);
  const h = round(color.h, 2);
  return alpha < 1
    ? `oklch(${lPercent}% ${c} ${h} / ${round(alpha, 2)})`
    : `oklch(${lPercent}% ${c} ${h})`;
}

// For consumers that need a plain hex swatch (e.g. a preset-color picker's stored value) rather
// than a CSS oklch() string — gamut-mapped the same way contrastContent's own RGB conversion is,
// since an out-of-gamut oklch value would otherwise format to a clipped/wrong hex.
export function formatHex(color: OklchColor): string {
  const clamped = clampChroma({ mode: 'oklch', l: color.l, c: color.c, h: color.h }, 'oklch');
  return culoriFormatHex(clamped);
}

export type ThemeMode = 'light' | 'dark';

/**
 * hover/active/focus: interactive feedback — moves AWAY from the surface for contrast
 * (darker on a pale light-mode surface, lighter on a dark-mode one).
 * disabled/muted: the opposite — moves TOWARD the surface, reducing contrast/receding
 * (lighter in light mode, darker in dark mode), plus a chroma cut for the washed-out look.
 * weave: a fixed decorative micro-shift for the sash's two-tone texture — not surface-relative,
 * so it doesn't flip with mode.
 */
export type ToneVariant = 'hover' | 'active' | 'focus' | 'disabled' | 'muted' | 'weave';

interface ToneShift {
  dl: number;
  cFactor: number;
  recedes: boolean;
  // Only for recede variants where staying visible matters (e.g. disabled is rendered as an
  // outline/text against the surface, not just a background wash): the minimum distance the
  // result must keep from the mode's extreme (1 in light, 0 in dark), overriding a flat +dl when
  // the base already sits close enough to the surface that the plain shift would nearly vanish
  // into it (e.g. secondary's L=0.75 base + dl=0.2 lands at 0.95, a hair from paper-white's
  // 0.985).
  recedeExtremeGap?: number;
}

const TONE_SHIFTS: Record<ToneVariant, ToneShift> = {
  hover: { dl: 0.08, cFactor: 1, recedes: false },
  active: { dl: 0.14, cFactor: 1, recedes: false },
  focus: { dl: 0.05, cFactor: 1, recedes: false },
  disabled: { dl: 0.2, cFactor: 0.35, recedes: true, recedeExtremeGap: 0.12 },
  // dl/cFactor grounded empirically: the fixed palette's own base→light accent pairs average
  // deltaL ≈ 0.22 with chroma roughly halved (see fixed-colors.ts's SEMANTIC/SEMANTIC_LIGHT pairs).
  muted: { dl: 0.22, cFactor: 0.7, recedes: true },
  weave: { dl: 0.05, cFactor: 1, recedes: false },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function tone(base: OklchColor, variant: ToneVariant, mode: ThemeMode): OklchColor {
  const shift = TONE_SHIFTS[variant];

  let direction: number;
  if (variant === 'weave') {
    direction = -1;
  } else {
    // Emphasis moves away from the surface; recede moves toward it — opposite mode mapping.
    const emphasisDirection = mode === 'light' ? -1 : 1;
    direction = shift.recedes ? -emphasisDirection : emphasisDirection;
  }

  let l = clamp(base.l + direction * shift.dl, 0, 1);
  if (shift.recedeExtremeGap !== undefined) {
    l = mode === 'light' ? Math.min(l, 1 - shift.recedeExtremeGap) : Math.max(l, shift.recedeExtremeGap);
  }

  return {
    l,
    c: Math.max(0, base.c * shift.cFactor),
    h: base.h,
  };
}

/**
 * APCA contrast pick between two caller-supplied content colors — never a hardcoded pure
 * black/white. This project's dark/light content are the warm ink-black/paper-white tokens
 * (fixed-colors.ts), not literal #000/#fff — hardcoding those would break every other piece of
 * text in the app being drawn from that same warm scale.
 *
 * Uses APCA, not the WCAG 2.x relative-luminance formula this originally ported (from
 * tailwind.config.js's old getContrastContent). WCAG 2.x under-rates how dark saturated colors
 * actually read — it weights the blue channel at only 0.0722 of the luminance sum, so a vivid
 * blue can compute as "light enough for dark text" while visually needing light text. Concretely:
 * the fixed primary target at a blue hue scores a WCAG luminance of 0.188 (just over the old
 * 0.179 cutoff, picking dark text) while APCA scores white text at ~76 vs. black text's ~34
 * against that same color — APCA wants >=60 for body text, so black would have read as too low
 * contrast in practice. Picks whichever candidate has the larger APCA contrast magnitude.
 */
export function contrastContent(
  background: OklchColor,
  darkContent: OklchColor,
  lightContent: OklchColor,
): OklchColor {
  // Fixed L/C targets (e.g. the sash's SASH_L=0.52/SASH_C=0.2) can land outside the sRGB gamut
  // for some hues — culori's rgb converter then returns raw, uncorrected negative/>1 channel
  // values for them. Left uncorrected, that silently collapses both candidates' APCA contrast to
  // ~0 (a tie, wrongly resolved to darkContent by the >= tie-break below) regardless of how dark
  // the color actually reads. Gamut-map to the nearest in-range color first — the same chroma-
  // reduction approach browsers use when painting an out-of-gamut oklch() value — so the contrast
  // decision matches what's actually rendered.
  const toSrgb255 = (color: OklchColor): [number, number, number] => {
    const clamped = clampChroma({ mode: 'oklch', l: color.l, c: color.c, h: color.h }, 'oklch');
    const rgb = toRgb(clamped);
    return [rgb.r * 255, rgb.g * 255, rgb.b * 255];
  };
  const backgroundY = sRGBtoY(toSrgb255(background));
  const darkContrast = Math.abs(Number(APCAcontrast(sRGBtoY(toSrgb255(darkContent)), backgroundY)));
  const lightContrast = Math.abs(Number(APCAcontrast(sRGBtoY(toSrgb255(lightContent)), backgroundY)));
  return darkContrast >= lightContrast ? darkContent : lightContent;
}

// Fixed L/C targets per color role (§2.1a) — deliberately distinct per role so a colla's
// computed colors never chromatically coincide with each other or with the fixed error token,
// even when hues happen to be close. Exact values are implementation-time tuning, revisit once
// rendered against real screens (per the plan).
const PRIMARY_L = 0.62;
const PRIMARY_C = 0.18;
// Secondary is a muted sibling of primary — same hue, both lighter AND lower chroma — safe for
// generic "second button" use anywhere in the app. It is deliberately NOT sash-derived: DaisyUI
// auto-generates btn-secondary/badge-secondary/etc. from whatever sits in this slot, and every
// other DaisyUI app treats "secondary" as a generic second brand color. The sash motif isn't
// mapped into any DaisyUI color slot at all (see SashTokens below) — DaisyUI's own `accent` is a
// separate, fixed color (fixed-colors.ts), untouched by any of this.
// L is deliberately +0.12 over primary's, not just a lower-chroma twin at the same lightness —
// a same-lightness, chroma-only difference read as too subtle in practice. Two independent
// perceptual dimensions (lighter AND less saturated) separate them far more clearly than one.
const SECONDARY_L = 0.75;
const SECONDARY_C = 0.08;
// The sash motif's own fixed L/C target, distinct from primary and secondary.
const SASH_L = 0.52;
const SASH_C = 0.2;

/**
 * A colla's primary color, re-normalized from their shirt color: fixed lightness/chroma,
 * hue taken from the input. This is the whole point of the formula — a raw shirt color may be
 * too saturated or too dark/light to use directly as a UI fill, so only its hue identity carries
 * through.
 */
export function generatePrimary(shirtHex: string): OklchColor {
  const { h } = hexToOklch(shirtHex);
  return { l: PRIMARY_L, c: PRIMARY_C, h };
}

/** A muted sibling of primary — same hue, fixed lower-chroma target. Safe for generic UI use. */
export function generateSecondary(primary: OklchColor): OklchColor {
  return { l: SECONDARY_L, c: SECONDARY_C, h: primary.h };
}

export interface SashTokens {
  fill: OklchColor;
  content: OklchColor;
  edge: OklchColor;
  weaveFill: OklchColor;
}

/**
 * Builds the full sash motif token set from a known fill color — the shared endpoint for both
 * sash branches (§2.1a): a real-hue sash derives its fill via sashFromHue below, a white/black
 * sash passes a hand-picked preset fill straight in here. Content and edge both come from the
 * same contrastContent pick against the caller's own dark/light content colors (different usage
 * — fill vs. hairline stroke — but the same underlying color, never a hardcoded black/white),
 * and weaveFill is the sash's two-tone texture companion. Deliberately not mapped into any
 * DaisyUI color slot — see theme.ts for why.
 */
export function sashFromFill(
  fill: OklchColor,
  mode: ThemeMode,
  darkContent: OklchColor,
  lightContent: OklchColor,
): SashTokens {
  const content = contrastContent(fill, darkContent, lightContent);
  return {
    fill,
    content,
    edge: content,
    weaveFill: tone(fill, 'weave', mode),
  };
}

/** A real-hue sash (red/purple/yellow/orange/...): fixed sash L/C, hue from the sash color. */
export function sashFromHue(
  sashHex: string,
  mode: ThemeMode,
  darkContent: OklchColor,
  lightContent: OklchColor,
): SashTokens {
  const { h } = hexToOklch(sashHex);
  return sashFromFill({ l: SASH_L, c: SASH_C, h }, mode, darkContent, lightContent);
}
