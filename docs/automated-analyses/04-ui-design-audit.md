# MuixerApp — UI Design & Interaction Audit

> Design-focused audit of `apps/dashboard` and `apps/pwa`: visual language, color and typography systems, UI antipatterns, visual and behavioral inconsistencies, and configurability of the appearance layer. This report deliberately does **not** repeat findings from `02-frontend-audit.md` or `03-pwa-frontend-audit.md` (bugs, error handling, a11y contract issues, language/copy) — it covers what those reports did not: how the app *looks and feels*, and how coherently. Date: 2026-07-12 · Branch: `feat/pwa-app-start` · Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🔵 Suggestion.
>
> **Contrast methodology:** all contrast figures are **APCA Lc values** (APCA-W3 0.0.98G-4g), computed for this audit — not WCAG 2.x ratios, which mis-rank several of this theme's pairs (see UI-COLOR-1). Reference thresholds: Lc ≥ 90 preferred body text · **Lc ≥ 75 minimum for small text** (badges, table cells, ≤ 16 px) · **Lc ≥ 60 minimum for large/bold text and UI labels** (buttons) · Lc ≥ 45 large headlines only · Lc ≥ 30 absolute floor (placeholder/disabled) · Lc ≥ 15 non-text elements. Sign indicates polarity (negative = light text on dark background); magnitude is what matters.

## Index

