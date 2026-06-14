# Tronc UX Refactor — Design Spec

> **Date**: 9 June 2026
> **Status**: Draft
> **Phase**: P5 (Figures/Canvas Module)
> **Scope**: 3 sub-projects (SP1 Editor CRUD/UX, SP2 Projection & Navigation, SP3 Assignment Polish)
> **Supersedes**: Extends P5.1 tronc widget design (`2026-05-07-p5-1-tronc-widget-redesign.md`)

---

## 1. Motivation

The current TroncViewComponent has several usability issues:

- **Impossible configurations**: Users can add P3 on top of P1 (skipping P2) — nonsensical for a real figure.
- **Confusing floor dropdown**: Mixes z-level and positionType in a single `<select>` with too many options.
- **Free-form position/width inputs**: `<input type="number">` allows arbitrary decimals (e.g. `1.3u`) when only 0.5u steps are valid. No limits enforce that nodes stay within base boundaries.
- **Position type disconnect**: `positionType` is a hardcoded string in `FLOOR_LABELS`, disconnected from the Position catalog at `/config/positions`. This breaks the future filtering-by-position in assignment mode.
- **Inconsistent tronc presentation**: Fixed `<aside>` in projection, floating panel in editor/assignment, dark floating panels in projection-view — three different patterns for the same widget.
- **Navigation gaps**: "Tornar al segment" is at bottom-left in `FigureProjectionComponent` (everywhere else, back is top-left). No back button in `ProjectionViewComponent`. No way to return to assignment from projection.

---

## 2. Approach

**Progressive Refactor** (Approach A) — keep `TroncViewComponent` as a single component with mode-based branching. Add inputs, replace controls, add constraints incrementally. Each sub-project is an independently shippable diff.

Alternatives considered:
- **Extract Editor Controls Component** (B) — cleaner separation but adds complexity without proportional benefit at current component size (~430 TS lines).
- **Full Component Split** (C) — triplicates CSS grid rendering, over-engineered.

---

## 3. Sub-project 1: Editor CRUD/UX Refactor

### 3.1 Sequential Floor Management

**Current:** `<select>` dropdown lists all z-levels × positionTypes. Allows adding P4 without P2/P3.

**New behavior:**

- Remove hardcoded `FLOOR_LABELS` constant and `availableFloorOptions()` computed.
- Single **"Afegir pis"** button at the bottom of the floors container.
- Button creates the next sequential floor: `nextZ = max(existingZLevels) + 1` (or `1` if no tronc floors exist).
- The first node on the new floor gets a default `positionType` from the first available TRONC-zone position in the catalog.
- Button disabled when: `nextZ > MAX_TRONC_Z (5)` or `baseNodes.length === 0`.

**Floor deletion constraint:**

- Cannot delete a floor if a higher floor exists.
- Per-floor delete button disabled with tooltip: _"Elimina primer els pisos superiors"_.
- When deleting the topmost floor, show confirmation: _"S'eliminaran tots els nodes d'aquest pis."_
- **Output contract:** New `floorRemoved` output emits `z: number`. Parent calls existing `onTroncFloorRemoved(z)` which bulk-removes all TRONC nodes at that z-level.

**Legacy templates with z-level gaps:** If a template has existing gaps (e.g. P1 + P3, no P2), the sequential logic uses `nextZ = max(existingZLevels) + 1`. Gaps are not backfilled — this is acceptable for legacy data. The editor does not allow creating new gaps.

### 3.2 Node PositionType from Position Catalog

**Current:** `positionType` set from hardcoded `FLOOR_LABELS`. No link to Position entity.

**New behavior:**

- New input on `TroncViewComponent`:

```typescript
readonly troncPositions = input<PositionOption[]>([]);
```

Where:

```typescript
interface PositionOption {
  slug: string;
  name: string;
  color: string | null;
}
```

- `TemplateEditorComponent` loads positions via `PositionService.getAll()`, filters `zone === FigureZone.TRONC`, maps to `PositionOption[]`, passes as input.
- **Inline positionType selector per node:** When a node is selected in editor mode, the editor controls section shows a `<select>` populated from `troncPositions()` alongside the stepper controls. The value maps to `Position.slug`.
- **No TRONC positions configured:** Show inline hint with link: _"Cap posició de tronc configurada. Ves a Configuració > Etiquetes."_ (route: `/config/tags`).
- **Node label persistence:** When creating or updating a tronc node's `positionType`, `FigureNode.label` is always set to `Position.name` (the human-readable name from the matching Position record). At render time, `node.label` is displayed as-is — no runtime lookup needed. If no matching Position is found (legacy data), the raw `positionType` string is used as fallback label. The free-text label input for tronc nodes is removed.
- **Default positionType for new floors:** When creating a new floor via "Afegir pis", the first node uses the first TRONC position sorted alphabetically by `slug`. When adding a node via the per-floor "+" button, the new node inherits the `positionType` of the last node on that floor (dominant type pattern).
- **Output changes:**
  - `nodeAdded` adds `positionType: string` and `label: string` (= `Position.name`) from position selector.
  - `nodeUpdated` adds optional `positionType?: string` and `label?: string` for type changes.

