# Segment Distribution — Spec

> **Status:** Draft
> **Created:** 2026-06-27
> **Phases:** 4 (independently deployable)
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

Fullscreen canvas editor (uses `layoutService.requestFullscreen()`).

**Layout:** single-panel (no sidebars). Top bar with: back button, segment name, save status indicator, grid toggle, snap toggle, fit-all button, "Esborra distribució" (delete) button.

**Canvas:** `FigureCanvasComponent` in new `distribution` mode (see §4.3).

**Autosave:** debounced 1 500 ms after any move/rotate. Calls `PUT .../distribution`.

**"Esborra distribució":** confirmation dialog → calls `DELETE .../distribution` → navigates back.

**Initial positions:** on first open, if no distribution exists yet, figures are auto-placed in a horizontal row spaced by their bounding-box width + 50 px gap (as a starting point).

**Tronc panel:** each figure has a separate draggable semi-transparent blue rectangle on the canvas representing the tronc panel. If a figure has no tronc panel set yet, a default rectangle is shown at a fixed offset below the figure. Moving the tronc rectangle emits its new position.

### 4.3 `FigureCanvasComponent` — new `distribution` mode

New inputs:
```typescript
readonly distributionItems = input<DistributionCanvasItem[]>([]);
```

```typescript
interface DistributionCanvasItem {
  instanceId: string;
  label: string | null;
  nodes: FigureNodeItem[];           // pinya + base nodes only
  x: number;
  y: number;
  angle: number;
  troncPanel: { x: number; y: number; width: number; height: number } | null;
}
```

New outputs:
```typescript
readonly instanceMoved = output<{ instanceId: string; x: number; y: number; angle: number }>();
readonly troncPanelMoved = output<{ instanceId: string; x: number; y: number; width: number; height: number }>();
```

**Rendering (`distribution` mode):**
- Each `DistributionCanvasItem` is a Konva `Group` at `(x, y)` with `rotation: angle`.
- Draggable (drag emits `instanceMoved`).
- Rotatable via a small rotation handle (circle at top-center of the bounding rect); drag on the handle updates rotation and emits `instanceMoved`.
- Interior: same node rendering as `composition` mode (pinya + base nodes, read-only).
- Bounding rect + label like composition mode.
- Tronc panel: separate draggable Konva `Rect` (blue, semi-transparent, `listening: true`) at `(troncPanel.x, troncPanel.y)` with `(troncPanel.width × troncPanel.height)`. Drag emits `troncPanelMoved`. The tronc panel rect is NOT inside the figure group — it's a sibling so it can be positioned independently.

### 4.4 New frontend service — `SegmentDistributionService`

```typescript
getDistribution(eventId: string, segmentId: string): Observable<SegmentDistributionData>
saveDistribution(eventId: string, segmentId: string, items: InstanceDistributionDto[]): Observable<void>
clearDistribution(eventId: string, segmentId: string): Observable<void>
```

### 4.5 `segment-manager` — new "Distribueix" button

Added in the segment header row actions, between "Assigna" and "Projecta":

```html
<!-- Distribueix -->
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

Only shown when the segment has more than one instance (single-instance segments don't need a distribution).

Badge on the button when a distribution is already set (e.g. filled icon or accent color variant).

### 4.6 `ProjectionViewComponent` — use distribution if available

In `projection-view.component.ts`:

- Check `segmentData().hasDistribution`.
- If `true`: skip `computeProjectionLayout`; instead position each instance at `(distributionX, distributionY)` with `rotation: distributionAngle`. The projection canvas becomes a free-position absolute container (same as now) but with user-defined coordinates instead of auto-computed ones.
- The tronc panel for each figure is rendered as a separate absolutely-positioned `<div>` at `(troncPanelX, troncPanelY)` with the given width/height (contains `app-tronc-view`), rather than inline above the pinya canvas.
- If `hasDistribution === false`: keep the current auto-layout unchanged.

---

## 5. Implementation Phases

### Phase 1 — Backend: data model + API

- Add 7 columns to `FigureInstance` entity.
- Write TypeORM migration.
- Add `UpdateSegmentDistributionDto`, `InstanceDistributionDto` DTOs.
- Implement `saveDistribution()` and `clearDistribution()` in `FigureInstanceService` (or new `SegmentDistributionService` on the backend).
- Add the two new controller endpoints (`PUT` + `DELETE`) in `EventSegmentController`.
- Implement `getDistribution()` in `EventSegmentService` (returns instances with template nodes).
- Add `GET` endpoint in controller.
- Extend `ProjectionService.getProjection()` to include distribution fields + `hasDistribution`.
- Unit tests for new service methods.

**Deliverable:** all backend endpoints functional, tested, documented in Swagger.

### Phase 2 — Frontend: `distribution` canvas mode

- Add `distribution` mode to `FigureCanvasComponent`:
  - `distributionItems` input.
  - `instanceMoved` + `troncPanelMoved` outputs.
  - `renderDistributionItems()` private method (figure groups with rotation handle + tronc panel rect).
  - Hook into existing `renderAll()` dispatch.
- Add `SegmentDistributionService` frontend service.
- Add models (`SegmentDistributionData`, `DistributionItem`, `DistributionCanvasItem`).

**Deliverable:** canvas mode works in isolation (testable with hardcoded data).

### Phase 3 — Frontend: `DistributionEditorComponent` + routing

- Create `DistributionEditorComponent`:
  - Loads distribution data via `SegmentDistributionService`.
  - Auto-places figures if no distribution exists.
  - Wires `instanceMoved` / `troncPanelMoved` → local state update → autosave debounce.
  - Top bar with save status, grid/snap toggles, fit-all, "Esborra distribució" button.
- Register route `/pinyes/events/:eventId/segments/:segmentId/distribute`.
- Add `navigateToDistribution()` method to `SegmentManagerComponent`.
- Add "Distribueix" button to `segment-manager.component.html`.

**Deliverable:** users can open the editor, move figures, and the layout is persisted.

### Phase 4 — Frontend: projection view integration

- Extend `ProjectionInstance` frontend model with distribution fields.
- Extend `ProjectionSegmentData` frontend model with `hasDistribution`.
- In `ProjectionViewComponent`:
  - Branch on `hasDistribution`.
  - If `true`: render each figure at `(distributionX, distributionY)` with CSS `transform: rotate(distributionAngle deg)`.
  - Tronc panel: render as separate absolutely-positioned `<div>` using `troncPanelX/Y/Width/Height`.
  - If `false`: keep existing `computeProjectionLayout` path unchanged.
- Add "Esborra distribució" button in projection HUD (allows resetting to auto-layout from projection view).

**Deliverable:** full end-to-end feature working.

---

## 6. Out of Scope

- Editing the rotation numerically (only canvas drag for now).
- Tronc panel resize handles (size is set once via initial default; can be repositioned but not resized on canvas — resize via direct drag of panel corners could be a follow-up).
- Per-instance scale (explicitly excluded — figures are natural size).
- The compositions feature is left untouched; this feature does not delete or replace it yet.
