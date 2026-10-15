/**
 * Fixed color values shared by every colla — not derived, not colla-dependent. Pure data: no
 * logic here, see color.ts/categorical.ts for the functions that consume these.
 */

export const PAPER = {
  white: '#FAFAF8',
  cream: '#F5F2EC',
  ivory: '#F8F6F0',
  washi: '#F0EBE1',
  washiDark: '#E5DFD3',
} as const;

export const INK = {
  black: '#1C1B18',
  dark: '#2E2D28',
  mid: '#5A5750',
  light: '#8A8680',
  faint: '#B8B4AE',
} as const;

export const CREASE = {
  light: '#D8D3C8',
  mid: '#B8B0A0',
  dark: '#8A8070',
} as const;

// error/success are tuned for colorblind users, not just picked as "red" and "green": red-green
// dichromats see mostly a blue↔yellow axis, so error leans scarlet (seen as amber) and success
// leans jade (seen as slate). Scarlet is as red as error can go before protanopes lose it, which
// keeps it apart from the categorical amber for everyone else. Both keep WCAG AA text contrast on
// paper — see fixed-colors.spec.ts.
export const SEMANTIC = {
  error: '#C74007',
  success: '#277C64',
  warning: '#C9A84C',
  info: '#3B6FC2',
} as const;

export const SEMANTIC_LIGHT = {
  error: '#EAA48E',
  success: '#92B7AA',
  warning: '#E8D9A0',
  info: '#A0BDE8',
} as const;

// DaisyUI's accent slot — fixed, not colla-dependent, so it stays coherent no matter what
// happens to touch it. Reuses the same orange already in the categorical palette rather than
// introducing a new value.
export const ACCENT = '#DD8C46';
