import { hexToOklch, formatOklch } from './color';
import { INK } from './fixed-colors';

/**
 * Shadow / elevation scale (§2.1f) — named by role, not size adjective. Tinted with the fixed
 * ink-black token rather than a neutral gray, for the warm shadow character; multi-layered per
 * step for a more convincing sense of depth than one flat shadow gives. `flat` has no shadow at
 * all — it relies on the base-100/base-200 surface contrast already documented for the app.
 *
 * Dark-mode caveat (also noted in §2.1f, not solved here): a dark shadow reads weakly against an
 * already-dark background. These values are the light-mode definitions; dark mode additionally
 * needs each elevation step's *surface* to lighten (handled in the theme generator, §2.2), not
 * just this shadow.
 */
const INK_BLACK = hexToOklch(INK.black);

function shadowTint(alpha: number): string {
  return formatOklch(INK_BLACK, alpha);
}

export const SHADOW = {
  flat: 'none',
  raised: `0 1px 2px ${shadowTint(0.06)}, 0 1px 1px ${shadowTint(0.04)}`,
  overlay: `0 4px 8px ${shadowTint(0.1)}, 0 2px 4px ${shadowTint(0.06)}`,
  modal: `0 12px 24px ${shadowTint(0.16)}, 0 4px 8px ${shadowTint(0.1)}`,
} as const;
