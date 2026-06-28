# Segment Distribution — Spec

> **Status:** Draft
> **Created:** 2026-06-27
> **Phases:** 5 (independently deployable)
> **Branch prefix:** `feat/segment-distribution-phase-X`

## 1. Executive Summary

Allow users to define a **custom spatial layout** for the figure instances within a segment. When a distribution is set, the projection view renders all figures at their defined positions (x, y, rotation) and each figure's tronc panel at its own draggable sub-region, instead of using the automatic greedy-packing algorithm.

### Motivation

- Some segments have multiple instances of the same figure (e.g. two "Pilar de 3") that should appear arranged spatially (e.g. in a triangle) during projection.
- The current auto-layout algorithm distributes figures in rows/columns without any spatial intent.
- The compositions feature attempted this but is buggy and couples figures at template level; this feature works at segment instance level, which is the correct scope.

### Approach

**Extend `FigureInstance`** with new nullable columns for distribution data (x, y, angle, tronc panel geometry). No new table needed. "Distribution is active" is inferred by checking `distributionX IS NOT NULL` on the segment's instances. The distribution editor is a new fullscreen canvas route analogous to the composition editor.

---

## 2. Data Model Changes

### 2.1 `FigureInstance` — new columns

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `projectionX` | `float` | — | YES | Canvas X position in the distribution editor |
| `projectionY` | `float` | — | YES | Canvas Y position |
| `projectionAngle` | `float` | `0` | YES | Rotation in degrees |
| `troncPanelX` | `float` | — | YES | X of the tronc panel rectangle on the distribution canvas |
| `troncPanelY` | `float` | — | YES | Y of the tronc panel rectangle |
| `troncPanelWidth` | `float` | — | YES | Width of the tronc panel |
| `troncPanelHeight` | `float` | — | YES | Height of the tronc panel |

**Existing columns kept as-is:** `projectionX`, `projectionY` already exist, we will reuse them. There is also `projectionScale` which will remain unused for now.

**"Distribution active" sentinel:** a segment has a custom distribution if and only if at least one of its instances has `projectionX IS NOT NULL`.

**"Remove distribution"** sets `projectionX = projectionY = projectionAngle = troncPanelX = troncPanelY = troncPanelWidth = troncPanelHeight = NULL` for all instances in the segment (batch update).

---

## 3. API Changes

All under the existing `EventSegmentController` at `/events/:eventId/segments`.

### 3.1 New endpoint — save distribution

```
PUT /events/:eventId/segments/:segmentId/distribution
```

Body — `UpdateSegmentDistributionDto`:

```typescript
class InstanceDistributionDto {
  instanceId: string;          // UUID
  x: number;
  y: number;
  angle: number;               // degrees
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
}

class UpdateSegmentDistributionDto {
  items: InstanceDistributionDto[];
}
```

Response: `204 No Content`.

Implementation: batch-updates all listed instances. Instances not listed are left unchanged (allows partial saves during autosave).

### 3.2 New endpoint — clear distribution

```
DELETE /events/:eventId/segments/:segmentId/distribution
```

Response: `204 No Content`.

Implementation: sets all seven distribution columns to `NULL` for all instances in the segment.

### 3.3 Updated projection response

The `GET /events/:eventId/segments/:segmentId/projection` response is extended: each `ProjectionInstance` now includes the new distribution fields:

```typescript
interface ProjectionInstance {
  // ... existing fields ...
  projectionX: number | null;
  projectionY: number | null;
  projectionAngle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
}
```

The `ProjectionSegmentData` response gains:

```typescript
interface ProjectionSegmentData {
  // ... existing fields ...
  hasDistribution: boolean;  // true if any instance has distributionX != null
}
```

### 3.4 New endpoint — get distribution (for editor)

```
GET /events/:eventId/segments/:segmentId/distribution
```

Returns the segment's instances with their figure template nodes (pinya + base nodes only, for canvas rendering) and current distribution fields.

