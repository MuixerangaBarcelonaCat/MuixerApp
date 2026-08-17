# ui

Shared design-system library for `@muixer/ui`, consumed by `apps/dashboard` and `apps/pwa` (mirrors how `libs/pinyes-render` is already shared between them).

## Contents

- `src/lib/tokens/` — the design token layer: color (OKLCH-based, APCA contrast picking), categorical palette, fixed brand colors, radius, motion, z-index, shadow, and the DaisyUI theme builder (`generateCollaTheme`). Consumed at build time by `tailwind.config.ts` and, via `@muixer/ui`, by anything that needs token values at runtime (e.g. the Konva canvas in `libs/pinyes-render`).
- Shared UI primitives (button, badge, input, modal, toast, card shell, …) land here next, per the design system plan's Phase 3 migration order.

Full rationale and decisions: [docs/superpowers/specs/2026-08-16-design-system-plan-design.md](../../docs/superpowers/specs/2026-08-16-design-system-plan-design.md).

## Running unit tests

Run `nx test ui` to execute the unit tests.