1. [Executive summary](#0-executive-summary)
2. [Color system](#1-color-system) — `UI-COLOR-N`
3. [Typography](#2-typography) — `UI-TYPE-N`
4. [Iconography](#3-iconography) — `UI-ICON-N`
5. [Component & visual consistency](#4-component--visual-consistency) — `UI-CONS-N`
6. [Interaction & motion](#5-interaction--motion) — `UI-INT-N`
7. [Cross-app coherence (dashboard ↔ PWA)](#6-cross-app-coherence) — `UI-XAPP-N`
8. [Theming & configurability](#7-theming--configurability) — `UI-CONF-N`
9. [Fix-first ranking](#8-fix-first-ranking)

---

## 0. Executive summary

There is real design competence in this codebase — more than "not UI designers" suggests. The strengths are concrete: a single shared theme generated from one brand hex, a curated Lucide domain-icon vocabulary with doc comments, genuinely consistent card/button recipes wherever a shared component exists, skeleton loading and `active:` press feedback in the PWA, and hand-tuned `:focus-visible` work in the tronc view. The problems are not sloppiness; they are the predictable gaps of a system nobody was assigned to own. They cluster into four themes:

1. **The feedback palette fails at both of its jobs.** Physically: measured with APCA, `success`/`warning`/`error`/`info` cannot carry their own text (success bottoms out at Lc −49 where button labels need ≥ 60 and badges ≥ 75 — UI-COLOR-1), and the ubiquitous muted-text recipe puts the *lowest* contrast on the *smallest* text (UI-TYPE-4). Semantically: the same tokens have been repurposed as an action palette — amber means "sync", green means "submit", blue means "tronc" — so color has stopped meaning anything reliable (UI-COLOR-2). Both halves are fixed in the same place: a darker status palette in `generateCollaTheme` plus one shared status→color/icon map.
2. **The theme system stops at the CSS boundary.** The Konva canvases (the flagship feature) hardcode ~80 hex values in a private dialect that collides with the app's own semantics — selection is warning-amber, figure identity recycles error/success/info hues, one stray Material-grey palette (UI-COLOR-5). And the generator's unreviewed hue math produces an accent nobody uses and a secondary that reads as "disabled" (UI-COLOR-3/4).
3. **Conventions live in components, not in tokens — so everything without a component drifted.** Heading sizes (four different page-title sizes — UI-TYPE-3), elevation/radius/badge sizing (UI-CONS-1), content width ("infinite" on most pages, constrained on three — UI-CONS-3), loading (spinners vs skeletons — UI-CONS-2), motion (no durations, no reduced-motion — UI-INT-3).
4. **The two apps are drifting into two dialects.** Different typefaces (UI-TYPE-1), different loading and press-feedback philosophies, twin-but-diverging shared components — and no `libs/ui` where a convention *could* live once (UI-XAPP-2). Dark mode — arguably the single most user-visible gap for a members' app used at night — is explicitly switched off (UI-CONF-2).

**Findings by section:**

| Section | Code | 🔴 | 🟠 | 🟡 | 🔵 | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Color system | `UI-COLOR` | — | 3 | 2 | — | 5 |
| Typography | `UI-TYPE` | — | 3 | 1 | 1 | 5 |
| Iconography | `UI-ICON` | — | — | 2 | 1 | 3 |
| Component & visual consistency | `UI-CONS` | — | — | 3 | 1 | 4 |
| Interaction & motion | `UI-INT` | — | — | 3 | 1 | 4 |
| Cross-app coherence | `UI-XAPP` | — | — | 2 | — | 2 |
| Theming & configurability | `UI-CONF` | — | 1 | 1 | — | 2 |
| **Total** | | **—** | **7** | **14** | **4** | **25** |

---

## 1. Color system

### 🟠 UI-COLOR-1 — The status palette is too light to carry its own text (APCA)

`tailwind.config.js:103-110` hardcodes the four status colors at Tailwind's 500 weight. Measured with APCA against their `-content` colors:

| Token | Pair | Lc | Verdict |
| --- | --- | --- | --- |
| `success` | white on `#22c55e` | **−49** | ❌ fails even the large-text floor (60); unusable for button/badge labels |
| `warning` | `#1e293b` on `#f59e0b` | **58** | ❌ just under the large-text floor |
| `error` | white on `#ef4444` | **−69** | ⚠️ passes for bold button labels, fails small text (badges at 12 px need ≥ 75) |
| `info` | white on `#3b82f6` | **−69** | ⚠️ same |
| `primary` | white on `#1E3A8A` | −98 | ✅ excellent |
| `neutral` / `base-content` | | −104 / 95–101 | ✅ excellent |

Also as *foreground* on white (`text-success`, `text-warning` used for inline status text, ✓/? markers, sync results): `text-success` Lc 44 and `text-warning` Lc 42 are below every text threshold — the green "Sincronització completada ✓" and the amber "?" pending markers are genuinely hard to read.

The brand colors are fine; the entire *feedback* layer is undercooked. Fixes measured: `success` → green-600 `#16a34a` (Lc −65) or green-700 `#15803d` (Lc −80); `error` → red-600 `#dc2626` (Lc −77); `info` → blue-600 `#2563eb` (Lc −80); `warning` → amber-400 `#fbbf24` with **black** content (Lc 75). One line each in `generateCollaTheme`, and both apps inherit the fix.

### 🟠 UI-COLOR-2 — Semantic tokens used as an *action* palette: warning means "sync", success means "submit"

The status tokens have drifted from feedback roles into arbitrary action identities — the core semantic-color antipattern:

- **`btn-warning` = the sync button.** Home (`home.component.html:163`), person list (`person-list.component.html:13`), event list (`event-list.component.html:15`), segment manager (`:550`) all paint routine sync/navigation actions amber. Meanwhile *actual* warnings ("Esta acció no es pot desfer", `alert-warning`) use the same color. The user is taught two contradictory meanings of amber, and the day a sync action *does* need a caution state there is no color left to say it with.
- **`btn-success` = primary CTA.** "Enllaça" (`person-link-user-modal.component.html:67`), "Envia invitació" (`person-invitation-modal.component.html:39`), confirming a segment rename (`segment-manager.component.html:159`), post-sync "go back" buttons — all green. Success is a *state you report*, not a verb you offer; affirmative CTAs belong to `primary`. The current pattern also puts the most-clicked buttons in the app on the palette's worst contrast pair (Lc −49, UI-COLOR-1).
- **`badge-info` = the "Tronc" category label** (repeated across segment manager and pickers). Zone taxonomy is not "information"; it also collides with the canvas zone color for PINYA which is the *same* blue `#3b82f6` (see UI-COLOR-5) — so blue means "informational message", "tronc category badge", and "pinya zone node" in three different places.
- **Attendance color grammar shifts with tense.** In `attendance-edit-modal.component.ts:69-72`, ANIRE is green for future events but **amber for past ones**; in the canvas dot map (`figure-canvas.component.ts:1294-1297`) PENDENT is amber for future but **red for past**. So amber means "will come (late)" in one screen and "hasn't answered" in another, and red means both "declined" and "never answered". A status → color mapping should be a single app-wide table; if past-tense needs distinction, encode it with a second channel (outline/fill, icon), not by reassigning hues.
- **`NO_VAIG` rendered as `error` red** everywhere (both apps). Judgment call worth making consciously: declining is a valid, complete answer, not a failure. Red-as-absent is a common attendance convention, so this is defensible — but then *actual* errors near those screens (failed loads, rejected saves) share the exact color. Consider neutral/muted for NO_VAIG and let red mean "something is wrong".

### 🟡 UI-COLOR-3 — The auto contrast-picker chooses the wrong polarity on mid-tone colors

`getContrastContent` (`tailwind.config.js:66-77`) flips between black/white at WCAG relative luminance 0.179. APCA shows that heuristic mis-fires exactly on mid-tones: for the generated `secondary` `#7a88ae` it picks **black (Lc 41 — below the placeholder floor)** when white measures **Lc −68**. Any colla whose primary lands in the mid-lightness band will get theme colors whose auto-text is the *worse* of the two options. Fix: compute APCA for both candidates and keep the higher |Lc| (a 10-line swap in the same file); the WCAG-luminance flip is precisely the kind of formula APCA was created to replace.

### 🟠 UI-COLOR-4 — `accent` and `secondary` are hue-math artifacts, not palette decisions

`generateCollaTheme` derives `accent` by rotating the primary hue 180° and `secondary` by desaturating/lightening it (`tailwind.config.js:87-88`). For the actual primary `#1E3A8A` (navy) this yields:

- **`accent` = `#8a6d1e` — dark mustard/olive.** The complement of a hue is a color-wheel fact, not a design choice; for most primaries the formula produces muddy results (red → teal, green → magenta). The app itself avoids it: **3 uses of `text-accent`, zero `btn-/bg-/badge-accent`** across both apps. Dead weight that will embarrass whichever future feature reaches for it.
- **`secondary` = `#7a88ae` — a washed grey-blue** that reads as a *disabled* tint, not a secondary brand color, and whose auto-content color is wrong (UI-COLOR-3). Its ~19 usages across both apps are mostly "muted/neutral" intents that the stable `neutral`/`base-300` tokens already serve.

Either make accent/secondary explicit per-colla inputs (`generateCollaTheme(primary, { secondary?, accent? })` with the derivations as fallback), or freeze a human-reviewed palette. Auto-derivation is only acceptable for tints of the primary itself — cross-hue choices need eyes.

### 🟡 UI-COLOR-5 — The Konva canvas layer speaks its own private color language

The flagship pinya canvases bypass the token system entirely (57 raw hex literals in `figure-canvas.component.ts` alone, 20 more in `segment-canvas`) and the ad-hoc choices collide with the app's semantics:

- **Selection is `#f59e0b` — the warning amber** (`SELECTED_STROKE`, `figure-canvas.component.ts:174`, reused at `:1200,1259`). "Selected" and "attendance pending" and "caution" are all the same amber on the same screen.
- **Two different greens:** assignment highlight uses emerald `#10b981` (`:1315,1347`) while attendance-confirmed dots use success green `#22c55e` (`:1295`) — near-identical hues that are *almost* the same color, which reads as a rendering mistake rather than a distinction.
- **`FIGURE_PALETTE` (figure identity colors, `utils/figure-palette.util.ts`) recycles the exact feedback colors** — `#ef4444`, `#22c55e`, `#3b82f6` are literally `error`, `success`, `info`. On the segment canvas a figure can be "red" for no reason other than being third in the list, next to red attendance dots that mean "declined".
- **A stray Material Design palette:** `tronc-view.component.ts:481` falls back to `#607D8B`/`#78909C` (Material blue-grey 500/400) in an otherwise Tailwind-slate app — visibly warmer greys.

Konva can't read CSS classes, but it can read CSS *variables* (`getComputedStyle(...).getPropertyValue('--p')`) or a shared `theme-colors.ts` exported next to `generateCollaTheme`. Centralize the canvas palette there: selection color distinct from warning (indigo/violet works next to this navy), one green, figure-identity palette chosen to avoid the four feedback hues (there are plenty: purple, cyan, orange, teal, rose already in the list).

---

## 2. Typography

### 🟠 UI-TYPE-1 — The two apps render in different typefaces

The dashboard imports and applies **Inter** globally (`apps/dashboard/src/styles.scss:1-10`); the PWA applies nothing, so it renders in the Tailwind default system stack (its own Google Fonts `<link>` was already flagged as unused in PWA-PERF-1). Result: the same product, same theme, same DaisyUI components — in two different typefaces depending on which surface you open. Whatever the choice (Inter everywhere or system stack everywhere), it should be one choice made in the shared Tailwind config (`theme.fontFamily.sans`), not per-app CSS.

### 🟡 UI-TYPE-2 — Dashboard loads its typeface render-blocking from a third-party CDN

`apps/dashboard/src/styles.scss:1` — `@import url('https://fonts.googleapis.com/...')` inside the compiled stylesheet is the slowest possible way to load a font: the browser discovers it only after the CSS downloads, then pays DNS+TLS to two Google hosts before text can render in the intended face. For an app also shipped on a self-hosted stack (Docker/Caddy), a runtime Google dependency is a gratuitous availability and GDPR liability — the same argument PWA-PERF-1 made, but here the font *is* used. Self-host via `@fontsource/inter` (4 files, cached forever by Caddy) and drop the import.

### 🟠 UI-TYPE-3 — No heading system: the page title alone ships in four sizes

`theme.extend` in `tailwind.config.js` is empty — there is no project type scale; every heading is styled ad hoc at the call site, and they have drifted:

- **H1 / page title:** the shared `app-page-header` fixes it at `text-xl font-bold` (`page-header.component.ts:11`) — but only the five list pages use that component. Home, login and template-list hand-roll `text-2xl font-bold`; person-detail, event-detail and both sync screens hand-roll `text-xl`; the segment workspace uses `text-base font-semibold`. The PWA adds `text-2xl` (home greeting) and `text-lg font-semibold` (mobile header). The same product answers "how big is a screen title?" with 16, 18, 20 and 24 px depending on the door you came in through.
- **H2 / section title:** ~15 distinct stylings coexist — `card-title text-base` with and without a bottom border, bare `font-semibold`, `text-sm font-semibold text-base-content/70`, `text-lg font-bold` (modals), plus custom classes (`panel-title`, `tronc-floating-title`). Modal titles are the only near-consistent group.

The weight palette itself is healthy (medium 129 / semibold 68 / bold 50 — a clean three-tier system). What is missing is the **role layer**: define named heading roles once (page-title, section-title, card-title, modal-title, micro-label) — either as tiny shared components like `app-page-header` already is, or as `@layer components` classes in the shared stylesheet — and adopt them everywhere. The existence of `app-page-header` shows the intent; adoption stopped at the list pages.

### 🟠 UI-TYPE-4 — Muted-opacity text stacks low contrast onto the smallest sizes

The de-facto "secondary text" convention is `text-base-content/NN` — **294 occurrences** across both apps (`/30` ×15, `/40` ×53, `/50` ×122, `/60` ×58, `/70` ×42, `/80` ×4). Measured with APCA on white:

| Pattern | Effective color | Lc | Meets |
| --- | --- | --- | --- |
| `/70` | `#626976` | 78 | ✅ small text |
| `/60` | `#787f89` | 68 | large/bold only |
| `/50` | `#8f949d` | **57** | headlines only |
| `/40` | `#a5a9b1` | **47** | headlines only |
| `/30` | — | ~35 | placeholder floor |

The problem is the *pairing*: the dominant `/50` tier is overwhelmingly applied to `text-xs` (12 px) labels, captions and micro-headers (`text-xs text-base-content/50 uppercase` is the standard micro-header recipe) — the exact opposite of the design rule that smaller text needs **more** contrast, not less. 12 px text needs Lc ≥ 75, i.e. `/70` at minimum on white. Recommendation: collapse the six ad-hoc tiers into two named roles — *muted* (`/70`, allowed at any size) and *faint* (`/50`, allowed only ≥ 14 px for non-essential decoration) — and stop using `/30`–`/40` for anything that carries information. This is a sed-sweep plus a convention note, not a redesign.

### 🔵 UI-TYPE-5 — Small-type economy and numeric alignment

Two observations, no action required:

- The dashboard's visible text mass sits at 12–14 px (`text-xs` ×235, `text-sm` ×199, explicit 16 px only ×21). For a dense admin tool that is a legitimate choice — but it is currently an *accident* of hundreds of local decisions, not a documented "our body is 14px" rule. Writing it down (and bumping `html { font-size }` or a scale token accordingly) would stop the drift between 12 and 14 for the same role on different screens.
- `tabular-nums` appears exactly once in the codebase, yet the data tables, capacity counters and pagination render numbers everywhere. Adding it to the shared `data-table` cells and stat displays prevents column wobble when values change width.

---

## 3. Iconography

The foundation here is genuinely good — better than most projects: both apps use **Lucide** (180 `<lucide-icon>` across 43 dashboard files, 11 PWA files), and the dashboard has a curated, documented domain-icon vocabulary (`shared/constants/domain-icons.ts`: figura, pinya, tronc, xicalla, observacions… each with a doc comment). The findings are about the residue that predates or escapes that system.

### 🟡 UI-ICON-1 — The same concept renders as a Lucide icon on one screen and an emoji on the next

The domain vocabulary is defined but not enforced:

- **Xicalla** is the Lucide `Baby` icon in event-detail (`ICON_XICALLA`), but the **👶 emoji** in `person-hover-card.component.ts:31`, `attendance-edit-modal.component.html:24` and `person-search-input.component.html:35`.
- **"Vindrà a la propera actuació"** is the **🎭 emoji** in the person panel (`person-panel.component.html:258,411,445`) — while the actuació concept everywhere else is Lucide `Star` (`ICON_ACTUACIO`).

Emoji as UI icons carry three costs the Lucide set doesn't: they render differently on every OS (the Konva canvas will literally print a different 🎭 on the projection machine than on the operator's laptop), they can't take the theme color or stroke weight, and at badge sizes they blur. Both concepts already have (or trivially get) a Lucide equivalent — this is a five-file sweep. The Konva canvas usages (`figure-canvas.component.ts:1405,1786`) are the one semi-defensible case (Konva renders text cheaply), but Konva also renders SVG path data, and Lucide exports it.

### 🟡 UI-ICON-2 — Text glyphs fill the gaps: ✕ close buttons, ✓/✗/? status marks, ←/→ arrows

Alongside 180 proper icons, a parallel system of keyboard-character "icons" survives: **✕** as the close affordance in 9 dashboard spots *and* the PWA toast (`toast-container.component.ts:41`), **✓/✗/?** as attendance markers (home cards, person-panel pills), **←/→** for navigation. These glyphs come from the text font, so they don't match Lucide's stroke weight or optical size, they scale with text (not with icon size), and screen readers read some of them aloud ("multiplication x"). Lucide `X`, `Check`, `HelpCircle`, `ArrowLeft` are already in the bundle. Same argument as UI-ICON-1: the system exists; finish the migration.

### 🔵 UI-ICON-3 — Status meaning carried by icon *shape* is nearly there — lean into it

The attendance grammar currently leans on color (green/red/amber — the weakest channel, see UI-COLOR-1/2) with ✓/✗/? glyphs as a secondary channel in *some* places but not others (calendar dots are color-only, canvas dots are color-only). Since the icon system is healthy, the cheap robustness win is to make the shape channel universal: every place attendance is encoded (dots, pills, badges) gets the same icon + color pair. This also resolves the "NO_VAIG looks like an error" ambiguity (UI-COLOR-2) without changing any hue: an ✗-in-circle reads as "answered no", while error states keep the triangle/alert shape.

---

## 4. Component & visual consistency

Where the shared kit is used, the dashboard is remarkably consistent: `card bg-base-100 shadow-sm` (×14) is a real convention, primary actions are uniformly `btn btn-primary btn-sm`, and both apps' empty-state components render visually identical layouts. The findings are about the dimensions nobody standardized.

### 🟡 UI-CONS-1 — Elevation, radius and badge sizing have no scale — every call site improvises

- **Shadows:** five tiers in active use with no discernible rule (`shadow-sm` ×46, `shadow-lg` ×20, `shadow` ×19, `shadow-md` ×11, `shadow-xl` ×1). Cards at rest are sometimes `shadow-sm`, sometimes `shadow`; overlays range `md`–`xl`. An elevation scale is three decisions (resting / hover-raised / floating) — write them down and sweep.
- **Corner radius:** similar surfaces span `rounded` (4 px) ×32, `rounded-lg` ×20, `rounded-box` ×18, `rounded-sm` ×6, `rounded-xl` ×5, `rounded-2xl` ×3. DaisyUI already provides the semantic pair (`rounded-box` for containers, `rounded-btn` for controls, `rounded-badge`) that would make this self-consistent *and* themeable — the raw Tailwind radii bypass it.
- **Badges:** the same kind of label renders `badge-sm` in one file and `badge-xs` in another (23 size/color permutations counted; the "Tronc" badge alone ships in three class orders). Pick one badge size per context (table cell vs. card header) and encode status→badge-class in a single shared map (which UI-COLOR-2's status table needs anyway).
- **Modal widths:** six different `max-w-*` tiers for structurally similar form modals (`max-w-xs` through `max-w-2xl`). Two named tiers (form / wide) would cover every current case. This is the visual companion to the audit-02 finding that modal *infrastructure* is unshared (FE-ARCH-2): when the shared modal component gets built, bake the width tiers into it.

### 🟡 UI-CONS-2 — Two loading philosophies: the dashboard spins, the PWA shimmers

The PWA's loading state is skeleton-first (`skeleton-card` shimmer while lists load) — the modern, layout-stable choice. The dashboard uses **52 `loading-spinner`s in four sizes** (29 of them `loading-xs`) and touches skeletons in only 6 files. Consequences: dashboard content areas collapse to a centered spinner and re-expand when data lands (layout jump), and the two apps *feel* different while loading the same domain data. Convention worth adopting product-wide: skeleton for page/section loads (preserves layout), spinner only for inline busy states (inside a button that was just pressed). The dashboard's shared `data-table` already has a skeleton row mode — extend that pattern to cards/detail panes.

### 🟡 UI-CONS-3 — Content width and page gutters are per-page accidents

The app shell (`app.html:13-18`) gives routed pages `p-4 lg:p-6` and **no max-width**. Downstream:

- **Most list pages run full-bleed** to any monitor width — on a wide desktop display the data tables stretch to 2000+ px, putting the row-actions column half a meter from the name column and producing unreadable scan lines. Meanwhile home constrains itself to `max-w-7xl mx-auto`, and three other screens pick `max-w-3xl`/`max-w-5xl` locally. "How wide is a page?" currently has four answers, and the most common one is "infinite".
- **`template-list` adds its own `p-6` inside the shell's padding** (`template-list.component.html:1`), so the Plantilles screen renders with ~double the gutter of every sibling page — a visible jump when tabbing between Persones/Assajos/Plantilles.
- Page-level vertical rhythm drifts between `space-y-4` (lists), `space-y-6` (home) and `gap-6` (template-list).

Fix in the shell, not the pages: give `<main>`'s inner container a default `max-w-7xl mx-auto` (with an opt-out for the intentionally full-bleed canvas/projection routes, which already use the fullscreen layout escape) and delete the per-page wrappers.

### 🔵 UI-CONS-4 — Small recipe divergences worth folding into the shared kit

- The icon-inside-search-input recipe exists in two variants: `<label class="input …">` (figure-picker — correct: clicking the icon focuses the input) and `<div class="input …">` (user-list and others — loses the click-to-focus affordance). Trivial, but it's the kind of thing a shared `app-search-input` erases; note FE-BUG-28 already wants that component for debounce reasons.
- Home's stat cards use `border-l-4` with semantic colors (`border-warning`, `border-success`, `border-info`) as *decorative category accents* — a mild echo of UI-COLOR-2's role confusion; if the left-border accent stays, drive it from a category→color map, not from status tokens.
- The two `empty-state` components (dashboard `shared/components/data/`, PWA `shared/components/`) are visual twins with different APIs (`actionClick` vs `action` output, `icon` typed `string | null` vs `LucideIconData`). Same drift-risk as PWA-ARCH-2 (triplicated auth models) but for UI: see UI-XAPP-2.

---

## 5. Interaction & motion

### 🟡 UI-INT-1 — Two tooltip systems, both hover-only, on an app that ships to tablets

**39 native `title=` attributes vs 5 DaisyUI `tooltip` classes** in the dashboard. Native `title` has the ~1 s OS delay, renders in unthemed system chrome, and — the real problem — never fires on touch, and the projection/assignment screens are exactly the ones expected to run on tablets (cf. FE-BUG-22's touch analysis). Several `title`s carry real information ("Vindrà a la propera actuació", xicalla markers, lock explanations) that touch users simply never get. Rule of thumb to adopt: information required to use the screen gets a visible label or the existing `person-hover-card`-style tap-friendly surface; genuine supplementary hints get the DaisyUI tooltip (one position convention); `title=` gets removed.

### 🟡 UI-INT-2 — Press feedback exists only in the PWA; the dashboard is hover-only

The PWA consistently gives touch feedback (`active:scale-*`, `active:bg-base-*` on cards and controls). The dashboard has **zero `active:` styles** — interactive rows, clickable cards and canvas toolbar chips respond to hover alone. On the tablet use-case this means taps land with no visual acknowledgment until the navigation/data change happens. DaisyUI buttons handle their own press state; the gap is the *custom* clickable surfaces (table rows, template cards, segment chips). Adding the PWA's `active:` recipe to the dashboard's shared clickable surfaces is a small, mechanical change.

### 🟡 UI-INT-3 — No motion system: ad-hoc durations, per-component keyframes, and no reduced-motion anywhere in the dashboard

Transitions are scattered one-off choices (`transition-colors` ×25, `transition-shadow` ×10, `transition-all` ×2, plus bespoke `@keyframes panel-pop-in`, `slide`, `animate-pulse`) with no shared duration/easing tokens — and `prefers-reduced-motion` appears **nowhere in either app** (the PWA half of this is PWA-A11Y-6; the dashboard half is new). Two cheap moves: (1) standardize on Tailwind's `duration-150`/`duration-300` + `ease-out` for micro-interactions and reference them from the custom keyframes; (2) add a global `@media (prefers-reduced-motion: reduce)` rule in each app's `styles.scss` that collapses transition/animation durations — one block, covers everything including DaisyUI's own transitions.

### 🔵 UI-INT-4 — Focus-visible craftsmanship is excellent in pockets — promote it to a convention

`tronc-view.component.scss` (7 hand-tuned `:focus-visible` rules) and template-list's `focus-visible:outline-2 focus-visible:outline-primary` cards show someone cared. But the recipe lives locally: other custom clickable surfaces (data-table rows, segment chips, composition grid cells) have no focus treatment beyond browser defaults — which several `outline-none` inner inputs suppress. Extract the one true focus ring (`outline-2 outline-offset-2 outline-primary`) into a shared utility class and apply it to every custom interactive surface. (Keyboard *reachability* gaps are already tracked as FE-A11Y-1/3 — this is only about the visible style.)

---

## 6. Cross-app coherence

### 🟡 UI-XAPP-1 — Base rendering setup diverges between the apps

Small, unforced divergences that make the two surfaces render differently:

- `data-theme="colla-barcelona"` sits on `<html>` in the dashboard, on `<body>` in the PWA (`apps/dashboard/src/index.html:2` vs `apps/pwa/src/index.html:15`). Both work, but PWA styles applied to `<html>` (scrollbar, base background) fall outside the theme.
- The PWA body sets `antialiased` and `bg-base-200`; the dashboard sets neither — so default page background and font smoothing differ.
- Favicon: dashboard ships the stock `favicon.ico`; the PWA points at the real logo PNG. The browser tab is the one place both apps meet.

One shared "HTML shell" convention (theme attribute placement, body classes, favicon) removes all three.

### 🟡 UI-XAPP-2 — There is no shared UI library, so every visual convention is maintained twice

`libs/shared` contains enums only (by design, per CLAUDE.md) — which means every cross-app UI concern lives as parallel copies: two `empty-state` components (visual twins, diverging APIs — UI-CONS-4), two toast systems, two attendance status→color mappings (already diverging: UI-COLOR-2), two icon habits, two loading philosophies (UI-CONS-2), two typefaces (UI-TYPE-1). Each finding in this report that says "adopt one convention" currently has *no single place to put that convention*. A `libs/ui` (or even just `libs/shared/ui-tokens` with the status→color/icon maps, spacing/duration tokens and `theme-colors.ts` for Konva) is the structural fix; without it, the two apps will keep re-diverging after every sweep. This is the UI-layer twin of PWA-ARCH-2/PWA-API-4 (triplicated auth models).

---

## 7. Theming & configurability

### 🟡 UI-CONF-1 — Per-colla theming is designed for, but baked at build time

`generateCollaTheme(primaryHex)` is a genuinely good configurability seed — one hex in, full DaisyUI theme out — but the hex lives hardcoded in `tailwind.config.js:129` and the theme name (`'colla-barcelona'`) is hardcoded in both `index.html` files. Supporting a second colla today means editing the Tailwind config, rebuilding both apps, and editing two HTML files. If multi-colla is on the roadmap (the function's name says it is), the path is: emit the theme as CSS custom properties at runtime (DaisyUI themes are just CSS variables) from an API-served colla config — no rebuild. If multi-colla is *not* planned, the generator's naive derivations (UI-COLOR-2/3) cost more than the flexibility is worth: consider freezing the generated values into an explicit, human-reviewed theme object.

### 🟠 UI-CONF-2 — No dark theme, and the door is explicitly closed

`darkTheme: false` (`tailwind.config.js:132`) and a single light theme. For the dashboard this is a defensible scope cut. For the **PWA it is not**: the primary usage context is members checking assajos/actuacions on phones — evenings, outdoors, dark rehearsal halls. A full-white `base-100` screen at night is genuinely hostile, and OLED battery cost is real. DaisyUI makes this nearly free: define `colla-barcelona-dark` (same generator, dark base scale), honor `prefers-color-scheme` via the `darkTheme` option. Design both variants together (contrast re-checked per UI-COLOR-1 — dark mode needs *desaturated lighter* tones, not inverted ones).

---

## 8. Fix-first ranking

Ranked by (user-visible improvement × cheapness), across all sections:

| # | Finding | Why first | Effort |
| --- | --- | --- | --- |
| 1 | 🟠 [UI-COLOR-1](#-ui-color-1--the-status-palette-is-too-light-to-carry-its-own-text-apca) Darken the four status colors | Every status button/badge/toast in both apps becomes readable; 4 lines in one file | Trivial |
| 2 | 🟠 [UI-COLOR-2](#-ui-color-2--semantic-tokens-used-as-an-action-palette-warning-means-sync-success-means-submit) Retire warning-as-sync and success-as-CTA; one shared attendance status map | Restores meaning to the entire color channel; prerequisite for every future screen | Small sweep |
| 3 | 🟠 [UI-CONF-2](#-ui-conf-2--no-dark-theme-and-the-door-is-explicitly-closed) Dark theme for the PWA | The single most user-felt gap: members use it on phones at night | Medium |
| 4 | 🟠 [UI-TYPE-1](#-ui-type-1--the-two-apps-render-in-different-typefaces) + 🟡 [UI-TYPE-2](#-ui-type-2--dashboard-loads-its-typeface-render-blocking-from-a-third-party-cdn) One self-hosted typeface in the shared config | Product-level coherence + removes the render-blocking CDN | Trivial |
| 5 | 🟠 [UI-TYPE-4](#-ui-type-4--muted-opacity-text-stacks-low-contrast-onto-the-smallest-sizes) Collapse muted-text tiers to `/70`-minimum for small text | 294 call sites, mechanical sed sweep, legibility win everywhere | Small sweep |
| 6 | 🟡 [UI-CONS-3](#-ui-cons-3--content-width-and-page-gutters-are-per-page-accidents) Max-width + gutters in the shell | Fixes every list page at once on wide screens | Trivial |
| 7 | 🟡 [UI-XAPP-2](#-ui-xapp-2--there-is-no-shared-ui-library-so-every-visual-convention-is-maintained-twice) Create `libs/ui` tokens (status maps, motion tokens, `theme-colors.ts`) | The enabler: gives #2, #8 and #9 a home; stops re-divergence | Medium |
| 8 | 🟡 [UI-COLOR-5](#-ui-color-5--the-konva-canvas-layer-speaks-its-own-private-color-language) Centralize the canvas palette; unclash selection/figure colors | The flagship feature stops contradicting the rest of the app | Medium |
| 9 | 🟠 [UI-TYPE-3](#-ui-type-3--no-heading-system-the-page-title-alone-ships-in-four-sizes) Named heading roles, adopted everywhere | Ends the four-sizes-of-H1 drift | Small sweep |
| 10 | 🟡 [UI-INT-3](#-ui-int-3--no-motion-system-ad-hoc-durations-per-component-keyframes-and-no-reduced-motion-anywhere-in-the-dashboard) Global reduced-motion block + duration tokens | One CSS block per app | Trivial |
| 11 | 🟡 [UI-INT-1](#-ui-int-1--two-tooltip-systems-both-hover-only-on-an-app-that-ships-to-tablets) / [UI-INT-2](#-ui-int-2--press-feedback-exists-only-in-the-pwa-the-dashboard-is-hover-only) Tooltip policy + `active:` states on the dashboard | The tablet experience stops being second-class | Small sweep |
| 12 | 🟡 [UI-COLOR-3](#-ui-color-3--the-auto-contrast-picker-chooses-the-wrong-polarity-on-mid-tone-colors) / 🟠 [UI-COLOR-4](#-ui-color-4--accent-and-secondary-are-hue-math-artifacts-not-palette-decisions) Fix the theme generator (APCA polarity pick, explicit accent/secondary) | Matters the day a second colla arrives; cheap while the file is open for #1 | Small |
| 13 | 🟡 [UI-ICON-1](#-ui-icon-1--the-same-concept-renders-as-a-lucide-icon-on-one-screen-and-an-emoji-on-the-next) / [UI-ICON-2](#-ui-icon-2--text-glyphs-fill-the-gaps--close-buttons--status-marks--arrows) Finish the Lucide migration (emoji + glyph residue) | Small polish, high perceived-quality return | Small sweep |

Two structural notes. First, items 1, 5 and 12 all touch `tailwind.config.js` — do them in one pass. Second, item 7 (`libs/ui`) is this report's equivalent of audit-02's "list controller + modal component" leverage point: most findings here are one-decision conventions, and the reason they drifted is that there has never been a place to *write the decision down*. Creating that place is worth more than any individual fix below rank 6.