```typescript
interface SegmentDistributionData {
  segment: { id: string; name: string | null };
  items: DistributionItem[];
}

interface DistributionItem {
  instanceId: string;
  label: string | null;
  figureTemplate: { id: string; name: string; nodes: FigureNodeItem[] };
  projectionX: number | null;
  projectionY: number | null;
  projectionAngle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
}
```

---

## 4. Frontend Changes

### 4.1 New route

```
/pinyes/events/:eventId/segments/:segmentId/distribute
```

Lazy-loaded. Added to `pinyes.routes.ts`.

### 4.2 New component — `DistributionEditorComponent`

Fullscreen canvas editor, **copied from `CompositionEditorComponent`** and adapted. Compositions will be removed in a future cleanup; code is deliberately shared.

**Removed vs. composition editor:**
- Left sidebar (figure picker) — instances are fixed, no adding/removing
- Name / slug / description inputs
- Z-order (bring forward / send backward) controls
- Right slot-properties sidebar

**Kept:**
- Fullscreen layout via `layoutService.requestFullscreen()`
- Top bar: back button, segment name, save status indicator, grid toggle, snap toggle, fit-all button
- Autosave: debounced 1 500 ms after any move/rotate, calls `PUT .../distribution`

**Added:**
- "Esborra distribució" button in top bar → confirmation dialog → `DELETE .../distribution` → navigate back

**Initial positions:** on first open, if no distribution exists yet (`projectionX` is null on all instances), figures are auto-placed in a horizontal row spaced 50 px apart as a starting point. The user then drags to their preferred layout before the first autosave fires.

### 4.3 `FigureCanvasComponent` — extend `composition` mode for rotation

**No new canvas mode is added.** Instead, `CompositionSlotWithNodes` gains an optional `angle` field:

```typescript
export interface CompositionSlotWithNodes {
  slotId: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  angle?: number;   // degrees — used by distribution editor; ignored by composition editor
  figureTemplate: { ... };
}
```

In `renderCompositionSlots()`, the Konva group is created with `rotation: slot.angle ?? 0`.

A rotation handle (small circle, 8 px radius, positioned 24 px above the bounding rect top-centre) is added to each slot group. Dragging the handle calculates `Math.atan2(dy, dx)` from the group centre and updates the group's `rotation`. On `pointerup` on the handle the existing `slotMoved` output is reused, now carrying the current rotation:

```typescript
// slotMoved output extended:
readonly slotMoved = output<{
  slotId: string;
  offsetX: number;
  offsetY: number;
  angle: number;   // 0 when not rotated (composition editor receives 0 and ignores it)
}>();
```

Composition editor calls that already listen to `slotMoved` continue to work — they just ignore the `angle` field.

### 4.4 New frontend service — `SegmentDistributionService`

```typescript
getDistribution(eventId: string, segmentId: string): Observable<SegmentDistributionData>
saveDistribution(eventId: string, segmentId: string, items: InstanceDistributionDto[]): Observable<void>
clearDistribution(eventId: string, segmentId: string): Observable<void>
```

### 4.5 `segment-manager` — new "Distribueix" button

Added in the segment header row actions, between "Assigna" and "Projecta":

```html
@if (segment.instances.length > 1) {
  <button
    type="button"
    class="btn btn-ghost btn-xs gap-1 text-accent"
    (click)="navigateToDistribution(segment.id)"
    [attr.aria-label]="'Distribueix les figures del segment ' + displayName()(segment)"
  >
    <lucide-icon name="LayoutDashboard" [size]="14" />
    Distribueix
  </button>
}
```

Only shown when the segment has more than one instance. Badge/filled variant when a distribution is already set.

### 4.6 `ProjectionViewComponent` — use distribution if available

- Check `segmentData().hasDistribution`.
- If `true`: skip `computeProjectionLayout`; position each instance card at `(projectionX, projectionY)` with `transform: rotate(projectionAngle deg)` (absolute positioning within the projection container).
- If `false`: keep existing `computeProjectionLayout` path unchanged.

Tronc panel positioning (the separate draggable `troncPanelX/Y/Width/Height` rect) is deferred to Phase 5.