### 3.3 Stepper Controls for x/width

**Current:** `<input type="number">` with free decimal typing.

**New behavior:**

- Replace both number inputs with a **visual stepper** pattern: `[–] value [+]`.
- Each tap changes value by 0.5u.
- Value displays as a badge (e.g. `1.5u`) — not an editable text field.
- Keyboard navigation: `ArrowLeft`/`ArrowDown` = −0.5, `ArrowRight`/`ArrowUp` = +0.5 when the stepper group is focused.
- **Base-bound constraints** applied in real time:
  - `x`: min `0`, max `baseCount − width`
  - `width`: min `0.5`, max `baseCount − x`
  - When adjusting one, the other's max recalculates.
- Stepper buttons disable at min/max bounds.
- Visual layout: horizontal row `[Pos: [–] 1.0u [+]] [Amp: [–] 2.0u [+]] [🗑]`.

### 3.4 Snap-to-Grid Visual Feedback

- Add `transition: all 0.15s ease` on `.tronc-node` elements.
- When x or width changes via stepper, the node visually moves to its new grid position with a smooth transition.
- CSS `grid-column` transitions are not natively supported by browsers — the transition on `all` catches any layout-adjacent properties. This is best-effort visual polish.

### 3.5 Responsive Floating Panel

**Current:** Fixed `width: 600px`, `max-width: 90vw`.

**New:**

```scss
.tronc-floating-panel {
  width: min(600px, calc(100vw - 2rem));
  max-height: min(70vh, calc(100vh - 80px));

  @media (max-width: 639px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: 0.75rem 0.75rem 0 0;
    max-height: 60vh;
    // Disable drag repositioning on mobile
  }
}
```

On narrow viewports: bottom sheet with fixed position (no drag). On desktop: draggable as current.

### 3.6 Component Interface Changes (SP1)

**`TroncViewComponent`:**

| Change | Type | Detail |
|--------|------|--------|
| `troncPositions` | New input | `PositionOption[]` from Position catalog |
| `nodeAdded` output | Modified | Adds `positionType` and `label` from position selector |
| `nodeUpdated` output | Modified | Adds optional `positionType` and `label` for type changes |
| `floorRemoved` | New output | Emits `z: number` for bulk floor deletion |
| `FLOOR_LABELS` | Removed | Replaced by dynamic positions + sequential z logic |
| `availableFloorOptions()` | Removed | Replaced by `canAddFloor()` boolean computed |
| `selectedFloorType` signal | Removed | Single-button replaces dropdown |
| `onNodeXChange` / `onNodeWidthChange` | Refactored | Stepper handlers with base-bound constraints |
| Number inputs | Removed | Replaced by stepper UI |

**`TemplateEditorComponent`:**

| Change | Detail |
|--------|--------|
| Load TRONC positions | `PositionService.getAll()` → filter zone=TRONC → pass as input |
| Wire `nodeUpdated` positionType | Update `FigureNodeItem.positionType` and `label` on change |
| Wire `floorRemoved` | Calls existing `onTroncFloorRemoved(z)` |

---

## 4. Sub-project 2: Projection & Navigation Consistency

### 4.1 Floating Panel in Projection

**Current:** `FigureProjectionComponent` has a fixed `<aside>` (35% max-width). `ProjectionViewComponent` has custom dark floating panels.

**New behavior:**

- **`FigureProjectionComponent`:** Replace fixed aside with the standard `tronc-floating-panel` pattern. Open by default. Toggle via a "Tronc" button (top area, ghost style). Panel renders in `mode="projection"` — read-only.
- **`ProjectionViewComponent` (pinya view):** Keep per-instance floating panels; align styling to `tronc-floating-panel` (same border-radius, shadow, header).
- **`ProjectionViewComponent` (troncs view):** No change — cards already display tronc data.

### 4.2 Navigation Buttons

**`FigureProjectionComponent`:**

