---
tags: [domini]
---

# Design System

Canonical source of truth for MuixerApp's visual identity: design tokens and the shared `libs/ui` component library consumed by both `apps/dashboard` and `apps/pwa`. Supersedes [[DASHBOARD_UI]]'s former "Paleta de Colors," "Tipografia," and "Theming per Colla" sections — that doc now covers dashboard-specific layout/routing only.

Full design history, rationale for every decision, and open work — [docs/superpowers/specs/2026-08-16-design-system-plan-design.md](superpowers/specs/2026-08-16-design-system-plan-design.md). This doc is the durable reference; that one is the working log.

## Principles

Three principles ground every personality decision in the component library, set once there was a real component (Button) to test them against rather than invented in the abstract:

1. **Paper quality.** The identity should feel like a *mestre* (leader) sketching pinyes (figures) in a notebook before rehearsal — hand-made, drawn, not printed — without tipping into pastiche (no script fonts, no illustrated corners everywhere). It lands sparingly, on elements that can carry it without hurting legibility, and never at the cost of the APCA contrast work in the color tokens. Example: Button's disabled state renders as a dashed, unfilled "sketched, not inked yet" outline rather than a flat gray fill.
2. **Not too serious.** Small gimmicks are welcome as long as they never block or slow down a real task — personality through motion and small detail, not friction. Example: Button and Card's press interaction is a snappy scale-down with a spring-back release easing (`EASE_SPRING`), not a plain opacity fade.
3. **Distinctly Valencian and about muixerangues, not generic.** The identity should read as specifically about muixerangues (traditional Valencian human towers), not a reskinned generic SaaS app. Example: Card's sash (*faixa*) — a textured diagonal-weave band with a procedurally-generated fringe (*flecos*) — is the first concrete motif; more are expected as later components are designed, not invented all at once.

Not every component needs to carry all three at once. Button is deliberately restrained — a small interactive control isn't the right canvas for grain or motif — while Card's sash is a genuine design statement.

## Tokens

Every token lives in `libs/ui/src/lib/tokens/` as plain TypeScript — no CSS-first definitions. `tailwind.config.ts` imports from these files and extends Tailwind's theme; component `.scss` files consume the resulting `--ds-*` CSS custom properties or static Tailwind utility classes. This is deliberate and one-directional: **tokens are TS-first, Tailwind and components consume them — never the reverse.**

### Color

OKLCH throughout, not hex/RGB — perceptually uniform lightness makes tone-shifting (hover/active/disabled) mathematically consistent regardless of hue.

**Per-colla generation.** `generateCollaTheme(shirtHex, sashSpec)` in `theme.ts` derives an entire theme — every DaisyUI semantic color plus every `--ds-*` custom property, for both light and dark mode — from two inputs: a shirt color and a sash spec (`{ kind: 'hue', hex }` for a colored sash, or `{ kind: 'white' }` / `{ kind: 'black' }` for achromatic ones). Fixed values (ink/paper, semantic error/success/warning/info, the accent slot) never change per colla; primary/secondary/sash are the only colla-derived roles.

| Role | Source | Notes |
|------|--------|-------|
| `primary` | Derived from `shirtHex` | Fixed L=0.62 / C=0.18 target, hue from the shirt color |
| `secondary` | Derived from `shirtHex` | Same hue as primary, lighter and lower-chroma — a muted sibling, never sash-derived |
| `accent` | Fixed | `#D4793B` (orange) — not colla-dependent, reused from the categorical palette |
| `error` / `success` / `warning` / `info` | Fixed | `#C23B3B` / `#3B8C5A` / `#C9A84C` / `#3B6FC2` — same across every colla |
| Sash (`--ds-sash-fill`/`-content`/`-edge`/`-weave`) | Derived from `sashSpec` | Independent of `primary` — never assume a colla's sash matches its shirt color |

**`tone(base, variant, mode)`** computes a role's interactive states from its base color:

| Variant | Direction | `dl` (lightness shift) | `cFactor` (chroma) |
|---------|-----------|------------------------|---------------------|
| `hover` | Away from surface (more contrast) | 0.08 | 1 |
| `active` | Away from surface | 0.14 | 1 |
| `focus` | Away from surface | 0.05 | 1 |
| `disabled` | Toward surface (recedes) | 0.20 | 0.35 |
| `muted` | Toward surface | 0.22 | 0.5 |
| `weave` | Fixed micro-shift (sash texture only) | 0.05 | 1 |