---

## 5. Implementation Phases

### Phase 1 — Backend: data model + API ✅ Done

- Added 5 new columns to `FigureInstance` (`projectionAngle`, `troncPanelX/Y/Width/Height`; `projectionX/Y` already existed).
- Migration `1782200000000-AddSegmentDistributionFields.ts`.
- `UpdateSegmentDistributionDto` / `InstanceDistributionDto`.
- `saveDistribution()`, `clearDistribution()`, `getDistribution()` in `FigureInstanceService`.
- `GET/PUT/DELETE :segmentId/distribution` endpoints in `EventSegmentController`.
- `ProjectionService.getProjection()` extended with distribution fields + `hasDistribution`.
- 30 new tests, all passing.

### Phase 2 — Frontend: canvas rotation + `SegmentDistributionService`

- Add `angle?: number` to `CompositionSlotWithNodes` in `FigureCanvasComponent`.
- Apply `rotation: slot.angle ?? 0` to slot Konva groups in `renderCompositionSlots()`.
- Add rotation handle per slot group; reuse `slotMoved` output extended with `angle`.
- Create `SegmentDistributionService` (3 HTTP methods: get / save / clear).
- Add frontend models: `SegmentDistributionData`, `DistributionItem` (in `distribution.model.ts`).
- Tests: `SegmentDistributionService` HTTP calls.

**Deliverable:** canvas supports rotation; service layer ready.

### Phase 3 — Frontend: `DistributionEditorComponent` + routing

- Create `DistributionEditorComponent` (copy of `CompositionEditorComponent`, stripped down):
  - No figure picker sidebar, no name/slug inputs, no z-order controls, no right panel.
  - Loads via `SegmentDistributionService.getDistribution()`.
  - Maps `DistributionItem[]` → `CompositionSlotWithNodes[]` (`instanceId` → `slotId`, `projectionX/Y` → `offsetX/Y`, `projectionAngle` → `angle`).
  - Auto-places in a row if no distribution set yet.
  - Wires `slotMoved` → local state update → 1 500 ms autosave debounce → `saveDistribution()`.
  - Top bar: back, segment name, save status, grid toggle, snap toggle, fit-all, "Esborra distribució" button.
- Register route `/pinyes/events/:eventId/segments/:segmentId/distribute` in `pinyes.routes.ts`.
- Add `navigateToDistribution(segmentId)` to `SegmentManagerComponent`.
- Add "Distribueix" button (only if `instances.length > 1`).
- Tests: editor load → auto-place, `slotMoved` → autosave debounce, clear flow.

**Deliverable:** users can open the editor, drag/rotate figures, layout is persisted.

### Phase 4 — Frontend: projection view integration

- Extend `ProjectionInstance` frontend model with `projectionAngle`, `hasDistribution`.
- Extend `ProjectionSegmentData` with `hasDistribution`.
- In `ProjectionViewComponent`: branch on `hasDistribution`:
  - `true`: position each instance at `(projectionX, projectionY)` with `transform: rotate(projectionAngle deg)` (CSS absolute positioning).
  - `false`: keep existing `computeProjectionLayout` path unchanged.
- Tests: projection model mapping, layout branch logic.

**Deliverable:** end-to-end — editor → save → projection renders custom positions.

### Phase 5 — Tronc panel positioning (deferred)

- Add separate draggable tronc panel rectangle per instance in the distribution canvas.
- Adds a `troncPanelMoved` output (new, separate from `slotMoved`).
- Stores and loads `troncPanelX/Y/Width/Height` via existing columns.
- Projection view renders tronc panel as absolutely-positioned `<div>` at stored coordinates instead of inline above the pinya canvas.

**Prerequisite:** Phases 1–4 complete.

---

## 6. Out of Scope (indefinitely)

- Tronc panel resize on canvas (drag corners to resize — deferred past Phase 5).
- Editing rotation numerically (drag-only for now).
- Per-instance scale (explicitly excluded — figures are natural size).
- Removing the compositions feature (planned but separate cleanup task).
