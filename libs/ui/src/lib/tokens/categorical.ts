import { formatHex, hexToOklch, tone, OklchColor, ThemeMode } from './color';
import { SEMANTIC, SEMANTIC_LIGHT } from './fixed-colors';

export interface CategoricalPalette {
  normal: OklchColor[];
  light: OklchColor[];
}

// Order matches the current libs/pinyes-render/src/lib/utils/figure-palette.util.ts (§2.1i) —
// first 6 are the fixed palette's own accent hues (shared with the semantic error/success/
// warning/info roles), last 4 fill the genuinely open gaps left in the hue wheel once those 6
// are placed.
const CATEGORICAL_BASE_HEX: readonly string[] = [
  SEMANTIC.error, // red
  SEMANTIC.success, // green
  SEMANTIC.info, // blue
  '#cfa72b', // gold (yellow)
  '#77579e', // purple — no semantic role, categorical-only
  '#D4793B', // orange — no semantic role, categorical-only
  '#248995', // teal   — new, gap between green and blue
  '#BF609B', // pink   — new, gap between purple and red
  '#915c4b', // brown  — new, deliberately darker/more desaturated than red/orange rather than
  //           hue-separated from them, since brown reads as an earth tone, not a distinct hue
  '#768A42', // olive  — new, gap between gold and green
];

// Hand-tuned light variants for the first 6 hues — valid for light mode only. There's no
// dark-mode equivalent authored for these, so dark mode always computes via tone() instead (see
// below); reusing these pale values unmodified in dark mode would read as a glow, not a
// receding shadow tone.
const FIXED_LIGHT_HEX: readonly (string | undefined)[] = [
  '#f39891',
  undefined,
  undefined,
  '#fcd97b',
  undefined,
  '#facfb6',
  undefined,
  '#f0b7d8',
  undefined,
  undefined,
];

export function buildCategoricalPalette(mode: ThemeMode): CategoricalPalette {
  const normal = CATEGORICAL_BASE_HEX.map(hexToOklch);
  const light = normal.map((base, i) => {
    const literalLight = mode === 'light' ? FIXED_LIGHT_HEX[i] : undefined;
    return literalLight ? hexToOklch(literalLight) : tone(base, 'muted', mode);
  });
  return { normal, light };
}

// Flat hex list for plain swatch pickers (e.g. a domain color-picker's preset grid) that store a
// hex string, not an OklchColor — the 10 normal hues followed by their 10 light companions,
// light-mode values only (a preset list has no runtime mode to react to, unlike a rendered token).
export function buildCategoricalHexPresets(): string[] {
  const { normal, light } = buildCategoricalPalette('light');
  return [...normal, ...light].map(formatHex);
}
