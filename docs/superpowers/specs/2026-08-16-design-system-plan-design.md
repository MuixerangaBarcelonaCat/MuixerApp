# Design System — Build Plan

**Date:** 2026-08-16
**Status:** Draft
**Scope:** Process/infrastructure for building and enforcing a documented design system across `apps/dashboard` and `apps/pwa`. Does **not** define the visual identity itself (colors, type, shape language) — that comes from the user separately and gets poured into the token layer this plan builds.

---

## Problem

The apps currently look generic. Root cause, structurally, not just aesthetically:

- Both apps' entire visual identity reduces to one input — `generateCollaTheme(primaryHex)` in [tailwind.config.js](../../../tailwind.config.js) — which auto-derives every DaisyUI token from a single color. There is no typography scale, spacing scale, shape language, motion system, or component identity layer beyond stock DaisyUI v4.
- Reusable components exist only for the dashboard (`apps/dashboard/src/app/shared/components/`, documented in [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md)). The PWA has no equivalent shared layer, so nothing structurally guarantees the two apps look like the same product.
- Nothing prevents drift: no lint rule, no CI check, no living reference stops a raw hex code or an arbitrary Tailwind value from being pasted into a template.
- The canvas rendering layer (`libs/pinyes-render`, Konva-based) sources its own hardcoded colors — not just the documented `figure-palette.util.ts`, but **98 hex literals across the library** (64 alone in `figure-canvas.component.ts`: zone colors, selection/conflict strokes, and a set of attendance-status colors that independently reinvent values DaisyUI's `success`/`warning`/`error` tokens already define). CSS custom properties don't reach Konva draw calls, so even a perfect token layer in CSS wouldn't automatically cover canvas-drawn content. Full breakdown: Phase 1 appendix, §1.4.

None of this is a "pick better colors" problem. It's a "there is no system, only a single knob" problem. This plan builds the system; a separate pass (once the visual identity is defined) fills it in.

## Goal

A design system that is:

1. **Token-driven** — every visual decision (color, type, spacing, radius, shadow, motion) traces to one named, documented source, in both light and dark variants.
2. **Shared** — one component library consumed by both `apps/dashboard` and `apps/pwa`, not two parallel implementations.
3. **Documented** — a single canonical doc (`docs/DESIGN_SYSTEM.md`) plus a live, in-app reference that can't silently go stale.
4. **Enforced** — drift (raw hex, ad hoc spacing, one-off components) is structurally hard, ideally CI-blocked, not just "please don't."

## Non-goals

- Choosing the actual palette, typography, or "personality" — that's the user's call, fed into Phase 2 once this plan is approved.
- New product features. This is purely presentation-layer infrastructure.

**Explicitly in scope, called out because it's easy to assume otherwise:** the Konva canvas (`libs/pinyes-render`) is not exempt. Its palette (the qualitative figure-distinguishing colors, panel background, shadow) and node styling are designed as part of the same identity, not left as a separate hardcoded set that's merely re-plumbed to read tokens. See 2.1/2.3 and 7.2.

---

## Phase 1 — Audit current state

Before any token is named, inventory what exists so the system is sized to reality, not guessed.

**1.1 — Dashboard shared components.** Verify [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md)'s component table (`app-page-header`, `app-data-table`, `app-filter-bar`, `app-active-filters`, `app-column-toggle`, `app-pagination`, `app-empty-state`, `app-stat-card`, `app-toast`, `app-emoji-picker`, `app-person-search-input`) against the actual `shared/components/` tree — flag anything undocumented or removed.

**1.2 — PWA component landscape.** Walk `apps/pwa/src/app/features/` and note which UI patterns are hand-rolled per feature (buttons, cards, modals, form fields) with no shared abstraction — these are the primary migration candidates for the new shared library, since they have no dashboard equivalent to reconcile against.

**1.3 — Drift quantification.** Grep both apps for:
   - Raw hex codes in templates/TS (`#[0-9a-fA-F]{3,8}`)
   - Arbitrary Tailwind values (`\[#`, `\[\d+px\]`, etc.)
   - `.scss` files outside the documented "animations only" exception (rule 3 in [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md))
   
   This produces a concrete count — the baseline the Phase 6 guardrail will be measured against (target: zero after rollout, outside the token definition file itself).

**1.4 — Non-DOM color consumers.** Catalog every place color is read outside CSS — `libs/pinyes-render/src/lib/utils/figure-palette.util.ts` is the known one; confirm there are no others (e.g. inline Konva `fill`/`stroke` props elsewhere in `figure-canvas.component.ts`, `tronc-view.component.ts`).

**Deliverable:** a short findings note (can live at the top of `docs/DESIGN_SYSTEM.md` under a "Baseline" heading, or as an appendix here) — not a separate audit doc, to avoid another file to keep in sync.

---

## Phase 2 — Token architecture

The layer everything else is built on. This is where the user's visual identity actually gets encoded — this plan defines the *shape* of that encoding, not its values.

**2.1 — Token categories.**

| Category | Contents |
|---|---|
| Color | `primary`, `secondary`, `accent`, `neutral`, `base-100/200/300`, `base-content` (+ opacity steps already used, e.g. `/60`, `/40`), semantic `success`/`error`/`warning`/`info`, plus whatever the identity needs beyond DaisyUI's default set (e.g. dedicated focus-ring color, elevation-tinted surfaces) |
| Typography | Font family/families, weight scale, size scale, line-height scale — DaisyUI/Tailwind don't currently carry an opinion beyond "Inter 400–700" |
| Spacing | Confirm/extend Tailwind's default scale rather than reinvent it, unless the identity needs a distinct rhythm |
| Radius | Named scale (e.g. `sm`/`md`/`lg`/`full`) replacing DaisyUI's per-component defaults with one deliberate set |
| Shadow / elevation | A small named scale (e.g. `raised`/`overlay`/`modal`) instead of ad hoc `shadow-md` sprinkled per component |
| Motion | Duration and easing tokens (e.g. `fast`/`base`/`slow`, one easing curve) — currently undefined project-wide |
| Z-index | Only if audit (1.3) turns up ad hoc stacking values worth naming |
| Categorical (canvas) | The qualitative multi-hue set used to distinguish figures/nodes on the Konva canvas — currently hardcoded in `figure-palette.util.ts` — plus canvas-specific surface/shadow colors. Designed as part of the same identity, not a separate palette (see 2.3, 7.2) |

**2.1a — Color mechanism (resolved).** Color splits into a fixed source shared by every colla and a colla-dependent source, combined by one shared state-derivation rule.

*Fixed, from [Origami](https://ggprompts.com/styles/origami.html) — colors only, not that page's type/spacing/radius/shadow/motion (those are separate, still-open categories):*
- Surfaces (`base-100/200/300`): the paper scale — `#FAFAF8` / `#F5F2EC` / `#F8F6F0`, washi `#F0EBE1`/`#E5DFD3`
- Content (`base-content` + its opacity steps): the ink scale — `#1C1B18` → `#B8B4AE`, 5 steps
- Borders/dividers: the crease tones — `#D8D3C8` / `#B8B0A0` / `#8A8070`
- Semantic colors: mapped from Origami's 6 accent hues — `error`←red `#C23B3B`, `success`←green `#3B8C5A`, `warning`←gold `#C9A84C`, `info`←blue `#3B6FC2`. **Fixed and never remapped per colla** — see below. Purple and orange, plus four hues added beyond Origami's original set, become the Categorical (canvas) row's palette — resolved in §2.1i, including why reusing these hues in both places isn't a new confusability risk.

*Why semantic roles never shift per colla:* [CLAUDE.md](../../../CLAUDE.md) already names multi-tenancy as a near-term direction (`ADMIN (≡ TECHNICAL until multi-tenant exists)`) — an admin could plausibly move between collas in one session once that lands. If "error" were red on one colla's theme and orange on another's (e.g. reassigning it away from a colla whose own secondary happens to be red), that breaks a convention every user already carries in from every other app, and breaks it *per tenant*. Rejected in favor of fixing the semantic set and resolving any near-hue coexistence on the fixed side instead (next paragraph).

*Colla-dependent — same derivation shape for both, different fixed L/C target per role, so roles that happen to share a hue never share a value:*
- **Primary** (shirt color): `oklch(L_primary, C_primary, H_shirt)` — hue from the shirt color, lightness/chroma fixed project-wide. Used for buttons and other large interactive fills, so its L/C target favors legibility/contrast at that role.
- **Secondary** (sash color) — two branches:
  - **Real hue** (red, purple, yellow, orange-for-striped, or anything else a sash turns out to be): `oklch(L_secondary, C_secondary, H_sash)` — same mechanism as primary, but `L_secondary`/`C_secondary` are their *own* fixed target, distinct from both `L_primary`/`C_primary` and the fixed `error` token's L/C. Because the two roles have independent (L, C) targets, a full value collision is structurally impossible even when a colla's sash hue lands close to "red" — what remains is a tuning question (next paragraph), not a mechanism gap. Primary defense against confusion is structural either way: error only ever appears via icon + alert/toast/badge components; secondary only ever appears as the striped sash motif — different shapes, different positions, per WCAG 1.4.1 (never convey meaning by color alone).
  - **White or black**: no formula for the *base* — hand-authored presets, because achromatic input has no hue for the formula to consume. White → `paper-white`, dark hairline edge, ink-colored on-secondary content. Black → `ink-black`, light hairline edge, paper-colored on-secondary content.
  - The two-tone diagonal weave texture (every branch, including white/black) is **not** a second hand-picked swatch — it's the same `tone()` primitive described below, applied to whatever the base is. An L-shift doesn't care whether its input is chromatic, so white/black need no special case here. The mandatory hairline edge and the weave tone both hold at any strip thickness (thin or thick), so "thicker strip" doesn't need a different mechanism, just more of the same weave.

*One shared primitive for every "nearby but distinct tone of a base color" need — hover, active, focus, disabled, and the weave companion tone alike:* `tone(base, variant, mode)`, applying a small fixed L delta to any base OKLCH value, delta named by `variant` (`hover`/`active`/`focus`/`disabled`/`weave`), direction flipping between light/dark mode (darker-on-hover on a light surface, lighter-on-hover on a dark one). Applied uniformly to primary, every secondary variant (real-hue *and* white/black), and all four semantic colors — hover/active states for `success`/`error`/`warning`/`info` come from the same function, not separate design work, and the weave pair is just one more named variant of the same call, not a distinct concept. Tints/washes (e.g. a pale success background) use Tailwind's existing opacity-modifier syntax on the base token rather than a dedicated scale. A full multi-stop scale (Tailwind's 50–900 style) is explicitly *not* used here — colla hues are only known at theme-generation time, so hand-tuning a 9-step scale per unknown hue isn't practical, and base-plus-`tone()` covers every case above without it.

*Tuning the error/secondary-red gap:* since collision is structurally impossible (independent L/C targets) but a red-sashed colla could still end up with two reds that feel visually crowded, this gets checked empirically at implementation time — render a red-sash colla's computed secondary next to the fixed error token and see if the gap reads clearly. Origami's literal `#C23B3B` is a *starting point* for error, not a pixel-locked requirement — if the gap needs widening, shift error's hue slightly toward wine/crimson (more magenta-leaning) rather than the more orange-leaning red typical of vivid sports jerseys; still unambiguously "error red," now separated on hue as well as L/C for the one case that needs it.

Exact numeric L/C targets per role (`L_primary`/`C_primary`, `L_secondary`/`C_secondary`, each `tone()` delta) are implementation-time tuning, not decided in this planning doc — the decision locked here is the *shape* of the mechanism, that each role gets its own fixed target so roles never structurally collide, and that semantic roles never remap per colla.

**2.1b — Typography mechanism (resolved).** Two families, role-assigned, both self-hosted: **Fraunces** for display/section-level headings, **Quicksand** for everything else (UI chrome, body, labels, buttons, table cells, card/modal titles).

*Role assignment* — extended one level past the initial display+page-title-only proposal, per feedback that the narrower cut felt thin. The line is drawn at "genuine heading vs. UI-chrome-shaped element," not at a fixed Hn depth:

| Role | Was (DASHBOARD_UI.md) | Becomes |
|---|---|---|
| Display (hero moments — e.g. PWA login/home) | — (didn't exist) | Fraunces 600, tightest line-height |
| Page title | `text-2xl font-bold` | Fraunces 600, tight line-height |
| Section title (major in-page groupings) | — (didn't exist as a distinct role) | Fraunces 400/600, tight line-height |
| Card/modal title, table header | `text-base font-semibold` | Quicksand 600, normal line-height — stays sans deliberately: these repeat dozens of times per screen in this app, where a display serif would fight legibility rather than add character |
| Label | `text-xs text-base-content/50 font-medium` | Quicksand 500, normal line-height |
| Body/value | `text-sm` | Quicksand 400, normal line-height |
| Secondary text | `text-sm text-base-content/60` | Quicksand 400, reduced opacity |

*Weight scale.* Quicksand: 400 (body), 500 (labels/nav), 600 (emphasis/titles/buttons), 700 (rare strong emphasis). Fraunces: 400 and 600 static cuts (not the full variable range) for the roles above, plus 400/600 *italic* for the case below.

*Line-height.* Three named tokens: tight (display/headings), normal (UI/body), relaxed (long-form prose, if any turns out to exist).

*Italic handling (news module markdown) — confirmed against Google Fonts' CSS API directly, not assumed:* requesting both italic and roman styles for every Quicksand weight returns **only `font-style: normal` faces — Quicksand has no true italic anywhere in the family**. The same query against Fraunces returns real `font-style: italic` faces (400 and 600, distinct font files). A browser asked for italic Quicksand therefore falls back to synthetic/faux italic (algorithmic slant) by default.

Given italic use is rare in practice (per the user, outside markdown-rendered news body), the decision is to let the browser synthesize it rather than build something special for a low-frequency case — geometric rounded sans faces generally survive algorithmic slanting better than serifs do. Verify visually once real news content renders; this needs no extra step, it folds into Phase 7's existing real-browser-check requirement. **Held in reserve, not built now:** if synthetic italic looks bad in practice, render markdown `*emphasis*` in Fraunces italic instead of slanting Quicksand — a deliberate family-swap for emphasis, a legitimate editorial technique, not a hack.

*Loading strategy.* Both self-hosted (e.g. `@fontsource/quicksand` + `@fontsource/fraunces`), bundled rather than CDN-linked, loading only the weights listed above. The PWA's offline/service-worker requirements make a runtime Google Fonts CDN request a liability on first load, where a bundled font is covered by the app's existing asset caching for free.

*Deferred, not decided:* Quicksand's legibility at dense table-cell sizes (12–13px) — per explicit direction, kept flexible rather than resolved now; revisit once real screens exist rather than theorizing further.

**2.1c — Domain typography: name legibility (Atkinson Hyperlegible Next).** A third family, scoped narrowly: person names/aliases rendered on figure/tronc nodes need to stay readable from a distance — most acutely in the fullscreen projection view used during live performances, but the same node-label rendering also appears in the editor/assignment canvas. Confirmed available via the same Google Fonts API check used for the other two families: weights 400/500/600/700/800 exist.

*Scope — deliberately narrow, not "canvas text" broadly.* Grepping `figure-canvas.component.ts` for `fontFamily` turns up **18 hardcoded `'Inter, sans-serif'` occurrences** — the same file already flagged in the Phase 1 audit (§1.4) for hardcoded colors, now shown to hardcode font too, same root cause, same fix (the Phase 2.3 TS token bridge, since Konva can't read CSS). Not all 18 are person names, though — most render figure/template names in pickers, node-position badges, or help labels, which stay Quicksand like the rest of the app's UI text. The one that matters here is confirmed concretely: `displayText = formatAssignedLabel(assignment.person.alias, node.climbIndicator)`, fed into a `Konva.Text` a few lines later (~line 2363–2390) — the actual label shown on an assigned node. That call (and its counterparts in the canvas's other modes — assignment/segment-assignment/readonly render the same label pattern separately) is what switches to Atkinson Hyperlegible Next; everything else in that file stays Quicksand.

The same rule reaches outside Konva too: `tronc-view.component.ts` (CSS Grid-based tronc rendering, not canvas, per the module's own architecture) and `person-hover-card.component.ts` render `assignment.person.alias` via regular DOM/CSS — no token bridge needed there, just a normal `font-family` reference, but the same font and the same scoping rule (name labels only, not surrounding chrome).

*Weight.* The existing code already toggles `fontStyle: assignment ? 'bold' : 'normal'` at the exact call site found above — recommend mirroring that with 400 (unassigned/placeholder state) and 700 (assigned, the state that most needs distance legibility) rather than introducing new weight logic.

*Loading.* Same self-hosted approach as Quicksand/Fraunces (bundled, not CDN) — this rendering path is reachable from the PWA's offline-capable segment projection view (`SegmentProjectionComponent` → `<lib-pinya-projection>`), so it needs the same asset-caching guarantee the other two fonts already get.

**2.1d — Spacing (resolved).** Reuse, don't reinvent: Tailwind's default 4px-based scale stays as the base unit, unchanged — nothing in the identity defined so far (Origami colors, the three type families) implies a different rhythm, and it's already the documented mechanism (`docs/DASHBOARD_UI.md`'s "Tailwind per layout" rule).

*Spacing vs. sizing — kept separate.* Padding/margin/gap are fully covered by the existing scale; the discipline problem (arbitrary one-off values instead of scale steps) is what Phase 6's guardrail exists to catch, not a gap in the scale itself. Many of the Phase 1.3 "arbitrary Tailwind values" aren't spacing at all — `max-h-[45vh]`, `w-[280px]`, and similar are component *sizing* (widths/heights, viewport-relative dimensions), a related but distinct concern; most of those are legitimate per-component decisions that don't need a shared token.

*Two named-token opportunities, found directly in the Phase 1.3 audit data rather than invented:*
- `max-h-[45vh]` + `w-[280px]` co-occur at **three separate call sites across two files** (`composition-editor.component.html` twice, `distribucio-tab.component.html` once) — a real "compact picker/popover panel" sizing convention that currently exists as three independent copy-pasted magic numbers, not one shared definition. Named as a `panel-compact` sizing token so it's one definition instead of three that merely happen to agree today.
- The documented **24px minimum tap-target** rule (existing accessibility/responsive audit requirement, referenced in `docs/ROADMAP.md`) has no token today — it's enforced by memory/convention only. Formalized as a named minimum-size token so Phase 6's guardrail can check it structurally instead of relying on recall.

*Explicit exclusion.* Node `x`/`y`/`width`/`height` on the Konva canvas (`TRONC`/`BASE` in relative units, `PINYA` in pixels, per `CLAUDE.md`) is domain layout *data* — figure geometry, not design-system spacing, and out of scope here. The canvas's own UI chrome around it (`.canvas-wrapper`/`.zoom-selector` padding in `figure-canvas.component.scss`) is a normal consumer of this scale like any other component — the distinction matters so figure positions never get mistaken for a spacing concern.

**2.1e — Radius (resolved).** Direction: soft/rounded, confirmed.

*Mechanism — reuse DaisyUI's own radius theme keys, don't invent a parallel scale.* Confirmed directly against the installed package (`node_modules/daisyui`, v4.12.24, `src/theming/themeDefaults.js`), not assumed: DaisyUI already ships a small named radius scale as theme variables — `--rounded-box` (cards/modals/larger panels, stock default `1rem`), `--rounded-btn` (buttons/inputs/selects, stock default `0.5rem`), `--rounded-badge` (badges, stock default `1.9rem`), `--tab-radius` (tabs, stock default `0.5rem`). That's exactly the small named scale a "how rounded, and does it vary by component size" decision needs — no reason to add a parallel `sm`/`md`/`lg` system next to one that already exists. Confirmed via `generateCollaTheme` itself that none of these are touched today — it sets colors only — so this slots into the *same* theme object Phase 2.2 already extends, no new mechanism required.

`--rounded-badge`'s stock value is already effectively pill-shaped at typical badge heights — kept that way. A badge's whole visual identity is being a pill; that's not really a "how rounded" question the way box/btn/tab are.

*Why not just keep DaisyUI's stock numbers.* "Looks generic" is the entire complaint driving this project, and a correct *shape* choice (soft/rounded) still reads generic if the exact values are the ones every unmodified DaisyUI app ships with. Recommend picking our own values in the soft/rounded direction rather than silently inheriting the defaults above. Exact rem values are implementation-time tuning, same treatment as Color's L/C targets — the decision locked here is the direction and the reuse-DaisyUI's-4-slot mechanism, not final numbers.

*Canvas bridge — a third instance of the pattern already found for color (§2.1a/2.3) and font (§2.1c).* `figure-canvas.component.ts` hardcodes Konva `cornerRadius` at 7+ separate call sites (values `2`/`4`/`6`, one already named `readonlyCornerRadius`). Same fix: sourced from the Phase 2.3 TS token bridge rather than left as independent magic numbers.

**2.1f — Shadow / elevation (resolved).** Four named steps by role, not by size adjective: `flat` (resting content — no shadow, relies on `base-100`/`base-200` surface contrast alone, consistent with the surface pairing `docs/DASHBOARD_UI.md` already documents), `raised` (cards), `overlay` (dropdowns/popovers/hover cards), `modal` (dialogs — always the deepest).

*Mechanism.* Unlike radius, there's no DaisyUI theme slot to reuse here — confirmed against the installed package's `themeDefaults.js`, no shadow-related keys exist. Implemented instead as CSS custom properties (`--shadow-raised`, `--shadow-overlay`, `--shadow-modal`) alongside the rest of the token layer, each a real `box-shadow` value — optionally multi-layered (2–3 stacked shadows per step, for a more convincing sense of depth than one flat shadow gives) — exact composition is implementation-time tuning, same treatment as every other category's precise numbers.

*Color — warm, sourced from the fixed ink scale, no new hex.* `ink-black` (`#1C1B18`) — the darkest step from Color's fixed ink scale — used as an rgba tint (`rgba(28, 27, 24, alpha)`), alpha increasing per step (lightest for `raised`, heaviest for `modal`). It's genuinely warm already (28,27,24 is noticeably browner than a neutral `#1a1a1a`), so this gets the warm character for free. Referenced as a **literal fixed swatch, not the mode-flipping `base-content` token** — deliberately: `base-content` resolves to a *light* value in dark mode (for text contrast), which would turn "shadow" into "glow" if shadows were tied to it. Pinning to the literal ink-black value keeps the tint the same warm color in both modes.

*Dark-mode caveat — flagged now rather than discovered later.* A dark shadow is structurally weak against an already-dark background — not a color choice problem, just physics: you can't get visibly darker than dark. Shadow tokens alone won't carry elevation in dark mode the way they do in light mode. Standard fix (Material's dark theme does the same): pair each elevation step with a slightly *lighter* surface value in dark mode specifically — card a touch lighter than the page, overlay lighter still, modal lightest — so surface-lightening picks up the depth signal where shadow can't. Not fully specified here (downstream of the dark-mode surface values still open from §2.2), just noting the mechanism needs this pairing, shadow alone is insufficient.

**2.1g — Motion (resolved).** A small named duration scale plus one shared easing curve, replacing what's currently ad hoc per file.

*Current state, grounded.* No shared scale exists today — durations found across the codebase's `.scss` files cluster loosely around 0.08s/0.1s/0.12s/0.15s/0.2s/0.25s, each component picking its own number, mixing bare `ease`, `ease-out`, and unspecified defaults for easing. DaisyUI only offers two partial theme slots (`--animation-btn: 0.25s`, `--animation-input: .2s` — durations only, no easing-curve equivalent, so less complete a mechanism than Radius's four slots gave us). There's already good precedent worth keeping, though: `tailwind.config.js` has two deliberately *named* custom keyframe animations, `arrival-bounce` (400ms, the PWA own-position marker's arrival cue) and `restless` (900ms, infinite, the idle nudge hint) — a naming instinct that already exists, just not extended to ordinary transitions.

*Mechanism.* Named duration steps — `fast` (~100–150ms: hover/micro-interactions, matching the existing tight cluster), `base` (~200–250ms: panel expand/collapse, matching the existing looser cluster), `slow` (~350–400ms: bigger deliberate movements — `arrival-bounce` already lives here). Plus **one shared easing curve**, not several, replacing the current mix of bare `ease`/`ease-out`/unspecified — the same "one primitive, reused everywhere" instinct as Color's `tone()` function, giving the motion its own character instead of the browser default. DaisyUI's two existing duration slots get mapped onto this scale rather than left as independent stock values. Exact ms/curve numbers are implementation-time tuning, same treatment as every other category so far.

`restless` stays outside this scale deliberately — it's an ongoing ambient hint, not a response to a state change, a different job than the fast/base/slow set is solving.

*A real gap, not a style question.* Exactly one deliberate `prefers-reduced-motion` check exists anywhere in the codebase — a JS one, in `figure-canvas.component.ts`'s camera-fly animation (`flyToBounds`), done well: jumps straight to the destination, still fires the completion event, only the tween itself is skipped. But there's **zero CSS-level handling** despite 15+ scattered `transition:` declarations, and notably `restless` is an *infinite* loop — exactly the kind of motion accessibility guidance (vestibular-disorder safety) flags as needing to be stoppable, more so than a one-off transition. Part of this category's rollout, not an afterthought: a global rule collapsing all transition/animation durations — and explicitly stopping infinite iteration counts — under `prefers-reduced-motion: reduce`.

**2.1h — Z-index (resolved).** Phase 2.1's table made this conditional on the audit turning up real ad hoc stacking values — a dedicated sweep (broader than Phase 1.3's general drift pass) confirms it did, more thoroughly than first caught.

*What's actually there.* Three different mechanisms doing the same job, uncoordinated: **Tailwind's standard scale** in active use at five different levels (dashboard: `z-50` ×12, `z-10` ×11, `z-40` ×4, `z-20` ×3, `z-30` ×1; PWA: `z-50`, `z-10`); **arbitrary escape-hatch values** — `data-table.component.html`'s `z-[1]` ×3 (sticky headers), and `z-[9999]` appearing **three times, independently**, in dashboard's `toast.component.ts` and PWA's `splash-screen.component.ts`/`toast-container.component.ts` — all three meaning the same thing ("above literally everything else") as three separate magic numbers rather than one; and **raw CSS `z-index`** in `.scss` — `template-editor.component.scss` (10, 30), `figure-canvas.component.scss` (10, the canvas's own zoom-selector/label-editor chrome), `tronc-view.component.scss` (2). Seven-ish distinct numeric levels between three mechanisms, no shared meaning anywhere.

*Mechanism.* A small named scale by role, mapped onto what's already implicitly happening rather than invented from scratch: `raised` (sticky headers, in-canvas chrome — the `z-10`/`z-[1]` cluster), `dropdown` (popovers, tooltips, in-canvas panels — the `z-20`/`z-30` cluster), `chrome` (persistent app header/tab-nav — the `z-40` cluster), `modal` (dialogs — the `z-50` cluster), and a top-of-stack `system` level replacing all three independent `z-[9999]` copies with one shared definition — the same "same intent, multiple silent copies" pattern already found twice elsewhere in this plan (Spacing's `panel-compact` sizing pair, Typography's repeated `text-[10px]`).

**2.1i — Categorical (canvas), resolved.** Two variants, not one — `normal` and `light` — per direction: `normal` for higher-saturation indicator use (rengla markers), `light` for softer/ambient use (projection-mode figure shadows).

*Color set — 10 hues, same order convention as the current `figure-palette.util.ts`, values sourced from the fixed theme instead of generic Tailwind defaults.* First six reuse the exact fixed hues already locked in Color (§2.1a) for the semantic roles, in the specified order: red, green, blue, yellow(gold), purple, orange. Extended with four more for headroom, per direction: teal, pink, brown, and — filling the one genuinely empty span of the hue wheel the other nine leave uncovered, between yellow/gold (~50°) and green (~140°), rather than crowding an already-dense neighborhood (a fifth blue-green next to teal/blue, or a fifth red/pink next to purple/pink, would be harder to tell apart at small canvas-node sizes than a hue in open space) — **olive**, proposed as the tenth. Straightforward to swap if a different tenth hue reads better once it's actually on screen.

*Reusing red/green/blue/gold here isn't a new risk — it's the same defense already locked in for secondary/error (§2.1a), applied to a case that fits it even more cleanly.* Semantic colors only ever appear as icon-carrying alerts/toasts/badges in specific chrome positions; categorical colors only ever appear as canvas node fills, rengla indicators, or projection shadows — a completely different visual context, never in the same place at the same time. Same WCAG 1.4.1 shape/position argument, not a new one.

*Light variant — reuse, don't invent, continuing every other category's pattern.* For the six hues shared with the fixed semantic set, Origami already ships hand-tuned light companions for exactly these (confirmed from the original page fetch, not re-derived): `--ori-red-light` `#E8A0A0`, `--ori-green-light` `#A0D4B3`, `--ori-blue-light` `#A0BDE8`, `--ori-gold-light` `#E8D9A0`, `--ori-purple-light` `#C4B0DC`, `--ori-orange-light` `#E8C0A0` — used directly, zero new values needed. For the four hues outside Origami's original set (teal/pink/brown/olive), no pre-authored light companion exists, so these are derived via the same `tone()` primitive already established in §2.1a/§2.1b (one more named variant alongside `hover`/`active`/`focus`/`disabled`/`weave`) rather than a second, disconnected mechanism for "give me a related lighter tone."

*Usage, as directed.* `normal` for rengla indicators (compact, higher-contrast markers). `light` for projection-mode figure shadows — this generalizes what `SINGLE_FIGURE_SHADOW_COLOR` (§1.4/§2.3) was already doing ad hoc with one hardcoded gray regardless of which figure it belonged to: now one light tone per figure's own assigned categorical color, distinguishable figure-to-figure even in shadow form.

**2.2 — Light/dark mechanism.** DaisyUI's `data-theme` attribute already drives runtime theme switching (`document.documentElement.setAttribute('data-theme', ...)`, per [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md)'s "Theming per Colla" section). Extend `generateCollaTheme` (or replace it with a richer generator) to emit **two** theme blocks per identity — e.g. `<name>-light` / `<name>-dark` — sharing token *names*, differing in *values*. Every component built downstream references the name, never a literal value, so the light/dark swap is free.

*Dark-mode elevation ladder (resolved) — closing a gap left open in §2.1f.* Elevation has four named steps (`flat`/`raised`/`overlay`/`modal`) but the surface scale only has three (`base-100/200/300`), so they can't map 1:1. Resolution: `modal` doesn't need its own surface step — it's always paired with a dimmed backdrop (the near-universal modal pattern), and that backdrop plus the heaviest shadow already carries the "blocking everything else" signal without a fourth distinct lightness. `base-100/200/300` (3 steps, progressively lighter in dark mode) covers `flat`/`raised`/`overlay`'s progression; `modal` rides on `overlay`'s surface plus its own backdrop+shadow, no new token needed.

*Colla-dependent primary/secondary in dark mode (resolved).* One L/C target for both modes, not a separate dark-specific one — consistent with every other exact number in this plan being deferred to implementation-time tuning rather than speculatively building for a problem that might not occur. A colla's computed hue *might* read less legibly on a dark background (a real, known dark-mode color issue), but the fix is to check it in Phase 7's real-browser pass and adjust only if it actually shows up, not to pre-build a second target now.

**2.3 — Reaching non-DOM consumers (the canvas).** CSS custom properties don't reach Konva. **Decided: (a)** — a hand-maintained TS constants module (`libs/ui/src/tokens.ts`) as the single source of truth, with the Tailwind/DaisyUI theme generator *consuming* it (TS → CSS), so there's exactly one place values are typed in, not two that can drift apart — over **(b)**, reading `getComputedStyle(document.documentElement).getPropertyValue('--token-name')` at runtime inside `libs/pinyes-render` setup code. (a) is drift-proof by construction rather than by discipline, and Nx/TS tooling makes "CSS generated from TS" straightforward. Formally closing this out here — every category resolved since (§2.1c, §2.1e, §2.1i) already wrote as though (a) were settled, so this removes a phantom open item rather than leaving it dangling.

   This bridge is what makes the canvas *authorable*, not just technically reachable. Per the full audit (Phase 1, §1.4), it needs to cover four distinct groups currently hardcoded in `figure-canvas.component.ts` and neighbors, not just the palette file:
   - `figure-palette.util.ts`'s qualitative figure-distinguishing set (10 hues), `SINGLE_FIGURE_PANEL_COLOR`, `SINGLE_FIGURE_SHADOW_COLOR` — redefined as part of the token module, chosen to cohere with the identity rather than ten arbitrary Tailwind defaults.
   - `NODE_COLORS` (zone → color mapping) — domain-driven, but sourced from the token set's values, not independent literals.
   - UI-state strokes (`SELECTED_STROKE`, `NORMAL_STROKE`, `CONFLICT_STROKE`, the inline highlighted-state green) — mapped to the same selection/focus/warning/error tokens used everywhere else, not canvas-only constants.
   - `ATTENDANCE_COLORS` — rebuilt to read the *same* `success`/`warning`/`error` token values DaisyUI already generates via 2.3(a), rather than a second literal definition that only coincidentally matches today.
   
   `figure-canvas.component.scss` (DOM chrome around the canvas, not Konva draw calls) needs no bridge at all — it's plain CSS and can reference tokens directly, the same as any other component stylesheet. It already does this *partially* (`oklch(var(--p))` on focus) while hardcoding hex two lines away for hover — the clearest evidence in the whole audit that a token layer without Phase 6's guardrail doesn't self-enforce.

**2.4 — Naming convention (resolved).** Two concrete decisions, now that every category exists to name:

*TS↔CSS mapping.* `libs/ui/src/tokens.ts` uses camelCase (`shadowRaised`), generated CSS custom properties use kebab-case (`--shadow-raised`) — a mechanical, uniform conversion applied everywhere, not a per-file judgment call.

*Prefixing.* New tokens this plan introduced beyond DaisyUI's own vocabulary (the shadow scale, motion durations/easing, z-index roles, the categorical palette, sizing tokens like `panel-compact` and the tap-target minimum) get a shared namespace prefix — `--ds-*` — distinguishing them from DaisyUI's native variables. DaisyUI-native slots this plan is just repurposing (`--rounded-box`, `--rounded-btn`, `base-100`, `primary`, etc.) keep their existing bare names, unprefixed — renaming those would break DaisyUI's own component CSS, which already expects them as-is. The prefix also gives Phase 6's guardrail script an easy, greppable pattern for "was this actually added to the system, or hardcoded."

**Deliverable:** the token set implemented as the new theme generator + (if 2.3a) `libs/ui/src/tokens.ts`, validated by rendering a handful of raw HTML swatches — no app integration yet.

---

## Phase 3 — Shared UI library

**3.1 — New Nx library.** Create `libs/ui` (name decided), mirroring how `libs/pinyes-render` is already shared between `apps/dashboard` and `apps/pwa` via `@muixer/pinyes-render`. Import path: `@muixer/ui`. Add the same Nx module-boundary tag pattern used for `pinyes-render` so `dashboard`/`pwa` can depend on `ui` but not on each other.

**3.2 — Migration order, not big-bang.** Driven by the Phase 1 audit:
   1. Primitives neither app currently shares as a library: button, badge, input, modal, toast, card shell.
   2. Dashboard's existing `shared/components/data|feedback|forms|layout` — ported into `libs/ui` one component at a time, dashboard re-points its imports, behavior unchanged (this is a relocation + restyle, not a rewrite of logic).
   3. PWA's currently hand-rolled per-feature UI — replaced with `libs/ui` equivalents as each is ported.

**3.3 — Component conventions.** Standalone + `OnPush` + Signals (`input()`/`output()`), per [CLAUDE.md](../../../CLAUDE.md)'s existing Angular rules — no change to those, just a new home. Every component styled exclusively through tokens/DaisyUI classes — no component-local hex, no component-local one-off spacing.

**Deliverable:** `libs/ui` exists, builds, is imported by both apps for at least the first primitive batch (3.2.1).

---

## Phase 4 — Documentation

**4.1 — `docs/DESIGN_SYSTEM.md`** becomes the canonical source of truth. Structure:
   - Principles (what the identity is going for, in prose — filled in once the user's identity is defined)
   - Token reference tables: color, typography, spacing, radius, shadow, motion (values + usage guidance, mirroring the table style already used in [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md)'s "Paleta de Colors" section)
   - Component inventory with links to the Phase 5 live reference
   - Usage rules (do/don't), in the same terse rule-list style as [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md)'s "Regles d'Estil"
   - Theming/dark-mode instructions (supersedes "Theming per Colla")
   - Accessibility notes (contrast minimums the token values must satisfy)

**4.2 — `docs/DASHBOARD_UI.md`** narrows to dashboard-*specific* content only (layout shell, routing table, page composition patterns) and drops the now-duplicated "Paleta de Colors"/"Tipografia" sections in favor of a link to `DESIGN_SYSTEM.md`.

**4.3 — PWA UI doc.** The PWA currently has no equivalent to `DASHBOARD_UI.md`. Open question below: whether it gets its own thin layout/routing doc mirroring the dashboard's, once it has enough shared-library-driven structure to document.

**4.4 — Map maintenance.** Per [CLAUDE.md](../../../CLAUDE.md)'s documentation rules: add `docs/DESIGN_SYSTEM.md` to [docs/MAP.md](../../MAP.md)'s table and mermaid graph, give it frontmatter `tags: [domini]` (or `qa`, matching `DASHBOARD_UI.md`'s precedent) and a `Veïns:` footer, then run `pnpm run docs:map`.

---

## Phase 5 — Living style guide

A doc can go stale silently; a rendered page can't lie about whether a component actually looks like its spec.

**5.1 — Route.** A dedicated route (e.g. `/design-system`) inside the dashboard app — it already has more chrome/screen real estate and tab navigation to host it. Behind the existing `authGuard` + `rolesGuard(TECHNICAL, ADMIN)` (no need for a public route; this is an internal tool).

**5.2 — Contents.** Renders, with real (not placeholder) content:
   - Every color token as a swatch, with a light/dark toggle
   - Type scale samples at each defined size/weight
   - Spacing/radius/shadow/motion samples
   - Every `libs/ui` component, every documented variant and state (default/hover/focus/disabled/error)

**5.3 — Why not Storybook (for now) — resolved.** Given the existing Nx/Angular setup and that both consuming apps already exist, an in-app route is faster to stand up and keeps the reference inside the same auth/theme context it's describing. Decided: no Storybook for this rollout. Not ruled out permanently — it remains an option later if isolated component development turns out to need it — but not part of this plan.

**5.4 — PWA visibility.** Since components are physically the same (`libs/ui`), the dashboard route is sufficient as the canonical viewer — no need to duplicate the route in the PWA.

---

## Phase 6 — Guardrails against drift

Documentation and a style guide describe the system; guardrails keep code from disagreeing with it.

**6.1 — Static check script.** A CI-run script (same spirit as `pnpm run lint:dead` / knip) that fails the build on:
   - Raw hex codes outside the token definition file(s)
   - Tailwind arbitrary-value syntax (`bg-[...]`, `text-[...]`, etc.) outside justified exceptions
   
   This directly extends the existing documented rule "Mai classes Tailwind dinàmiques" in [docs/DASHBOARD_UI.md](../../DASHBOARD_UI.md) — same category of rule, now checked instead of trusted.

**6.2 — CLAUDE.md update.** Add a "Design system" line to the Frontend dashboard / PWA sections of [CLAUDE.md](../../../CLAUDE.md) pointing at `libs/ui` + `docs/DESIGN_SYSTEM.md`, so any future agent session (including future me) is structurally pointed at the shared library instead of free-handing new UI.

**6.3 — Visual regression net.** The existing Playwright audit suite ([docs/AUDIT_SUITE.md](../../AUDIT_SUITE.md)) is the natural home for snapshot tests against the Phase 5 style-guide route — catches accidental token/component changes going forward. Scope/depth of this is an implementation-time decision, not blocking the plan.

---

## Phase 7 — Rollout

Matches the "foundation first, then both apps" sequencing already agreed:

**7.1 — Sub-phase A: Foundation.** Phases 2–6 above, validated end-to-end against 2–3 representative screens picked from *both* apps (e.g. login, home, one list page) — not a full app migration yet, just proof the pipeline (token → component → doc → style guide → guardrail) works. Real browser check required before calling this done, per [CLAUDE.md](../../../CLAUDE.md)'s UI-change testing rule.

**7.2 — Sub-phase B: Dashboard rollout.** Page-by-page, roughly in ascending complexity: `home` → `persons`/`rehearsals`/`performances` lists → detail pages → `config` → `pinyes` module last (most complex). The `pinyes` step explicitly includes restyling the Konva canvas itself (`libs/pinyes-render`) per 2.3 — not just the surrounding chrome — since it's shared with the PWA's read-only projection view, getting it right here also covers 7.3. Each increment gets a real browser check before merge.

**7.3 — Sub-phase C: PWA rollout.** Same pattern; smaller surface (`login`, `home`, `events`, `events/:id`, segment projection, `profile`) so likely faster once the library exists.

**7.4 — Close-out per sub-phase.** Update `docs/MAP.md`/`docs/DATA_MODEL.md` if entities touched (unlikely here), update `docs/DEBT.md` for anything intentionally deferred (e.g. "PWA UI doc not yet written"), remove any now-obsolete rows.

---

## Open questions (need the user's input, not assumed)

1. **DaisyUI's role** — stays as the component foundation (tokens layer on top), or does the visual identity need custom components DaisyUI can't express, requiring more components built from scratch on plain Tailwind? *(Phase 3 concern — not needed to implement Phase 2.)*
2. **PWA UI doc (4.3)** — worth creating once PWA has enough shared-library structure, or is `DESIGN_SYSTEM.md` + `DASHBOARD_UI.md`'s trimmed-down layout content enough? *(Phase 4 concern — not needed to implement Phase 2.)*
3. **CI enforcement strictness (6.1)** — hard-fail the build, or warn-only initially given the size of the existing drift found in Phase 1? *(Phase 6 concern — not needed to implement Phase 2.)*

Resolved: **library name** is `libs/ui` (§3.1); **Storybook** is not part of this rollout (§5.3).

## Success criteria

- Every color/type/spacing/radius/shadow/motion value in both apps traces to a named token — zero raw hex/arbitrary values outside the token definition file (Phase 1's baseline count reaches zero).
- `libs/ui` is the single implementation of shared primitives; PWA and dashboard visibly consume the same components.
- Light and dark are both fully implemented, token-driven, and switchable at runtime with no missing/mismatched values.
- `docs/DESIGN_SYSTEM.md` exists, is linked from `docs/MAP.md`, and the `/design-system` route matches it exactly (nothing documented that isn't live, nothing live that isn't documented).
- The Phase 6 static check runs in CI and passes.
- The Konva canvas (`libs/pinyes-render`) draws its palette, surfaces, and node styling from the same token system as the rest of the app — no separate hardcoded set in `figure-palette.util.ts`.

---

## Appendix — Phase 1 Audit Findings

*Filled in as each audit step (1.1–1.4) completes.*

### 1.1 — Dashboard shared components vs. `docs/DASHBOARD_UI.md`

`apps/dashboard/src/app/shared/components/` has **19** components; the doc's "Components Compartits" table lists **11**. Eight exist in code but aren't documented:

| Component | Category | Notes |
|---|---|---|
| `color-picker` | Forms | Added 2026-08-12 (template editor tablet UX work) — undocumented |
| `header` | Layout | Shell chrome — the doc's Layout *diagram* mentions "Header" but the component table has no Layout section at all |
| `tab-nav` | Layout | Same — described in prose (icon+text/icon-only/hamburger), not in the table |
| `user-chip` | Layout | Same |
| `node-actions` | Controls | New category — undocumented entirely |
| `node-dpad` | Controls | Same |
| `privacy-consent-modal` | (top-level) | Not under `data/feedback/forms/layout` — its own top-level folder |
| `tutorial-modal` | (top-level) | Same |

**Implication for the plan:** the doc's category scheme (Data/Feedback/Forms) doesn't cover what's actually in the tree — Layout and Controls are real, established categories missing from the table, and two components (`privacy-consent-modal`, `tutorial-modal`) don't fit any category, which is itself a signal `libs/ui`'s taxonomy (Phase 3) needs a clearer top-level structure than the dashboard grew organically.

**Style-rule compliance:** only one `.scss` file exists in the whole tree — `controls/node-dpad/node-dpad.component.scss` (80 lines, contains a transition/keyframe) — consistent with the documented "no `.scss` except animations" rule. No violations found here.

### 1.2 — PWA component landscape

The PWA has its own `shared/components/` (11 components) — but it's a **near-total fork**, not an extension, of the dashboard's. Comparing component names across both apps' `shared/components/` trees:

- **Shared name:** only `empty-state` — and the two implementations have already diverged (dashboard wraps content in a `card`, PWA doesn't; dashboard's icon input is a string name, PWA's is a `LucideIconData` object with a hardcoded `Calendar` default; the output event is named `actionClick` in one and `action` in the other). Same component, reinvented twice, already API-incompatible.
- **Conceptual duplicates under different names:** `privacy-consent-modal` (dashboard, 87 lines) vs. `consent-modal` (PWA, 87 lines) — same line count, independently built; `toast` + `toast.service.ts` (dashboard) vs. `toast-container` + a separate `toast.service.ts` under `shared/services/` (PWA) — two parallel toast systems.
- **PWA-only, no dashboard equivalent:** `bottom-tab-bar`, `mobile-header`, `no-person-banner`, `person-data-fields`, `person-switcher`, `pill-badge`, `pull-to-refresh`, `skeleton-card`, `splash-screen`.
- **Dashboard-only, no PWA equivalent:** all 18 others from 1.1 (data-table, filter-bar, pagination, etc. — mostly because the PWA has no admin-style list views).

**Hand-rolled patterns with no shared abstraction, either side:**
- Dashboard: 75 inline `class="badge ..."` usages across the app, with **no shared badge component** — every call site repeats DaisyUI's badge modifier classes directly. (Ironically the PWA *does* abstract this, as `pill-badge` — one more app-only reinvention, just in the other direction.)
- PWA: 9 features independently repeat `class="card bg-base-100 shadow-*"` as the card shell (`auth/login`, `auth/activate`, `auth/forgot-password`, `home`, `profile/settings`, …) instead of a shared card primitive.

**Implication for the plan:** this is stronger evidence than expected for Phase 3 — it's not "PWA has nothing, dashboard has everything," it's two independently-evolving component sets with real, silent API drift on the one component they do share. `libs/ui`'s migration order (3.2) should treat `empty-state`, the two modals, and the two toast systems as priority reconciliation targets, not just ports — their behavior needs to be diffed and unified, not copy-pasted.

### 1.3 — Drift quantification

Counts below exclude `.spec.ts` files (test fixtures, not rendered UI) and exclude `libs/pinyes-render` (covered separately in 1.4, since it's a distinct, already-known case).

**Raw hex codes** (`#rgb`/`#rrggbb`/`#rrggbbaa` literals in `.ts`/`.html`):

| | Occurrences | Files |
|---|---|---|
| Dashboard | 61 | 20 |
| PWA | 4 | 2 |

These split into two real categories, not one:
- **Untokened fallback/decoration values** — e.g. `rengla-overlay.component.html`'s SVG `stroke="#6366f1"`/`fill="#6366f1"` (a pure UI highlight color, no domain meaning), `template-editor.component.html`'s legend swatch `background-color: #EEEEEE; border: 1px dashed #a1a1a1`, and fallback defaults like `[style.background-color]="pos.color ?? '#888'"` / `'#e5e7eb'` / `'#ccc'` scattered across `attendance-edit-modal`, `person-detail`, `template-editor`. These are exactly what token references replace.
- **Domain-color seams** — `tag-form-modal.component.ts`'s `DEFAULT_COLOR = '#6366f1'` and preset seed `'#64748b'`, and `pinyes/utils/node-color-presets.util.ts`. Tags and figure-node presets are user-assignable colors (legitimate domain data, not decoration) — but their *default/seed* values and the color-picker swatches presenting them should still be defined once, from the token set, not hardcoded independently of it. Same category as the canvas's categorical palette (1.4) — a "curated set of distinguishable colors" concern that belongs in the token layer per Phase 2.1's new Categorical row, not per-component.

**Arbitrary-value Tailwind classes** (`bg-[...]`, `w-[...]`, `text-[10px]`, `z-[9999]`, etc.) — a different, narrower drift signal than the documented "no dynamic classes" rule (that rule targets runtime-interpolated class strings; these are static but bypass the design system's scale entirely):

| | Occurrences | Files |
|---|---|---|
| Dashboard | 33 | 17 |
| PWA | 6 | 6 |

Mostly one-off pixel/viewport sizes that should resolve to spacing-scale tokens once one exists (`max-h-[45vh]`, `w-[280px]`, `min-w-[10rem]`, `text-[10px]` appearing identically in 4 separate files as a de facto "extra-small text" size nobody named), plus two `z-[9999]` values (dashboard's `toast.component.ts`, PWA's `toast-container.component.ts`/`splash-screen.component.ts`) that are exactly the kind of thing a named z-index scale (Phase 2.1) exists to fix.

**Stray `.scss`** beyond the two expected app-root stylesheets (`styles.scss`, `app.scss`):

| | Files | Notes |
|---|---|---|
| Dashboard | 2 | `template-editor.component.scss` (332 lines, legitimately animation-heavy — complies with the documented exception) and `template-list.component.scss` (5 lines, a single `&:hover { opacity: 1 }` rule — **not** animation, and directly expressible as Tailwind's `group`/`group-hover:opacity-100` utilities; this one shouldn't exist) |
| PWA | 6 | `delegations-modal`, `profile`, `settings`, `mobile-header`, `person-switcher`, `pill-badge` — **all 6 are empty (0 bytes)** but still wired via `styleUrl` in their component, directly contradicting the documented rule "Ometre `styleUrls` si no cal" |

**Implication for the plan:** the PWA's 6 dead `styleUrl` references are a trivial cleanup, worth doing during Phase 3 migration regardless of the design system work. The two Tailwind-drift categories (arbitrary values, untokened hex) are precisely what Phase 6's static check (6.1) is designed to catch — these counts are the "baseline" that check should validate against zero once Phases 2–3 land, per the plan's success criteria.

### 1.4 — Non-DOM color consumers (the Konva canvas)

**This finding revises Phase 2.3's framing.** The plan (and the Problem section above) named `figure-palette.util.ts` as *the* hardcoded canvas palette. It's actually a small fraction of it — a full sweep of `libs/pinyes-render/src` for hex literals (excluding specs) finds **98**, distributed like this:

| File | Count | What it is |
|---|---|---|
| `figure-canvas.component.ts` | 64 | Konva draw calls — the actual canvas rendering |
| `figure-palette.util.ts` | 12 | The documented qualitative figure-distinguishing palette |
| `figure-canvas.component.scss` | 8 | DOM chrome around the canvas (wrapper, zoom selector, label editor, fit button) |
| `tronc-view.component.ts`/`.scss`, `own-position-marker.component.html`, `person-hover-card.component.ts` | 14 | Scattered UI-state colors in the surrounding rendering components |

**`figure-canvas.component.ts`'s 64 values break into distinct semantic groups, all currently module-level `const` hex strings**, e.g.:

```ts
const GRID_COLOR = '#e5e7eb';
const NODE_COLORS: Record<string, string> = {
  [FigureZone.BASE]: '#EEEEEE',
  [FigureZone.PINYA]: '#3b82f6',
  [FigureZone.TRONC]: '#8b5cf6',
  [FigureZone.FIGURE_DIRECTION]: '#d97706',
  [FigureZone.XICALLA_DIRECTION]: '#db2777',
  [FigureZone.DECORATION]: '#999999',
};
const SELECTED_STROKE = '#f59e0b';
const NORMAL_STROKE = '#1e1b4b';
const CONFLICT_STROKE = '#e11d48';
// ...and inline, further down, per-render:
const ATTENDANCE_COLORS: Record<string, string> = {
  ANIRE: past ? '#f59e0b' : '#22c55e',
  ASSISTIT: '#22c55e',
  PENDENT: past ? '#ef4444' : '#f59e0b',
  NO_VAIG: '#ef4444',
};
```

Four groups, each a different design-system concern:
1. **Zone/domain colors** (`NODE_COLORS`) — which figure-node type gets which color. Genuinely domain-driven, but still needs *values* from the identity, the same way `node-color-presets.util.ts` (1.3) does.
2. **UI-state strokes** (`SELECTED_STROKE`, `NORMAL_STROKE`, `CONFLICT_STROKE`, plus an inline `'#10b981'` for highlighted state) — these are exactly what semantic tokens (selection/focus/warning/error) are for.
3. **Status colors reinventing existing tokens** (`ATTENDANCE_COLORS`) — `#22c55e`/`#f59e0b`/`#ef4444` are Tailwind's green-500/amber-500/red-500, i.e. functionally DaisyUI's `success`/`warning`/`error` **redefined from scratch in Konva-land**, independent of and only coincidentally matching the actual `success`/`warning`/`error` tokens already generated by `generateCollaTheme()` a few files away.
4. **Generic chrome** (white/black/gray fills and text) — ordinary surface/content colors, no different from any DOM `base-100`/`base-content` usage.

**The DOM-reachable `.scss` file is a microcosm of the whole plan.** `figure-canvas.component.scss` already *partially* uses DaisyUI's primary token (`border-color: oklch(var(--p))`, `box-shadow: 0 0 0 2px oklch(var(--p) / 0.2)` on `:focus`) sitting right next to fully hardcoded hex two lines away (`background-color: #f8fafc`, `border: 1px solid #e5e7eb`) for the same component's `:hover` state. Token adoption exists here in the one place it's technically trivial (plain CSS) and is still inconsistent — strong evidence that without Phase 6's guardrail, a token layer alone doesn't self-enforce.

**Implication for the plan:** Phase 2.3's TS-token-bridge module needs to cover meaningfully more ground than implied — not just "the palette," but zone colors, UI-state strokes, and status colors currently duplicating DaisyUI semantics independently. Recommend `ATTENDANCE_COLORS` be rebuilt to reference the *same* success/warning/error token values DaisyUI already generates (via the 2.3(a) bridge) rather than its own literals — one definition of "what error looks like," not two that happen to currently agree.

---

*Veïns: [[DASHBOARD_UI]] · [[MAP]] · [[DEBT]]*
