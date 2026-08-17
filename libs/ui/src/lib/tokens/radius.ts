/**
 * Radius scale (§2.1e) — soft/rounded direction, reusing DaisyUI's own 4 theme slots rather
 * than inventing a parallel scale. Deliberately different from DaisyUI's stock defaults
 * (--rounded-box 1rem / --rounded-btn 0.5rem / --rounded-badge 1.9rem / --tab-radius 0.5rem) —
 * matching the shape direction but keeping the stock numbers would still read as "an unmodified
 * DaisyUI app," which is the whole problem this project exists to fix.
 */
export const RADIUS = {
  box: '0.6rem', // cards, modals, larger panels
  btn: '0.4rem', // buttons, inputs, selects
  badge: '1.9rem', // badges — kept at DaisyUI's own value: past a certain radius a pill is a
  //                  pill regardless of the exact number, so there's nothing to differentiate
  tab: '0.4rem', // tabs — matches btn, both are small interactive controls
} as const;
