import {
  hexToOklch,
  formatOklch,
  contrastContent,
  generatePrimary,
  generateSecondary,
  sashFromHue,
  sashFromFill,
  ThemeMode,
  OklchColor,
} from './color';
import { PAPER, INK, SEMANTIC, ACCENT } from './fixed-colors';
import { RADIUS } from './radius';
import { DURATION } from './motion';

export type SashSpec = { kind: 'hue'; hex: string } | { kind: 'white' } | { kind: 'black' };

export interface DaisyUiThemeValues {
  primary: string;
  'primary-content': string;
  secondary: string;
  'secondary-content': string;
  accent: string;
  'accent-content': string;
  neutral: string;
  'neutral-content': string;
  'base-100': string;
  'base-200': string;
  'base-300': string;
  'base-content': string;
  info: string;
  'info-content': string;
  success: string;
  'success-content': string;
  warning: string;
  'warning-content': string;
  error: string;
  'error-content': string;
  '--rounded-box': string;
  '--rounded-btn': string;
  '--rounded-badge': string;
  '--tab-radius': string;
  '--animation-btn': string;
  '--animation-input': string;
  // The sash motif — deliberately its own namespaced tokens, not mapped into any DaisyUI color
  // slot. DaisyUI auto-generates btn-*/badge-*/text-*/border-* utility classes from whatever
  // sits in primary/secondary/accent, and every DaisyUI app treats those three as "generic brand
  // colors, use anywhere" — that's exactly what caused the sash to get misused as a generic
  // secondary color in practice. Putting it here instead means there's no auto-generated
  // "btn-sash" class inviting the same mistake again.
  '--ds-sash-fill': string;
  '--ds-sash-content': string;
  '--ds-sash-edge': string;
  '--ds-sash-weave': string;
}

const INK_BLACK = hexToOklch(INK.black);
const INK_DARK = hexToOklch(INK.dark);
const INK_MID = hexToOklch(INK.mid);
const PAPER_WHITE = hexToOklch(PAPER.white);
const PAPER_CREAM = hexToOklch(PAPER.cream);
const PAPER_WASHI = hexToOklch(PAPER.washi);
const ACCENT_OKLCH = hexToOklch(ACCENT);

/** Content color for a background, always the fixed ink/paper pair — never pure black/white. */
function content(background: OklchColor): OklchColor {
  return contrastContent(background, INK_BLACK, PAPER_WHITE);
}

function resolveSash(sash: SashSpec, mode: ThemeMode) {
  switch (sash.kind) {
    case 'hue':
      return sashFromHue(sash.hex, mode, INK_BLACK, PAPER_WHITE);
    case 'white':
      return sashFromFill(PAPER_WHITE, mode, INK_BLACK, PAPER_WHITE);
    case 'black':
      return sashFromFill(INK_BLACK, mode, INK_BLACK, PAPER_WHITE);
  }
}

/**
 * Surfaces for one mode — elevation lightens in both (card lighter than page), just anchored at
 * opposite ends of the fixed paper/ink scale (§2.2's dark-mode elevation-ladder resolution).
 */
function surfaces(mode: ThemeMode): { base100: OklchColor; base200: OklchColor; base300: OklchColor } {
  return mode === 'light'
    ? { base100: PAPER_WHITE, base200: PAPER_CREAM, base300: PAPER_WASHI }
    : { base100: INK_DARK, base200: INK_BLACK, base300: INK_MID };
}

function buildTheme(shirtHex: string, sash: SashSpec, mode: ThemeMode): DaisyUiThemeValues {
  const primary = generatePrimary(shirtHex);
  const secondary = generateSecondary(primary);
  const sashTokens = resolveSash(sash, mode);
  const neutral = INK_DARK;
  const { base100, base200, base300 } = surfaces(mode);

  const error = hexToOklch(SEMANTIC.error);
  const success = hexToOklch(SEMANTIC.success);
  const warning = hexToOklch(SEMANTIC.warning);
  const info = hexToOklch(SEMANTIC.info);
  // SEMANTIC_LIGHT isn't part of the DaisyUI theme object — it's consumed via categorical.ts.

  return {
    primary: formatOklch(primary),
    'primary-content': formatOklch(content(primary)),
    secondary: formatOklch(secondary),
    'secondary-content': formatOklch(content(secondary)),
    accent: formatOklch(ACCENT_OKLCH),
    'accent-content': formatOklch(content(ACCENT_OKLCH)),
    neutral: formatOklch(neutral),
    'neutral-content': formatOklch(content(neutral)),
    'base-100': formatOklch(base100),
    'base-200': formatOklch(base200),
    'base-300': formatOklch(base300),
    'base-content': formatOklch(content(base100)),
    info: formatOklch(info),
    'info-content': formatOklch(content(info)),
    success: formatOklch(success),
    'success-content': formatOklch(content(success)),
    warning: formatOklch(warning),
    'warning-content': formatOklch(content(warning)),
    error: formatOklch(error),
    'error-content': formatOklch(content(error)),
    '--rounded-box': RADIUS.box,
    '--rounded-btn': RADIUS.btn,
    '--rounded-badge': RADIUS.badge,
    '--tab-radius': RADIUS.tab,
    '--animation-btn': DURATION.fast,
    '--animation-input': DURATION.fast,
    '--ds-sash-fill': formatOklch(sashTokens.fill),
    '--ds-sash-content': formatOklch(sashTokens.content),
    '--ds-sash-edge': formatOklch(sashTokens.edge),
    '--ds-sash-weave': formatOklch(sashTokens.weaveFill),
  };
}

export function generateCollaTheme(
  shirtHex: string,
  sash: SashSpec,
): { light: DaisyUiThemeValues; dark: DaisyUiThemeValues } {
  return {
    light: buildTheme(shirtHex, sash, 'light'),
    dark: buildTheme(shirtHex, sash, 'dark'),
  };
}
