import { formatHex, hexToOklch, tone, OklchColor, ThemeMode } from './color';
import { PAPER, SEMANTIC } from './fixed-colors';

export interface CategoricalPalette {
  normal: OklchColor[];
  light: OklchColor[];
}

// Also drives the per-figure colors (libs/pinyes-render/src/lib/utils/figure-palette.util.ts).
// First 6 are the fixed palette's own accent hues (shared with the semantic error/success/
// warning/info roles), last 4 fill the genuinely open gaps left in the hue wheel once those 6
// are placed.
const CATEGORICAL_BASE_HEX: readonly string[] = [
  SEMANTIC.error, // red (scarlet)
  SEMANTIC.success, // green (jade)
  SEMANTIC.info, // blue
  '#DCAD21', // gold
  '#77579e', // purple — no semantic role, categorical-only
  '#DD8C46', // orange (apricot) — no semantic role, categorical-only; kept well clear of red
  '#2B98B0', // teal   — new, gap between green and blue; leans blue so it doesn't read as green
  '#BF609B', // pink   — new, gap between purple and red
  '#915c4b', // brown  — new, deliberately darker/more desaturated than red/orange rather than
  //           hue-separated from them, since brown reads as an earth tone, not a distinct hue
  '#768A42', // olive  — new, gap between gold and green
];

// Light-mode variants close the same share of each color's own gap to the paper, rather than
// taking a fixed lightness step: a fixed step pushes already-light hues (gold, orange) into the
// white end of sRGB, where they clip to almost paper and lose their color.
const LIGHT_PAPER_SHARE = 0.55;
const LIGHT_CHROMA_FACTOR = 0.6;
const PAPER_L = hexToOklch(PAPER.white).l;

function lightVariant(base: OklchColor, mode: ThemeMode): OklchColor {
  // Dark mode keeps tone()'s receding shadow tone — a paper-ward share would glow on a dark surface.
  if (mode === 'dark') return tone(base, 'muted', mode);
  return {
    l: base.l + LIGHT_PAPER_SHARE * (PAPER_L - base.l),
    c: base.c * LIGHT_CHROMA_FACTOR,
    h: base.h,
  };
}

export function buildCategoricalPalette(mode: ThemeMode): CategoricalPalette {
  const normal = CATEGORICAL_BASE_HEX.map(hexToOklch);
  const light = normal.map((base) => lightVariant(base, mode));
  return { normal, light };
}

// Flat hex list for plain swatch pickers (e.g. a domain color-picker's preset grid) that store a
// hex string, not an OklchColor — the 10 normal hues followed by their 10 light companions,
// light-mode values only (a preset list has no runtime mode to react to, unlike a rendered token).
export function buildCategoricalHexPresets(): string[] {
  const { normal, light } = buildCategoricalPalette('light');
  return [...normal, ...light].map(formatHex);
}
