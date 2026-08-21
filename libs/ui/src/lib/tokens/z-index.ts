/**
 * Z-index scale (§2.1h) — named by role, replacing three separate mechanisms found doing the
 * same job uncoordinated in the Phase 1 audit (Tailwind's standard z-* classes, arbitrary
 * z-[N] values, and raw CSS z-index). `system` in particular replaces three independent
 * `z-[9999]` copies (dashboard's toast, the PWA's splash screen and toast container) with one
 * shared definition.
 */
export const Z_INDEX = {
  raised: 10, // sticky headers, in-canvas chrome
  dropdown: 20, // popovers, tooltips, in-canvas panels
  chrome: 40, // persistent app header/tab-nav
  modal: 50, // dialogs
  system: 9999, // above literally everything else — toasts, splash screen
} as const;
