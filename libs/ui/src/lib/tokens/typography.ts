/**
 * Font family stacks (Identity principles, §4.1) — TS-first source consumed by
 * `tailwind.config.ts`'s `fontFamily` extend, same architecture as every other token category
 * (Radius/Shadow/Motion/Z-index/Color live here and get imported, not the reverse). Previously
 * defined inline in `tailwind.config.ts` itself — the one token category that hadn't followed
 * this pattern yet.
 *
 * All three families are already self-hosted via `@fontsource/*` imports in both apps'
 * `styles.scss` (`sans` is the current global default there); `serif`/`legible` exist and are
 * ready to use via the `font-serif`/`font-legible` Tailwind utilities, but aren't applied to any
 * real UI yet — that's a Phase 7 rollout concern (deciding which real headings/labels adopt
 * them), not a token-definition one.
 */
export const FONT_FAMILY = {
  // Body text — every app's current global default (`html { font-family: 'Quicksand' }`).
  sans: ['Quicksand', 'system-ui', 'sans-serif'],
  // Display headings (Identity principle #1's "hand-made, not printed" character) — a serif
  // with more presence than a generic UI sans, used sparingly per the principle.
  serif: ['Fraunces', 'Georgia', 'serif'],
  // Canvas figure/node name labels specifically (Identity principle #1) — legibility at a
  // distance during a real rehearsal is the practical requirement, not decoration.
  legible: ['"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'],
  // Aliases, typed/search fields, and other short fixed-width identifiers — the same
  // legibility-first family as `legible`, in its monospace cut, replacing Tailwind's generic
  // system-monospace default everywhere `font-mono` is already used.
  mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', 'monospace'],
} as const;
