import type { Config } from 'tailwindcss';
import { generateCollaTheme } from './libs/ui/src/lib/tokens/theme';
import { SHADOW } from './libs/ui/src/lib/tokens/shadow';
import { DURATION, EASE } from './libs/ui/src/lib/tokens/motion';
import { Z_INDEX } from './libs/ui/src/lib/tokens/z-index';
import { FONT_FAMILY } from './libs/ui/src/lib/tokens/typography';

// Placeholder colla identity — shirt color + sash spec are genuinely per-colla configuration
// that doesn't exist as real data yet (no admin-configurable colla settings built). Standing in
// with a representative real-hue sash until that exists — purple, deliberately distinct from
// the fixed error color (red) so the two are visually distinguishable in an actual render,
// even though sash and accent are independent regardless of which hues they happen to share.
const barcelona = generateCollaTheme('#00CCFF', { kind: 'hue', hex: '#6B4C91' });

export default {
  content: [
    './apps/dashboard/src/**/*.{html,ts}',
    './apps/pwa/src/**/*.{html,ts}',
    './libs/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        conflict: {
          DEFAULT: '#e11d48',
          content: '#ffffff',
        },
      },
      fontFamily: {
        sans: [...FONT_FAMILY.sans],
        serif: [...FONT_FAMILY.serif],
        legible: [...FONT_FAMILY.legible],
      },
      boxShadow: {
        raised: SHADOW.raised,
        overlay: SHADOW.overlay,
        modal: SHADOW.modal,
      },
      transitionDuration: {
        fast: DURATION.fast,
        DEFAULT: DURATION.base,
        slow: DURATION.slow,
      },
      transitionTimingFunction: {
        ds: EASE,
      },
      zIndex: {
        raised: String(Z_INDEX.raised),
        dropdown: String(Z_INDEX.dropdown),
        chrome: String(Z_INDEX.chrome),
        modal: String(Z_INDEX.modal),
        system: String(Z_INDEX.system),
      },
      keyframes: {
        'arrival-bounce': {
          '0%': { scale: '1' },
          '40%': { scale: '1.35' },
          '100%': { scale: '1' },
        },
        // A standalone `translate`, not `transform` — composes with the chevron's own inline
        // `transform: translate(...) rotate(angle)` instead of being clobbered by it, and moves
        // in the element's local space *before* that rotation, so it reads as oscillating along
        // the pointing direction rather than always sliding sideways on screen.
        restless: {
          '0%, 100%': { translate: '0 0' },
          '50%': { translate: '4px 0' },
        },
      },
      animation: {
        'arrival-bounce': `arrival-bounce ${DURATION.slow} ${EASE}`,
        restless: `restless 900ms ${EASE} infinite`,
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      { 'colla-barcelona-light': barcelona.light },
      { 'colla-barcelona-dark': barcelona.dark },
    ],
    darkTheme: 'colla-barcelona-dark',
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
} satisfies Config;