- Move "Tornar" from `bottom-left` to **`top-left`**.
- **Two navigation buttons** (top-left):
  1. _"Tornar a l'assignació"_ — navigates to `/pinyes/events/:eventId/segments/:segmentId/assign`. Primary action. Icon: `ArrowLeft`.
  2. _"Projecció del segment"_ — navigates to `/pinyes/events/:eventId/segments/:segmentId/project`. Secondary (ghost style). Icon: `LayoutGrid`.
- Refactor `handleBack()` to `navigateToAssignment()` and `navigateToProjection()`.

**`ProjectionViewComponent`:**

- Add **"Tornar a l'event"** button at `top-left`.
- Navigates via `location.back()`. The projection view is always reached from an event detail page, so `back()` reliably returns there. No event type resolution needed.
- Style: `btn btn-ghost btn-sm gap-1` with `ArrowLeft` icon.

### 4.3 Component Changes (SP2)

| Component | Change |
|-----------|--------|
| `FigureProjectionComponent` | Replace `<aside>` with floating panel + toggle; two-button navigation at top-left |
| `ProjectionViewComponent` | Add back button top-left; align tronc panel styles |

---

## 5. Sub-project 3: Assignment Polish

### 5.1 Position Color Coding

- In `mode="assignment"`, tronc nodes show a subtle colored left-border matching the `Position.color` for their `positionType`.
- Requires `AssignmentCanvasComponent` to load positions and pass `troncPositions` input (same as editor).
- Aids visual scanning: e.g. all alçadores are blue, all xiquetes are green.

### 5.2 Position Type in Floor Label

- In assignment mode, the floor label shows the dominant position type alongside the Pn code (e.g. "P2 · Segon").
- Already partially implemented via `positionTypeLabel` — needs to derive from `Position.name` instead of raw `positionType` string. Uses the same `troncPositions` input.

### 5.3 No Drag & Drop (Deferred)

- Drag & drop interaction deferred to P7+.
- Steppers + visual preview are the interaction model for SP1-SP3.

---

## 6. Data Model

**No schema changes.** The existing `FigureNode.positionType: varchar` (and `InstanceNode.positionType: varchar`) stay as-is. The soft match convention (`Position.slug === FigureNode.positionType`) is established and sufficient.

The only data flow change: the dashboard loads `Position[]` in editor/assignment context and uses them as a lookup for display names and colors.

---

## 7. Edge Cases & Risks

| Scenario | Handling |
|----------|----------|
| No TRONC positions configured | Inline hint with link to config. Floor creation uses fallback `positionType = 'tronc'`. |
| Base count decreases after tronc built | Warning badge on overflowing nodes. No auto-delete. User must fix manually. |
| Existing templates with hardcoded positionTypes | No migration needed. Existing strings display via fallback label. They match Position slugs by convention. |
| CSS grid-column transition | Not natively supported. Best-effort via `transition: all 0.15s ease`. |
| `FigureProjectionComponent` in embedded mode | `backToSegment` output still works. Two-button nav only in standalone route mode. |

---

## 8. Testing Strategy

| Sub-project | Tests |
|-------------|-------|
| SP1 | Unit: stepper clamping (min/max/0.5u step), sequential floor validation (can't skip z, can't delete non-top), base-bound constraint (`x + width ≤ baseCount`). Template: disabled states, position selector rendering. |
| SP2 | Integration: `router.navigate` calls with correct routes. Template: floating panel toggle, button placement. |
| SP3 | Unit: position color derivation. Template: colored node border rendering. |

---

## 9. Files Affected

### SP1

- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.ts`
- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.html`
- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.scss`
- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.spec.ts`
- `apps/dashboard/src/app/features/pinyes/components/template-editor/template-editor.component.ts`
- `apps/dashboard/src/app/features/pinyes/components/template-editor/template-editor.component.html`
- `apps/dashboard/src/app/features/pinyes/components/template-editor/template-editor.component.scss`

### SP2

- `apps/dashboard/src/app/features/pinyes/components/figure-projection/figure-projection.component.ts`
- `apps/dashboard/src/app/features/pinyes/components/figure-projection/figure-projection.component.html`
- `apps/dashboard/src/app/features/pinyes/components/projection-view/projection-view.component.ts`
- `apps/dashboard/src/app/features/pinyes/components/projection-view/projection-view.component.html`
- `apps/dashboard/src/app/features/pinyes/components/projection-view/projection-view.component.scss`

### SP3

- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.ts` (additive)
- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.html` (additive)
- `apps/dashboard/src/app/features/pinyes/components/tronc-view/tronc-view.component.scss` (additive)
- `apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.ts`
