/**
 * Motion scale (§2.1g) — named durations plus one shared easing curve, replacing the ad hoc
 * per-file transition durations (0.08s–0.25s) found scattered across the app in the Phase 1
 * audit. `slow` deliberately lines up with tailwind.config.js's existing `arrival-bounce`
 * (400ms) rather than introducing a competing number for the same "big, deliberate movement"
 * bucket.
 */
export const DURATION = {
  fast: '120ms', // hover/micro-interactions
  base: '220ms', // panel expand/collapse
  slow: '380ms', // bigger deliberate movements
} as const;

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// The press/release spring — snappy down, overshoots slightly on the way back up. First used by
// Button's press interaction; named here (not left as a component-local literal) specifically so
// every component that presses/lifts shares one curve, and a future "springier" or "faster"
// pass is a single edit here rather than a hunt through each component's SCSS.
export const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
