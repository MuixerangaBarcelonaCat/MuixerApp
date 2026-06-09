# P5.2.1 — Composition Editor: Corrections & Improvements

> **Date**: 10 May 2026
> **Status**: Approved
> **Depends on**: P5.2 (Compositions)
> **Parent spec**: `docs/specs/2026-05-08-p5-2-compositions-design.md`

---

## 1. Objective

Fix critical interaction bugs in the Composition Editor canvas and add UX improvements for multi-figure management: selection/drag, visibility of new slots, z-index stacking, 50% scale rendering, and a "fit all" viewport control.

---

## 2. Bug Fixes

### 2.1. Slot groups are not clickable or draggable

**Root cause**: In `renderCompositionSlots()`, every child of `slotGroup` (bounding Rect, label Text, node Groups) is created with `listening: false`. Konva Groups have no hit area of their own — they rely on children for hit detection. When all children ignore events, clicks pass through the group entirely and reach the Stage.

**Consequences**:
- `slotGroup.on('click tap')` never fires → selection broken → right panel stays empty.
- Drag never starts because there is no hit target on the group.
- The Stage receives the click and activates panning instead.

**Fix**: Set `listening: true` on the bounding Rect (remove `listening: false`). This makes it the hit area for the entire slot group. All other children (label Text, node Groups) remain `listening: false` so they don't interfere with group-level drag.

**File**: `figure-canvas.component.ts` → `renderCompositionSlots()`.

### 2.2. Left-click panning conflicts with composition mode

**Root cause**: `setupStageInteraction()` activates left-click panning when `!this.selectedNodeId()`. In composition mode `selectedNodeId` is always `null` (unused), so panning activates whenever clicking on the Stage background.

While fixing 2.1 makes slot clicks reach the group instead of the stage, an explicit guard is still needed: left-click pan on empty stage should check `selectedSlotId` in composition mode.

**Fix**: In the `mousedown` handler, replace the `noNodeSelected` check with a mode-aware condition:

```
const noSelection = this.mode() === 'composition'
  ? !this.selectedSlotId()
  : !this.selectedNodeId();
```

This ensures left-click pan only activates when nothing is selected in the current mode.

**File**: `figure-canvas.component.ts` → `setupStageInteraction()`.

### 2.3. Cursor `grab` hint missing in composition mode

**Root cause**: The hover cursor logic only applies `grab` when `mode() === 'editor'`.

**Fix**: Extend the condition to `mode() === 'editor' || mode() === 'composition'`.

**File**: `figure-canvas.component.ts` → `setupStageInteraction()` mousemove handler.

---

## 3. Improvements

### 3.1. Placeholder for slots without nodes

**Problem**: `doAddFigure()` creates a slot with `nodes: []`. `renderCompositionSlots()` has `if (pinyaNodes.length === 0) continue;` — the slot is invisible until the API save response returns full node data.

**Solution**: When a slot has zero PINYA/BASE nodes, render a placeholder instead of skipping:

- Dashed rectangle (120×80px logical size, before scaling) with subtle fill.
- Centered text: figure template name.
- Secondary text below: "Carregant..." in muted style.
- The placeholder group is `draggable: true`, `listening: true` on the rect — same interaction as a real slot (selectable, movable).
- When the save response arrives and `compositionSlots` recomputes with real nodes, the placeholder is replaced by normal rendering.

**File**: `figure-canvas.component.ts` → `renderCompositionSlots()`.

### 3.2. Immediate save on figure add

**Problem**: Adding a figure triggers a 2s debounced save. Combined with empty nodes, the figure is invisible for 2+ seconds.

**Solution**: `addFigure()` calls `saveImmediately()` instead of `scheduleSave()` for all cases (not just new compositions). The existing `saveImmediately` pattern already handles this; the debounce in `doAddFigure` is removed and `addFigure` always finishes with an immediate save.

**File**: `composition-editor.component.ts` → `addFigure()` / `doAddFigure()`.

### 3.3. Incremental offset for new figures

**Problem**: All new figures are placed at `(0, 0)`, stacking on top of each other.

**Solution**: `doAddFigure()` calculates `offsetX = numberOfExistingSlots * 200`, `offsetY = 0`. First figure at (0,0), second at (200,0), third at (400,0), etc. The user repositions manually from there.

**File**: `composition-editor.component.ts` → `doAddFigure()`.

### 3.4. 50% scale rendering in composition mode

**Problem**: Figures render at 1:1 scale (same as the single-figure template editor). Multiple figures quickly overflow the canvas viewport.

