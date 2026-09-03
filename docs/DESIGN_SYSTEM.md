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

**`contrastContent(background, darkContent, lightContent)`** picks readable content color via real APCA contrast (not naive relative luminance) — used everywhere a solid fill needs readable text/icon color on top of an arbitrary custom color (Badge's `color` override, Card's `sashColor` override), and by the sash motif itself (below) for its own fill.

`contrastContent` gamut-maps every candidate (`culori`'s `clampChroma`) before computing APCA luminance. Needed because fixed L/C targets — the sash's `SASH_L=0.52`/`SASH_C=0.2` in particular — can land outside the sRGB gamut for some hues (confirmed: `#B32400`, h≈33°); left unclamped, culori's raw RGB conversion returns an out-of-range channel (e.g. blue < 0), which collapses both candidates' APCA contrast to ~0 — a tie the `>=` tie-break silently resolves to dark content regardless of how dark the color actually reads. Gamut-mapping first matches what a browser actually paints for an out-of-gamut `oklch()` value, so the text-color decision agrees with the rendered fill.

### Typography

```ts
// libs/ui/src/lib/tokens/typography.ts
FONT_FAMILY.sans    // Quicksand — global body default (both apps' current `html { font-family }`)
FONT_FAMILY.serif   // Fraunces — display headings (principle #1's "hand-made" character)
FONT_FAMILY.legible // Atkinson Hyperlegible Next — canvas figure/node name labels specifically
FONT_FAMILY.mono    // Atkinson Hyperlegible Mono — aliases, typed/search fields, other short fixed-width IDs
```

All four are self-hosted via `@fontsource/*` imports in both apps' `styles.scss` and exposed as Tailwind utilities (`font-sans`/`font-serif`/`font-legible`/`font-mono`). **`serif` first applied in Phase 7** — the dashboard `/home` greeting (`<h1>`) is the first real usage, setting the precedent for other page-level `<h1>` headings as their turn comes in the rollout, not yet applied retroactively to already-shipped pages. **`legible` is not yet applied anywhere** — its intended use (canvas labels) waits on the Tier 5 canvas token bridge. **`mono` overrides Tailwind's own generic system-monospace default** — every existing (and future) `font-mono` usage across both apps picks up the real font automatically, no per-call-site change needed; same Atkinson Hyperlegible family as `legible`, in its monospace cut, chosen for the same legibility-first reasoning.

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

**The hover-lift/press-bounce motion itself is one shared, global class — not a per-component rule.** `libs/ui/src/lib/components/*/*.component.scss` files are Angular-encapsulated (each component's `<style>` only ever applies to its own template), so a rule written inside `lib-card`'s stylesheet can never reach `lib-button`'s or a plain hand-rolled clickable element elsewhere in an app. `.ds-lift`/`.ds-lift-surface`/`.ds-lift-no-shadow` (`libs/ui/src/styles/_interactive.scss`) live outside any component instead, imported once into each app's global stylesheet via `stylePreprocessorOptions.includePaths` (see `project.json`), so retuning the transition curve, the lift distance, or swapping the motion for something else entirely is one edit that reaches every consumer — `lib-button`, `lib-badge`'s `clickable` mode, `lib-card`'s `clickable`/`interactiveClass`, and hand-rolled clickable rows like `app-data-table`'s card-mode. Consumers only vary by CSS custom property, never by copying the rule: `--ds-lift-shadow` (`.ds-lift-no-shadow` zeroes it — a tightly-packed row of chips needs a tighter blur than `--ds-btn-lift-shadow` gives, or hover-lift bleeds into neighbors) and `--ds-lift-press-scale`/`--ds-lift-press-shadow` (`.ds-lift-surface` presets these for large surfaces like Card — `0.98` press vs. Button/Badge's default `0.93`, plus a resting shadow that survives the press).

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
| `ghost` | `boolean` | `false` | Renders `btn-ghost` (no fill, no border) while keeping `variant`'s role colour as the text/icon colour — a lighter-weight alternative to `outline` for a coloured action that shouldn't carry a box (e.g. a destructive icon button in a dense card row). Takes precedence over `outline`; ignored on a `joinItem` |
| `fullWidth` | `boolean` | `false` | Applies `w-full` to the rendered `<button>`/`<a>` itself — a class on the `<lib-button>` tag is inert (host is `display: contents`, see Component conventions). Real pattern: every existing raw-`<button>` form-submit footer in the app (~11 files) sizes itself this way |
| `disabled`, `loading`, `type`, `ariaLabel` | — | — | `loading` auto-disables (native `disabled`, so a second click/Enter-triggered resubmit can't slip through) and shows a sized spinner — but reads as *busy*, not *disabled*: fill/border/text stay at their resting-state formula (solid or outline alike), no dashed "sketched" look and no grey-out. A real `disabled` (not loading) still gets that treatment |
| `ariaExpanded`, `ariaPressed` | `boolean` | — | For a real toggle button (a visibility switch, a collapse/expand disclosure) — unset by default, so the attribute is simply absent rather than `"null"`. Distinct from `active`: that one is `lib-button-group`'s purely visual "which joinItem segment is selected" marker, not a toggle-button ARIA state |
| `ariaControls` | `string` | — | Id of the region a disclosure toggle expands/collapses (e.g. `segment-conflict-panel`'s "Mostra"/"Amaga") — pairs with `ariaExpanded` the same way a raw `<button aria-controls aria-expanded>` would |
| `routerLink`, `href` | `string \| unknown[]`, `string` | — | Link mode, mirroring `lib-card`: `routerLink` wins over `href`, renders an `<a>` instead of `<button>`. **Throws** if combined with `disabled`/`loading` — a disabled or loading link isn't a supported shape |
| `joinItem` | `boolean` | `false` | Adds DaisyUI's `.join-item` to the button's own rendered element — for use inside `lib-button-group`, which can't add the class itself (see below) |
| `active` | `boolean` | `false` | Marks this joinItem segment as the currently-selected one. No effect without `joinItem`. Deliberately NOT DaisyUI's own `.btn-active` (a darkened fill) — nothing else in the app marks "selected" that way. Meaning depends on `outlineMode` below |
| `outlineMode` | `boolean` | `false` | Only meaningful with `joinItem`. Swaps the segment's selected/unselected mapping: default (**fill mode**) is selected=filled, unselected=outline; `outlineMode` (**outline mode**) is selected=outline, unselected=ghost — a lighter-weight look for busier toolbars. Either mode works with any `variant` **except** `'ghost'` itself, which **throws** when combined with `joinItem` — ghost has no fill and no border, so it could never show which segment is selected |
| `autofocus` | `boolean` | `false` | Imperative (`effect()` + `viewChild`), not the native HTML attribute — same rationale as `lib-input`/`lib-textarea`'s own `autofocus`, and for the same reason: a `<dialog>.showModal()` does honor a native `autofocus` attribute on its own, but only when it sits on the real focusable element, which a `display: contents` host can't forward down from `<lib-button autofocus>` to its inner `<button>`/`<a>`. Used by `already-assigned-dialog`'s "Moure ací" — the habitual action inside a `lib-modal` that should already have focus the instant it opens |

Output: `clicked`. Content-projected. Hover lifts (`translateY` + `--ds-btn-lift-shadow`, no color change); press flattens with `EASE_SPRING` and shifts to `--ds-{role}-active`; disabled renders as a dashed, unfilled outline in `--ds-{role}-disabled`.

```html
<lib-button variant="primary" (clicked)="save()">Desa</lib-button>
<lib-button variant="error" outline [loading]="saving()">Elimina</lib-button>
<lib-button variant="error" ghost shape="square" ariaLabel="Elimina"><lucide-icon name="Trash2" /></lib-button>
<lib-button variant="warning" outline routerLink="/sync">Sincronitza tot</lib-button>
<lib-button type="submit" variant="primary" fullWidth [disabled]="form.invalid">Inicia sessió</lib-button>
```

### `lib-button-group`

Thin `.join` layout wrapper (`role="group"`) around a row of `lib-button [joinItem]`s — a segmented control or paginator. `lib-button-group` itself can't add `.join-item` to its children: each `<lib-button>`'s host is `display: contents` (see Component conventions), so there's no element of the wrapper's own for `.join`'s CSS to select — the marker has to live on each button's own rendered tag instead, hence the `joinItem` input rather than the group inferring it. Same "duplicate the marker on each child" trade-off as `lib-form-field`'s `id`.

Pure layout, no shared selection state: the caller drives each button's own `active`/`(clicked)` — there's no group-level `value`/`(change)`. Deliberately dumb, matching every other `lib-*` component here.

| Input | Type | Default |
|-------|------|---------|
| `vertical` | `boolean` | `false` — `join-vertical` instead of the default horizontal row |
| `fullWidth` | `boolean` | `false` — stretches the `.join` row to fill its container (DaisyUI's `.join` is `display: inline-flex`, sized to content by default). Pair with `fullWidth` on each `joinItem` child, each wrapped in its own `flex-1 min-w-0` element — `lib-button`'s `display: contents` host can't be a flex item itself, so without that wrapper `fullWidth` has nothing to size against and every segment still claims the whole row |

```html
<!-- fill mode (default): selected = filled, unselected = outline -->
<lib-button-group>
  <lib-button joinItem variant="primary" [active]="tab() === 'cens'" (clicked)="tab.set('cens')">Cens</lib-button>
  <lib-button joinItem variant="primary" [active]="tab() === 'provisionals'" (clicked)="tab.set('provisionals')">Provisionals</lib-button>
</lib-button-group>

<!-- outline mode: selected = outline, unselected = ghost -->
<lib-button-group>
  <lib-button joinItem outlineMode variant="neutral" [active]="tab() === 'cens'" (clicked)="tab.set('cens')">Cens</lib-button>
  <lib-button joinItem outlineMode variant="neutral" [active]="tab() === 'provisionals'" (clicked)="tab.set('provisionals')">Provisionals</lib-button>
</lib-button-group>

<!-- full-width, evenly-split segments (e.g. a mode switcher in a narrow sidebar) -->
<lib-button-group fullWidth>
  @for (option of modeOptions; track option.value) {
    <div class="flex-1 min-w-0">
      <lib-button joinItem fullWidth variant="primary" [active]="mode() === option.value" (clicked)="mode.set(option.value)">
        {{ option.label }}
      </lib-button>
    </div>
  }
</lib-button-group>
```

**Component-authoring gotcha this raised:** the doubled border where two `joinItem` segments touch (`.btn`'s own 2px border, drawn by both neighbors at the shared edge) can't be fixed from `lib-button-group`'s own stylesheet — each segment is a *separate* `<lib-button>` component instance, and Angular's emulated encapsulation can't reach into a sibling component's projected content. Fixed instead on `lib-button`'s own `:host(:not(:first-child))` (plus a `:host-context(.join-vertical)` variant) — `:host()`'s structural pseudo-classes still see the button's real DOM position among the siblings `lib-button-group`'s `.join` wrapper actually parents, even though `display: contents` removes it from the box tree. Not unit-testable in this repo's Jest+jsdom harness (`getComputedStyle` doesn't resolve `:host()`-scoped rules there) — verified manually instead.

Live (both modes) right after the `lib-button` section on `/design-system` — not yet rolled out to `person-list`'s Cens/Provisionals toggle or `app-pagination`, pending feedback on the shape.

### `lib-badge`

| Input | Type | Default |
|-------|------|---------|
| `variant` | 9 DaisyUI roles | `'neutral'` |
| `size` | `xs\|sm\|md\|lg` | `md` |
| `outline` | `boolean` | `false` |
| `color` | `string` (hex) | — overrides `variant`; content color via `contrastContent` |
| `clickable` | `boolean` | `false` | Renders a real `<button type="button">` instead of a `<span>` — a genuine interactive control, not a styled label with a click handler bolted on |
| `selected` | `boolean` | `false` | Toggle-chip state — filled when selected, outline-only (`badge-outline`, same as the static `outline` input) when not — and `aria-pressed`. Only meaningful with `clickable` — a static label has no toggle state |
| `readableOutlineText` | `boolean` | `false` | When outlined **and** `color` is set, falls back to the ambient theme text color instead of the tag's own hex — the border still stays in the tag color. Off by default (matches `outline`'s plain color-as-text behavior); turn on for chip pickers where pale tag colors read poorly as text (e.g. Etiquetes) |

Content-projected. No `conflict` variant — use `variant="error"`. Default (non-`clickable`) mode is a static, non-interactive `<span>`; `clickable` is for multi-select chip pickers (e.g. a person's tag selector), not a substitute for `lib-button`.

Output: `clicked` (only with `clickable`).

```html
<lib-badge variant="success">Confirmat</lib-badge>
<lib-badge [color]="tag.color">{{ tag.name }}</lib-badge>
<lib-badge clickable readableOutlineText [selected]="isSelected(tag.id)" [color]="tag.color" (clicked)="toggle(tag.id)">{{ tag.name }}</lib-badge>
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

### `lib-tabs`

`role="tablist"` nav (DaisyUI `.tabs`) driven by a data array of `TabDef`s (`{ id, label, icon? }`) and one `activeId`/`(activeIdChange)` pair, replacing three previously-independent, near-duplicate implementations: the event-detail Resum/Pinyes/Assistència/Participació strip, the segment-workspace Pinyes/Troncs/Distribució/Nodes extra/Previsualitza strip, and the template editor's Pinya/Rengles/Tronc mode switcher (a real mutually-exclusive mode despite its previous `aria-pressed` toggle-button markup — see the component's own doc comment). Owns the `tablist` nav only, not content switching: the caller still decides how to mount/hide/lazy-render whatever `activeId` points at, same "caller drives it" philosophy as `lib-button-group`. Internalizes the WAI-ARIA roving-tabindex keyboard pattern (Left/Right/Home/End) so every consumer gets it uniformly, including the two that didn't have it before.

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `tabs` | `TabDef[]` | required | `{ id: string; label: string; icon?: LucideIconData }` |
| `activeId` | `string` | required | |
| `style` | `'boxed'\|'bordered'` | `'boxed'` | Maps 1:1 to DaisyUI's own `tabs-boxed`/`tabs-bordered` modifiers |
| `ariaLabel` | `string` | `''` | |
| `testIdPrefix` | `string` | `''` | Opt-in `data-testid="{prefix}-{tab.id}"` per button, for call sites whose specs already query by test id (e.g. event-detail) |
| `panelIdPrefix` | `string` | `'tabpanel-'` | `aria-controls` target per tab — override when the caller's own panel ids don't match the generic default |

Output: `activeIdChange` — only emitted when a *different* tab is selected (clicking the already-active tab, or pressing arrow keys that land back on it, is a no-op). One real behavior change this caused during rollout: the template editor's Rengles button used to toggle back to Pinya mode when clicked a second time (an `aria-pressed` toggle button); as a tab it no longer self-deselects, which is the semantically correct call for `role="tab"` but is worth knowing if a future consumer expects toggle-off.

**`:host` is `display: contents`** — same as every other `lib-*` here. A margin-based spacing utility (`space-y-*`, `mt-*`) on the parent has nothing to attach to on `<lib-tabs>` itself and silently does nothing; wrap it in a real element (`<div class="mt-4">`) to reach it — this exact bug shipped once in `event-detail` and was caught the same day. `gap-*` on a flex/grid ancestor works with no wrapper, as usual.

```html
<lib-tabs
  [tabs]="tabDefs"
  [activeId]="activeTab()"
  ariaLabel="Seccions de l'esdeveniment"
  panelIdPrefix="event-tabpanel-"
  (activeIdChange)="setTab($event)"
/>
```

Live on `/design-system` right after `lib-card`, and rolled out to event-detail, segment-workspace, and the template editor. Deliberately **not** used for the top bar's Inici/Persones/Assajos nav (`tab-nav.component`) — that's route-driven with a mobile hamburger-collapse fallback, a different responsibility (app-level navigation vs. in-page section switching), and stays visually distinct (underline, shirt-colored) on purpose.

### `lib-form-field`

The label/required-marker/hint/error chrome shared by `lib-input` and `lib-select` (both compose it internally) — and also the right choice for wrapping something neither of those cover: a raw `<textarea>`, or a fully custom control like a chip-toggle tag picker (`person-detail`'s "Etiquetes" selector uses it this way). Pure content projection, no control interface: the wrapper never sees the projected control's value or validity, so `hint`/`errorText` are plain inputs the caller drives itself (typically from `form.get('x')?.invalid`), same as `lib-input` already did before this existed.

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `label`, `hint`, `errorText`, `required` | — | — | Same contract as `lib-input`'s own (previously baked-in) versions |
| `size` | `xs\|sm\|md\|lg` | `sm` | Only drives the label text size (`xs` shrinks it) — sizing the projected control itself is the caller's job |
| `id` | `string` | — | Wires `label[for]` and the hint/error's id (`${id}-description`) — **the caller must also put this same id on their own projected control**. No `MatFormFieldControl`-style registration contract here on purpose (this library stays "dumb" the way Card/Button do); the trade-off is this one bit of caller-side repetition instead of hidden coupling |

```html
<lib-form-field label="Etiquetes" size="xs">
  <div class="flex flex-wrap gap-1.5" role="group" aria-label="Selecció d'etiquetes">
    @for (tag of tags(); track tag.id) {
      <lib-badge clickable [selected]="isSelected(tag.id)" [color]="tag.color" (clicked)="toggle(tag.id)">{{ tag.name }}</lib-badge>
    }
  </div>
</lib-form-field>
```

**Shared field chrome, same reasoning as Motion above.** `libs/ui/src/styles/_fields.scss` (imported once into each app's global stylesheet, same `stylePreprocessorOptions.includePaths` mechanism as `_interactive.scss`) gives every DaisyUI `.input`/`.select`/`.textarea` — inside `lib-input`/`lib-select` or hand-rolled raw (e.g. person-detail's "Observacions tècniques" `<textarea>`) — a 2px border (DaisyUI's own default is 1px; matches `lib-button`'s own border weight) and a focus treatment that swaps the border color to the theme's primary accent in place, instead of DaisyUI's own default of stacking a same-colored 2px outline *outside* the existing border. One edit reaches every field in the app, migrated to `lib-input`/`lib-select` or not.

### `lib-input`

`ControlValueAccessor` — the first use of this pattern in the codebase (every existing form previously bound `formControlName`/`ngModel` straight to a raw native control). Works with both reactive and template-driven forms. Composes `lib-form-field` for its label/hint/error chrome.

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `label`, `hint`, `errorText` | `string` | — | `errorText` replaces `hint` in the same slot when both are set; drives `input-error` + `aria-invalid` |
| `ariaLabel` | `string` | — | For a compact, label-less field (no visible `label`) that still needs an accessible name — `label` always renders visible text via `lib-form-field`, which isn't the right call for e.g. an inline rename field in a toolbar row |
| `icon` | `LucideIconData` | — | Optional prefix icon inside the box |
| `size` | `xs\|sm\|md\|lg` | **`sm`** | Deviates from DaisyUI's own `md` default — real usage is 53× `sm`/4× `xs`/0× `md`/`lg`. Watch for this specifically when migrating a page whose raw markup used unmodified `.input input-bordered` (no size class, i.e. DaisyUI's implicit `md`, 48px) — swapping in `lib-input` with no `size` set silently shrinks it to `sm` (32px). Pass `size="md"` explicitly to preserve the original height (hit on the auth pages) |
| `type`, `placeholder`, `disabled`, `required`, `autocomplete`, `id` | — | — | `id` auto-generates a stable per-instance value if omitted, wiring `label[for]` + `aria-describedby` automatically. `type` includes `'date'` (added for detail-view edit forms — birth date, shirt date, ...) alongside the text-like types |
| `min`, `max` | `string \| number` | — | Passed straight through to the native `min`/`max` attributes — meaningful for `type="number"`/`"date"`, browsers already validate/constrain against them |
| `maxLength` | `number` | — | Passed straight through to the native `maxlength` attribute |
| `autofocus` | `boolean` | `false` | Imperative (a constructor `effect()` + `viewChild` calling `.focus()`), not the native HTML `autofocus` attribute — this field is almost always toggled into existence by an `@if` (an inline rename row appearing), and the native attribute's own "focus on insertion" behavior is inconsistent across browsers for that case in a way a direct call isn't |

| Output | Payload | Notes |
|--------|---------|-------|
| `blurred` | `void` | A real `@Output`, not just internal CVA touched-tracking (`registerOnTouched`) — some callers (the ad-hoc node label, `nodes-tab`) run live-preview-then-commit-on-blur logic that needs to know the blur actually happened. `(blur)` placed directly on `<lib-input>` wouldn't fire: the native `blur` event doesn't bubble, so it never reaches the host from the inner `<input>`. Same shape as `lib-textarea`'s own `blurred`, added at the same time for the same reason |

The native `<input>` itself always carries `min-h-6` — a >=24px tap target independent of the wrapper box's own height (WI-03 parity; ported in from the one-off fix on the dashboard/PWA auth pages, now baked into every consumer).

Border weight and the focus-swap-in-place treatment come from the shared `_fields.scss` partial — see above.

```html
<lib-input formControlName="email" label="Correu electrònic" [icon]="Mail" type="email" required />
<lib-input formControlName="shoulderHeight" label="Alçada espatlles (cm)" type="number" [min]="0" [max]="250" />
```

`textarea` has its own component — see `lib-textarea` below — sharing the same `ControlValueAccessor`/`lib-form-field` contract rather than being folded into `lib-input` itself (a multi-line control needs `rows`/`resize`, neither meaningful for a single-line input).

### `lib-select`

The select-flavored analogue of `lib-input` — same `ControlValueAccessor`/size/hint/error/`ariaLabel` contract via `lib-form-field`, wrapping a native `<select>` instead of `<input>`. Options are content-projected (`<option>`/`<optgroup>`), not modeled as a data input — a caller's own list usually needs `@for`/conditional rendering a plain array input can't express as cleanly. Setting `.value` from a template binding races the projected `<option>`s (the `<select>`'s own bindings apply before its children are inserted, so the browser silently ignores a value with no matching option yet) — fixed internally with an `effect()` that applies it after the view settles, not a template `[value]` binding.

```html
<lib-select formControlName="availability" label="Disponibilitat">
  <option value="AVAILABLE">Disponible</option>
  <option value="TEMPORARILY_UNAVAILABLE">No disponible</option>
</lib-select>
```

The closed control has always been stylable with plain CSS — the *dropdown panel* never was, since it's browser/OS-drawn chrome. `lib-select`'s native `<select>` carries `appearance: base-select` (Chrome/Edge's "customizable select" — [Chrome Developers article](https://developer.chrome.com/blog/a-customizable-select)), styled via `::picker(select)`/`option` rules gated in `@supports (appearance: base-select)`, so the popup picks up the app's theme too. Unsupported browsers (Firefox/Safari as of writing) silently render the ordinary native picker instead — that unstyled fallback *is* the fallback, no separate code path needed. The same relaxed `<option>` content model this API brings also allows child markup (an icon, a color swatch) inside an `<option>`, not just text — used by the "tipus de posició" rich-content example on `/design-system` (not yet wired into the real template-editor picker, which still has its own hand-rolled listbox with an extra "Altre" state worth its own migration pass). The same `@supports` block also drops DaisyUI's own hand-drawn arrow (`background-image`, the pre-base-select convention for when `appearance: none` hid the native one) — base-select mode draws its own indicator, so left in place the two stacked into a double arrow; unsupported browsers still get DaisyUI's arrow same as always, since the whole block is gated.

**`swatchColor`/`swatchShape`** (single mode only) — a decorative leading dot (`'circle'`, the default, or `'square'`) rendered as `lib-select`'s own overlay, independent of the projected `<option>` content above. Rich `<option>` content (an icon, a swatch) already shows inside the *open* dropdown everywhere, and inside the *closed* control too, but only in browsers supporting `appearance: base-select` — Firefox/Safari fall back to plain option text there, silently dropping it. `swatchColor` renders reliably in the closed control regardless of that support, for a field whose currently-selected color needs to stay visible either way (the template editor's "tipus de posició" picker):

```html
<lib-select label="Tipus de posició" [swatchColor]="preset.color" [swatchShape]="preset.shape === NodeShape.ELLIPSE ? 'circle' : 'square'" ...>
  @for (preset of presets; track preset.positionType) {
    <option [value]="preset.positionType">{{ preset.label }}</option>
  }
</lib-select>
```

`multiple` swaps the native `<select>` for a checkbox-list dropdown instead (`value` becomes `string[]`) — native `<select multiple>`'s ctrl/cmd-click scrolling listbox is bad UX on its own merits, unrelated to base-select support, so it's never used. The native `<select>` stays in the DOM (visually hidden) purely as the canonical projected-`<option>` source: a `MutationObserver` re-scans it whenever the caller's own template changes what it projects, and each checkbox row clones that option's child nodes (`cloneNode`, never `innerHTML` — the nodes are already-rendered DOM, so relocating them carries no injection risk) into itself, so rich content renders identically in both modes from the exact same `<option>` markup:

```html
<lib-select [multiple]="true" label="Etiquetes" [ngModel]="selectedIds()" (ngModelChange)="selectedIds.set($event)">
  @for (tag of tags(); track tag.id) {
    <option [value]="tag.id">{{ tag.name }}</option>
  }
</lib-select>
```

Live examples of all three (plain single, rich-content single, `multiple`) right after the `lib-select` heading on `/design-system`.

The `multiple` trigger is a plain `<button>` styled with the exact same field classes as the native `<select>` above (same `boxClasses`, not `lib-button`'s variant/outline system) — deliberately **not** the shared `ds-lift` hover-lift/press-bounce motion (`libs/ui/src/styles/_interactive.scss`, see "Motion" above): that language is for discrete action controls (buttons, cards, clickable badges), and a field's own open-dropdown trigger reads as *part of the field*, not a separate action — mixing the two made it visually inconsistent with the plain `<select>` right next to it. If a future spot needs a *real* clickable button styled like a field, reach for `lib-button` with a custom variant rather than reintroducing this pattern.

Both `lib-input`/`lib-select`'s label-above-field layout is unconditional — no side-by-side (label left of field on wide screens, stacked below `sm`) mode exists yet. A dense two-column edit form that wants that stays on raw markup.

Both fields' box background is a flat `bg-base-100` always — an earlier ambient-contrast version (base-200, flipping to base-100 under a base-200 ancestor) was tried and reverted in favor of one consistent color everywhere.

### `lib-checkbox`

Same `ControlValueAccessor`/`ariaLabel`/`size` contract as `lib-input`, but the label is **content-projected** (like `lib-button`), not a string input — a real audit of the app's 25 existing checkboxes found labels ranging from a plain trailing word ("Sols actius") to a two-line title+hint block (`news-editor`'s send-push checkbox), which a plain string can't express. Deliberately just the one shape — DaisyUI's separate `.toggle` switch was considered and dropped: one control, one shape, is simpler to reason about than picking between two for every call site, and nothing in the real audit needed the switch affordance specifically:

```html
<lib-checkbox formControlName="countsForStatistics">Compta per a estadístiques</lib-checkbox>

<!-- label-less — the description lives in a sibling element outside the component -->
<lib-checkbox ariaLabel="Activar notificacions" [ngModel]="push.isSubscribed()" (ngModelChange)="toggle()" />

<!-- rich label content -->
<lib-checkbox [ngModel]="sendPush()" (ngModelChange)="sendPush.set($event)" [disabled]="!!pushSentAt()">
  <span class="label-text font-medium">Notifica els membres</span>
  <p class="text-xs text-base-content/50">La notificació s'enviarà quan es publique la notícia.</p>
</lib-checkbox>
```

| Input | Type | Default | Notes |
|---|---|---|---|
| `size` | `'xs'\|'sm'\|'md'\|'lg'` | `'sm'` | Matches `lib-input`'s own default-`sm` real-usage skew |
| `variant` | `'neutral'\|'primary'\|'secondary'\|'accent'\|'success'\|'warning'\|'info'\|'error'` | `'primary'` | `'neutral'` is DaisyUI's own unmodified `.checkbox` — a plain dark outline, not a fabricated color the way `lib-button`/`lib-badge`'s `neutral` variant is a real filled color; the other 7 are real `checkbox-{variant}` colors |
| `ariaLabel` | `string` | — | For a label-less checkbox (no projected content) |
| `disabled`, `required`, `id` | | | Same as `lib-input` |

**Real bug this caught:** the variant→class mapping was first written as a template-literal computed (`` `checkbox-${variant}` ``) rather than a static `Record` lookup — Tailwind's content scanner can't see a dynamically-built string, so any variant whose class name doesn't appear literally elsewhere in the codebase (`secondary`/`accent`/`warning`/`info`/`error` — only `checkbox-primary`/`checkbox-success` happened to already exist as literal strings in real call sites) got silently dropped from the compiled CSS and rendered with no color at all. Fixed with the same static `Record<CheckboxVariant, string>` map every other `lib-*` component already uses (`lib-button`'s `VARIANT_CLASSES`, etc.) — see [CLAUDE.md](../CLAUDE.md)'s "Dynamic Tailwind classes must use static maps" rule, which this violated despite being written after that rule already existed.

**Deliberately excluded from `lib-checkbox`:** DaisyUI's `.collapse` accordion pattern also uses a bare `<input type="checkbox">` as its structural, invisible open/close driver (`person-detail`'s Historial/Metadades sections, `column-toggle`'s own wrapper, `template-editor-help-modal`'s FAQ items) — that's a different job entirely (no visible checkbox glyph, no label, and it depends on being a literal DOM sibling of `.collapse-title`/`.collapse-content` for DaisyUI's `:checked ~` CSS to find it). Wrapping it in `lib-checkbox` would both be visually wrong (it would render a visible box+label nobody wants) and risk breaking that sibling relationship depending on where `lib-form-field`-style wrapper markup lands — left raw on purpose, not a gap.

### `lib-textarea`

The multi-line analogue of `lib-input` — same `ControlValueAccessor`/`label`/`hint`/`errorText`/`ariaLabel`/`size`/`id` contract via `lib-form-field`, wrapping a native `<textarea>`. A real audit of the app's 8 existing textareas found two distinct extra needs a single-line `lib-input` has no use for: a `rows` count, and turning off resizing for a few small fixed-purpose fields inside a modal (the "comodí" node label, the ad-hoc node label) — both promoted to real inputs rather than being left as raw-class escape hatches.

```html
<lib-textarea formControlName="description" label="Descripció" [rows]="3" [maxLength]="500" />

<!-- fixed-size, non-resizable, inside a modal -->
<lib-textarea [resize]="false" [rows]="3" [ngModel]="comodinLabel()" (ngModelChange)="comodinLabel.set($event)" ariaLabel="Nom del node" />
```

| Input | Type | Default | Notes |
|---|---|---|---|
| `label`, `hint`, `errorText` | `string` | — | Same slot/priority rules as `lib-input` |
| `ariaLabel` | `string` | — | For a label-less textarea |
| `size` | `'xs'\|'sm'\|'md'\|'lg'` | `'sm'` | Same real-usage-skew default as `lib-input` |
| `rows` | `number` | `3` | Matches the app's own real usage — every existing textarea already used `rows="3"` bar one |
| `resize` | `boolean` | `true` | `false` adds `resize-none`, for a field whose surrounding layout can't tolerate the user dragging it taller |
| `maxLength`, `disabled`, `required`, `id` | | | Same as `lib-input` |
| `autofocus` | `boolean` | `false` | Same imperative `effect()` + `viewChild` pattern as `lib-input`'s own `autofocus` — used by the "comodí" node-label dialog, which needs the field focused the instant it opens |

`(blurred)` — a real `@Output`, not just the internal CVA `registerOnTouched` plumbing: the ad-hoc node label runs live-preview-then-commit-on-blur logic (`onLabelPreview` on every keystroke, `onLabelCommit` on blur) that needs an actual blur signal. `(blur)` bound directly on `<lib-textarea>` would silently never fire — the native `blur` event doesn't bubble, so it never reaches the host element from the inner `<textarea>` — hence the dedicated output.

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
- **Sizing classes on the `<lib-*>` tag itself do nothing** (`class="min-h-48"` on `<lib-card>` has no box to apply to) — put sizing on a wrapper `<div>` inside the projected content instead. `class="w-full"` on `<lib-button>` is the same trap, made confusing by a coincidence: inside a `flex flex-col` parent (the fix for the bullet above), the button's rendered element becomes a direct flex item and *stretches to full width by default regardless of the inert class* — looks like it's working, isn't. Real fix: an explicit input the component applies internally (`fullWidth` on `lib-button`, mirroring `tone` on `lib-card`), not a class on the tag.

**Component-authoring gotcha — `<ng-content>` can't just be repeated across an `@if`/`@else`'s branches.** Hit while adding Badge's `clickable` mode (a `<button>` branch alongside the existing `<span>`): Angular resolves each `<ng-content>` selector to exactly one projection point at compile time, not "whichever branch is currently rendering" — the projected content silently ends up empty in one of the two branches (which one is an implementation detail, not something to rely on). Button and Card already had the fix in place before Badge needed it: one `<ng-template #inner><ng-content /></ng-template>`, then `<ng-container [ngTemplateOutlet]="inner" />` repeated in each branch instead of a second `<ng-content>`. The existing bare-fixture Badge spec (no real content passed through) didn't catch this — a projected-content assertion through a real host component is required to catch it, which is now Badge's own regression test too.

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