`disabled` additionally clamps to a `recedeExtremeGap` of 0.12 — without it, an already-light base (e.g. `secondary`) shifted further toward a light-mode surface becomes nearly invisible. The clamp guarantees at least a 12% lightness gap from the surface extreme in both directions.

Every `InteractiveRole` (`primary`/`secondary`/`accent`/`neutral`/`info`/`success`/`warning`/`error`) gets its hover/active/disabled precomputed into theme-level `--ds-{role}-hover`/`-active`/`-disabled` custom properties — DaisyUI's own `:hover`/`:disabled` states always mix toward flat black/gray regardless of role, so components that want `tone()`'s mode-aware, per-role feedback need these precomputed rather than relying on DaisyUI's default.

**`contrastContent(background, darkContent, lightContent)`** picks readable content color via real APCA contrast (not naive relative luminance) — used everywhere a solid fill needs readable text/icon color on top of an arbitrary custom color (Badge's `color` override, Card's `sashColor` override).

### Typography

```ts
// libs/ui/src/lib/tokens/typography.ts
FONT_FAMILY.sans    // Quicksand — global body default (both apps' current `html { font-family }`)
FONT_FAMILY.serif   // Fraunces — display headings (principle #1's "hand-made" character)
FONT_FAMILY.legible // Atkinson Hyperlegible Next — canvas figure/node name labels specifically
```

All three are self-hosted via `@fontsource/*` imports in both apps' `styles.scss` and exposed as Tailwind utilities (`font-sans`/`font-serif`/`font-legible`). **`serif` first applied in Phase 7** — the dashboard `/home` greeting (`<h1>`) is the first real usage, setting the precedent for other page-level `<h1>` headings as their turn comes in the rollout, not yet applied retroactively to already-shipped pages. **`legible` is not yet applied anywhere** — its intended use (canvas labels) waits on the Tier 5 canvas token bridge.

### Radius

Reuses DaisyUI's own four named theme slots rather than inventing a parallel scale (`--rounded-box`/`--rounded-btn`/`--rounded-badge`/`--tab-radius`).

| Token | Value | Used by |
|-------|-------|---------|
| `RADIUS.box` | `0.6rem` | Cards, modals, larger panels |
| `RADIUS.btn` | `0.4rem` | Buttons, inputs, selects |
| `RADIUS.badge` | `1.9rem` | Badges — kept at DaisyUI's stock value; past a point a pill is a pill |
| `RADIUS.tab` | `0.4rem` | Tabs — matches `btn`, both small interactive controls |

Both `box` and `btn` were deliberately reduced from DaisyUI's stock defaults (`1rem`/`0.5rem`) — the unmodified values read as "generic DaisyUI app."

### Shadow

Named by role, not size adjective. Tinted with ink-black (not neutral gray) for a warm shadow character, multi-layered per step for a more convincing sense of depth.

| Token | Value |
|-------|-------|
| `SHADOW.flat` | `none` — relies on `base-100`/`base-200` surface contrast alone |
| `SHADOW.raised` | `0 1px 2px` + `0 1px 1px`, ink-tinted |
| `SHADOW.overlay` | `0 4px 8px` + `0 2px 4px`, ink-tinted — hover lift (`--ds-btn-lift-shadow`) |
| `SHADOW.modal` | `0 12px 24px` + `0 4px 8px`, ink-tinted |

### Motion