**Solution**: Each `slotGroup` in `renderCompositionSlots()` is created with `scaleX: 0.5, scaleY: 0.5`. This halves the visual size of all shapes, labels, and bounding boxes. The offset coordinates (`offsetX`, `offsetY`) remain unscaled — the scale is purely visual within the Konva group.

Snap-to-grid operates on the group position (unaffected by internal scale). The bounding box calculation for the placeholder (slots without nodes) uses a fixed logical size of 120×80px (renders as 60×40px at 50%).

**Constant**: Define `COMPOSITION_SLOT_SCALE = 0.5` at module level for clarity.

**File**: `figure-canvas.component.ts` → `renderCompositionSlots()`.

### 3.5. "Fit all" button

**Problem**: No easy way to see all figures at once after adding/moving. The existing "Ajusta a la pantalla" resets to zoom 1 and position (0,0) which doesn't account for figure positions.

**Solution**:

**New method `fitAllSlots()` on `FigureCanvasComponent`**:
1. Iterates all slot groups on `pinyaLayer`, computes the global bounding box (union of all group client rects, accounting for scale).
2. Calculates the zoom level that fits the bounding box within the stage dimensions, with 40px padding on all sides.
3. Caps maximum zoom at 2 (don't over-zoom when few/small figures).
4. Sets `stage.scale()` and `stage.position()` to center the bounding box.
5. Updates `zoomLevel` signal.
6. If no slots exist, delegates to `fitToScreen()` (reset).

**New button in composition editor toolbar** (next to Graella / Ajusta):
- Icon: `Maximize2` from Lucide.
- Label: "Enquadrar".
- `aria-label`: "Enquadrar totes les figures".
- Calls `fitAllSlots()` on the canvas via `@ViewChild`.

**Files**:
- `figure-canvas.component.ts` — new public method `fitAllSlots()`.
- `composition-editor.component.ts` — `@ViewChild(FigureCanvasComponent)`, handler method.
- `composition-editor.component.html` — new button in toolbar.

### 3.6. Z-index stacking with sortOrder

**Problem**: Slot draw order follows the array position, not `sortOrder`. No UI to change stacking when figures overlap.

**Solution**:

**Canvas rendering**: `renderCompositionSlots()` sorts `compositionSlots()` by `sortOrder` ascending before iterating. Lower `sortOrder` = painted first = behind. Higher `sortOrder` = painted last = in front.

**Right panel controls**: Two new buttons in the selected slot properties panel, placed between Offset Y and the separator:

- **"Porta al davant"** (icon `ArrowUp`): Swaps `sortOrder` of the selected slot with the slot that has the next higher `sortOrder`. Disabled when the slot already has the highest `sortOrder`.
- **"Porta al darrere"** (icon `ArrowDown`): Swaps `sortOrder` with the slot that has the next lower `sortOrder`. Disabled when the slot already has the lowest `sortOrder`.

Each swap updates `composition.slots`, triggers canvas re-render, and schedules autosave.

**Sort order on add**: `doAddFigure()` assigns `sortOrder = Math.max(...existingSortOrders) + 1` (or 0 for the first slot). New figures always appear on top.

**Files**:
- `composition-editor.component.ts` — `bringForward()`, `sendBackward()` methods, updated `doAddFigure()`.
- `composition-editor.component.html` — z-order buttons.
- `figure-canvas.component.ts` — sort before render.

---

## 4. Files Modified

| File | Changes |
|------|---------|
| `apps/dashboard/.../figure-canvas/figure-canvas.component.ts` | Bounding rect `listening: true`; mode-aware panning guard; cursor hint for composition; placeholder rendering for empty slots; `scaleX/Y: 0.5` on slot groups; sort by `sortOrder`; new `fitAllSlots()` method |
| `apps/dashboard/.../composition-editor/composition-editor.component.ts` | `@ViewChild` for canvas; immediate save on add; incremental offset; `sortOrder` assignment; `bringForward()` / `sendBackward()` methods; `fitAll()` handler |
| `apps/dashboard/.../composition-editor/composition-editor.component.html` | "Enquadrar" button in toolbar; z-order buttons in right panel |

No API changes. No database changes. No new files.

---

## 5. Out of Scope

| Feature | Phase |
|---------|-------|
| Per-slot configurable scale (user-adjustable beyond 50%) | Deferred |
| Context menu on canvas (right-click) | Deferred |
| Keyboard shortcuts for composition editor (copy/paste slots, arrow nudge) | Deferred |
| Wheel zoom on canvas | Deferred (documented in P5.1 but not yet implemented) |
| Auto-fit on add (automatic instead of button) | Decided against — manual "Enquadrar" button preferred |