| Token | Value | Used for |
|-------|-------|----------|
| `DURATION.fast` | `120ms` | Hover/micro-interactions |
| `DURATION.base` | `220ms` | Panel expand/collapse, press/lift transforms |
| `DURATION.slow` | `380ms` | Bigger deliberate movements (lines up with `arrival-bounce`'s 400ms) |
| `EASE` | `cubic-bezier(0.22, 1, 0.36, 1)` | General-purpose easing |
| `EASE_SPRING` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Press/release — snappy down, slight overshoot back up |

**Convention: shared *timing* is a token, per-component *press-scale magnitude* is a component-local constant.** Every component that presses/lifts uses `--ds-ease-spring`/`--ds-motion-base` so a future "springier" or "faster" pass is one edit — but how *far* a given surface scales down is its own call proportionate to its size (Button presses to `0.93`, Card — a much larger surface — to `0.98`).

### Z-index

Named by role, replacing three independent `z-[9999]` literals found scattered across both apps in the Phase 1 audit.

| Token | Value | Tailwind utility |
|-------|-------|-------------------|
| `Z_INDEX.raised` | `10` | `z-raised` — sticky headers, in-canvas chrome |
| `Z_INDEX.dropdown` | `20` | `z-dropdown` — popovers, tooltips, in-canvas panels |
| `Z_INDEX.chrome` | `40` | `z-chrome` — persistent app header/tab-nav |
| `Z_INDEX.modal` | `50` | `z-modal` — dialogs *(not used by `lib-modal` — see below)* |
| `Z_INDEX.system` | `9999` | `z-system` — above everything else (toasts, splash screen) |

`lib-modal` needs none of these: it uses the native `<dialog>` element's `showModal()`, which places it in the browser's top layer — a stacking context above the entire regular document regardless of any z-index value, so no token applies. `lib-toast-container` applies `z-system` as a static Tailwind class.

### Categorical colors

`CategoricalPalette` in `categorical.ts` — 10 hues for domain data that needs many distinguishable colors at once (tags, figure-node presets), not a small closed set of semantic roles. The first 6 reuse the fixed accent/semantic hues (error/success/info/warning red/green/blue/gold, plus purple and orange); the last 4 (teal, pink, brown, olive) fill genuine gaps in the hue wheel. Light-mode variants are hand-tuned per hue for the first 6; dark mode always computes via `tone()` rather than reusing pale light-mode values unmodified (which would read as a glow, not a receding shadow).

**Defined now; not yet consumed anywhere.** Its intended consumer is the Konva canvas (`libs/pinyes-render`) — Tier 5 of the component-library plan, not yet built.

## Component library

Seven components shipped so far, all in `libs/ui/src/lib/components/`, none rolled out to real app code yet (that's Phase 7). Every input/output below reflects the actual shipped API — check the component's own `.ts` file before relying on this table for anything version-sensitive.

### `lib-button`

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `variant` | 9 DaisyUI roles | `'primary'`(ish, see source) | No `outline` variant — it's a separate boolean modifier |
| `size` | `xs\|sm\|md\|lg` | `md` | |
| `shape` | `default\|square\|circle` | `default` | Dev-mode warning if non-default with no `ariaLabel` |
| `outline` | `boolean` | `false` | Combines with `variant`, matching DaisyUI's own `btn-warning btn-outline` pattern |
| `disabled`, `loading`, `type`, `ariaLabel` | — | — | `loading` auto-disables and shows a sized spinner |
| `routerLink`, `href` | `string \| unknown[]`, `string` | — | Link mode, mirroring `lib-card`: `routerLink` wins over `href`, renders an `<a>` instead of `<button>`. **Throws** if combined with `disabled`/`loading` — a disabled or loading link isn't a supported shape |

Output: `clicked`. Content-projected. Hover lifts (`translateY` + `--ds-btn-lift-shadow`, no color change); press flattens with `EASE_SPRING` and shifts to `--ds-{role}-active`; disabled renders as a dashed, unfilled outline in `--ds-{role}-disabled`.

```html
<lib-button variant="primary" (clicked)="save()">Desa</lib-button>
<lib-button variant="error" outline [loading]="saving()">Elimina</lib-button>
<lib-button variant="warning" outline routerLink="/sync">Sincronitza tot</lib-button>
```

### `lib-badge`

| Input | Type | Default |
|-------|------|---------|
| `variant` | 9 DaisyUI roles | `'neutral'` |
| `size` | `xs\|sm\|md\|lg` | `md` |
| `outline` | `boolean` | `false` |
| `color` | `string` (hex) | — overrides `variant`; content color via `contrastContent` |

Static, non-interactive `<span>`, content-projected. No `conflict` variant — use `variant="error"`.

```html
<lib-badge variant="success">Confirmat</lib-badge>
<lib-badge [color]="tag.color">{{ tag.name }}</lib-badge>
```

### `lib-card`

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `sash` | `'none'\|'thin'\|'title'` | `'none'` | `thin` = 16px divider band; `title` = 38px band carrying title+icon |
| `tone` | `'default'\|primary\|secondary\|accent\|neutral\|info\|success\|warning\|error` | `'default'` | Muted role-tinted background/border (`bg-{role}/10 border-{role}/30`) for alert/notice-style cards — reuses DaisyUI's already-tokenized semantic colors, not a new raw color. Independent of `sash`; `default` keeps the plain `bg-base-100` surface every other card uses |
| `title`, `icon` | `string`, `LucideIconData` | — | Renders on the sash (`title` mode) or in the body (other modes) |
| `sashColor`, `iconColor` | `string` (hex) | — | Overrides only — default always reads `--ds-sash-fill`/`-content`, never hardcode a per-instance color. For *domain-assigned* colors (a tag/figure's own color) — `tone`'s small fixed role enum is the right tool for a generic alert/notice card instead |
| `routerLink`, `href`, `clickable` | — | — | Picks the host element (`<a>`/`<a>`/`<button>`/plain `<div>`); at most one is meaningful |

Output: `clicked` (only with `clickable`). The sash is a woven two-tone diagonal texture with a procedurally-generated fringe (`sash-fringe.util.ts`) emerging from a clean right-hand cut; the left edge overhangs the card's own border to read as continuing behind it.

```html
<lib-card sash="title" title="Usuaris" [icon]="Users" routerLink="/config/users" />
<lib-card sash="thin"><p>Plain content, thin divider only.</p></lib-card>
<lib-card tone="warning"><p>Alert/notice-style content, no sash.</p></lib-card>
```

### `lib-input`

`ControlValueAccessor` — the first use of this pattern in the codebase (every existing form previously bound `formControlName`/`ngModel` straight to a raw native control). Works with both reactive and template-driven forms.

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `label`, `hint`, `errorText` | `string` | — | `errorText` replaces `hint` in the same slot when both are set; drives `input-error` + `aria-invalid` |
| `icon` | `LucideIconData` | — | Optional prefix icon inside the box |
| `size` | `xs\|sm\|md\|lg` | **`sm`** | Deviates from DaisyUI's own `md` default — real usage is 53× `sm`/4× `xs`/0× `md`/`lg` |
| `type`, `placeholder`, `disabled`, `required`, `autocomplete`, `id` | — | — | `id` auto-generates a stable per-instance value if omitted, wiring `label[for]` + `aria-describedby` automatically |

```html
<lib-input formControlName="email" label="Correu electrònic" [icon]="Mail" type="email" required />
```

Only text-like inputs so far — `textarea`/`select` are deliberately deferred (different shape, not yet audited).

### `lib-modal`

Native `<dialog>` semantics (`showModal()`/`close()`) — not the app's previous CSS-only `.modal-open` convention, which had no real focus trap.

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `open` | `boolean` | `false` | Drives `showModal()`/`close()` via an internal `effect()` |
| `title` | `string` | — | Also wires `aria-labelledby` |
| `size` | `xs\|sm\|md\|lg\|2xl` | `md` | → `max-w-*` on `.modal-box` |
| `dismissible` | `boolean` | `true` | Gates backdrop-click and Escape (blocks the native `cancel` event's default when `false`) |
| `showCloseButton` | `boolean` | inherits `dismissible` | **Throws** if explicitly `true` while `dismissible` is `false` — a close button with no working dismissal path is a real contradiction |

Output: `closed` — fires from exactly one place (the native `close` event), regardless of how the dialog closed. Body is content-projected directly; footer actions project via `<div modalFooter>`. `.modal-box` is bounded to `max-h-[85vh]` with the body scrolling internally.

```html
<lib-modal [open]="isOpen()" title="Etiqueta nova" (closed)="isOpen.set(false)">
  <form>...</form>
  <div modalFooter>
    <lib-button variant="ghost" (clicked)="isOpen.set(false)">Cancel·la</lib-button>
    <lib-button variant="primary" type="submit">Crea</lib-button>
  </div>
</lib-modal>
```

### `lib-toast-container` + `ToastService`

Merges what were two independently-drifted implementations (dashboard vs. PWA) rather than picking one side — see the plan doc's Tier 1 §6 entry for the full diff.

```ts
inject(ToastService).success('Desat correctament.');
inject(ToastService).error('No s\'ha pogut desar.');
inject(ToastService).warning('...'); // kept even though real usage is rare — a real call site exists
inject(ToastService).info('...');
```

`dismiss(id)` removes one; every toast auto-dismisses after a flat 4000ms regardless of type. Icons are per-type (`CheckCircle`/`AlertCircle`/`AlertTriangle`/`Info`) — information isn't conveyed by color alone. `<lib-toast-container />` is mounted once per app shell; it's responsive by viewport width (full-width top banner with safe-area support below `sm`, DaisyUI's corner-stacking `toast-top toast-end` at `sm` and up) rather than taking a `position` input — one component, no per-app configuration.

### `lib-empty-state`

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `icon` | `LucideIconData` | — (no default) | An icon that doesn't match the context is worse than none — fixed a real PWA bug where a hardcoded `Calendar` default showed up on unrelated error states |
| `message` | `string` (required) | — | |
| `actionLabel` | `string` | — | Shows an action button when set |

Output: `clicked`. No wrapper chrome — sits directly in whatever layout the consumer provides.

```html
<lib-empty-state message="No s'han trobat persones amb els filtres actuals" actionLabel="Neteja filtres" (clicked)="clearFilters()" />
```

## Component conventions

Cross-cutting rules for anyone adding a new `libs/ui` component:

- **Standalone + `OnPush` + Signals** — `input()`/`output()`/`computed()`, no `@Input()`/`@Output()`, no NgRx.
- **Icons: `LucideIconData` typed inputs**, never a string icon name — the PWA's pre-existing convention, standardized project-wide (dashboard's old `empty-state` used string names; that drift is what Tier 2 fixed).
- **`lib-` selector prefix** for every net-new `libs/ui` component. (`app-`/no-prefix stays reserved for verbatim ports, per `libs/pinyes-render`'s precedent — not yet relevant here since nothing has been ported.)
- **"Outline is a boolean modifier, not a variant"** — established for both Button and Badge: real DaisyUI usage always combines `btn-outline`/`badge-outline` with a color class, so `outline` is a separate boolean input, not folded into the color enum.
- **No component-local hex, no component-local one-off spacing** — everything styled through tokens or DaisyUI classes.
- **TDD for all logic** (RED → GREEN → REFACTOR) — pure-data token files (`radius.ts`, `shadow.ts`, `motion.ts`, `typography.ts`, `z-index.ts`) are the explicit config-file exception; everything with actual behavior gets a test written first.

**Consuming-page gotcha — every `lib-*` component's host is `display: contents`** (no box of its own; only its rendered root element — `<a>`/`<button>`/`<div>` — actually lays out). Two consequences to expect on every page in the Phase 7 rollout, not just the first one that hits them:
- **`space-y-*` on a parent silently stops working** once a `lib-*` component becomes one of its direct children — the sibling-margin trick only applies to child *boxes*, and a `display: contents` child has none. Use `flex flex-col gap-*` (or grid `gap-*`) on the parent instead; `gap` correctly promotes a `display: contents` child's own rendered element into the layout instead of the inert wrapper.
- **Sizing classes on the `<lib-*>` tag itself do nothing** (`class="min-h-48"` on `<lib-card>` has no box to apply to) — put sizing on a wrapper `<div>` inside the projected content instead.

## Usage rules

1. **Reach for `libs/ui` first.** Don't hand-roll a `btn`/`badge`/`card`/`input`/`modal`/toast/empty-state block inline — that duplication is exactly what this library exists to eliminate.
2. **No raw hex codes** outside `libs/ui/src/lib/tokens/*.ts`. If a color isn't there, it doesn't belong in a component.
3. **No Tailwind arbitrary-value syntax** (`bg-[...]`, `text-[...]`, etc.) outside a justified, commented exception — this directly extends `DASHBOARD_UI.md`'s pre-existing "Mai classes Tailwind dinàmiques" rule, now with real tokens to reach for instead.
4. **`conflict` doesn't exist as a color** — it's retired project-wide in favor of `variant="error"` (see the plan doc's dedicated note on this).
5. **Text in Catalan, code in English** — unchanged from `CLAUDE.md`'s existing convention; applies identically to `libs/ui` component labels/messages.
6. **A component with no documented variant for your case is a signal, not a workaround target** — if `libs/ui` is missing something a real screen needs, that's a reason to extend the library (and this doc), not to hand-roll around it in app code.

## Theming / dark mode

`generateCollaTheme(shirtHex, sashSpec)` (`libs/ui/src/lib/tokens/theme.ts`) derives a complete DaisyUI theme — every semantic color role plus every `--ds-*` custom property — for both light and dark mode from those two inputs alone. `tailwind.config.ts` registers the result per colla:

```ts
daisyui: {
  themes: [
    { 'colla-barcelona': generateCollaTheme('#1E3A8A', { kind: 'hue', hex: '#6B4C91' }) },
  ],
}
```

Runtime switch: `document.documentElement.setAttribute('data-theme', 'colla-nova')`. Dark mode isn't a flat inversion — several tokens (shadow tint, `disabled`'s `recedeExtremeGap`, categorical dark variants) compute differently by mode rather than reusing light-mode values unmodified, since a straight invert reads wrong for some of them (a dark shadow reads weakly against an already-dark surface; a pale light-mode categorical hue reused in dark mode reads as a glow, not a receding shadow).

## Accessibility

- **Contrast:** `contrastContent()` uses real APCA contrast (via `apca-w3`), not naive relative-luminance — used wherever a solid custom color needs readable content on top (Badge's `color`, Card's `sashColor`). Never picks flat `#000`/`#fff`.
- **Focus:** `lib-modal` uses native `<dialog>` semantics specifically for the real browser-native focus trap this gives — the CSS-only convention every existing app modal uses today has none (see `already-assigned-dialog.component.ts`'s hand-written focus workaround for a concrete symptom of that gap).
- **Live regions:** `lib-toast-container`'s root has `aria-live="polite"`; `lib-empty-state`'s root has `role="status"`.
- **Labels:** `lib-input` auto-generates a stable `id` when none is supplied, wiring `label[for]` and `aria-describedby` (for hint/error text) automatically — neither was handled consistently by hand across the app's ~30 existing form instances.
- **Icon-only meaning:** `lib-toast-container` never conveys type by color alone — every toast type has its own icon (`CheckCircle`/`AlertCircle`/`AlertTriangle`/`Info`).

## Live reference

`/design-system` in the dashboard (ADMIN only) renders every token and every shipped component's documented variants/states with real content — light/dark switchable, nothing screenshotted. If this doc and that route ever disagree, the route is live and this doc might be stale; fix whichever is wrong.

## Guardrails

`pnpm run lint:tokens` (`scripts/check-design-tokens.mjs`) scans both apps + `libs/pinyes-render` + `libs/ui` for raw hex literals and color-related Tailwind arbitrary values (`bg-[...]`, `text-[...]`, etc.) outside `libs/ui/src/lib/tokens/`, and runs as its own step in CI. **Warn-only for now** — Tier 3/5 below haven't landed, so it reports drift without failing the build; it'll ratchet to a hard fail once that backlog clears.

## What's next

This doc covers what's actually shipped (tokens + the 7 Tier 1/2 components above, the live style guide, the drift check). Not yet built, and not documented here until they land:

- **Tier 3** — restyling ~25 existing single-app components (`data-table`, `filter-bar`, `color-picker`, `bottom-tab-bar`, etc.) to consume these tokens/primitives in place, folded into Phase 7's page-by-page rollout rather than a standalone pass.
- **Tier 5** — pointing the Konva canvas (`libs/pinyes-render`) at these same tokens instead of its own literal values (colors, categorical palette, motion) — `lint:tokens`' single biggest source of findings today (`figure-canvas.component.ts` alone).
- **Phase 7** — the actual rollout replacing real hand-rolled markup in both apps with these components, page by page; also when `lint:tokens` ratchets from warn-only to a real failing check.

Full detail on all of the above, plus the reasoning behind every decision already made — [docs/superpowers/specs/2026-08-16-design-system-plan-design.md](superpowers/specs/2026-08-16-design-system-plan-design.md).

---

*Veïns: [[DASHBOARD_UI]] · [[PINYES_MODULE]] · [[MAP]]*
