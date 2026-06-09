# P5.6 — Tronc Visualization & Assignment Design

**Date:** 2026-05-20
**Status:** Approved
**Scope:** Shared tronc visualization component (template editor + assignment), CSS Grid rendering, relative unit system, height variance per floor.

---

## 1. Problem Statement

The current tronc implementation is non-functional in the assignment screen — TRONC nodes are rendered at `(0,0)` on the pinya Konva canvas, making them invisible and unusable. The `TroncWidget` in the template editor uses a pill/list view that doesn't represent the actual physical structure of the tower. The `TroncAssignmentPanel` (WIP) is not wired into the assignment page.

The technical team needs to:
1. **See** the tronc structure as it looks in reality — floors stacked vertically, nodes positioned horizontally to show who stands on whom.
2. **Assign** people to tronc positions with height information per node and variance per floor, since height balance is critical for upper floors.
3. **Configure** the tronc topology in the template editor — how many nodes per floor, their horizontal position and width.

---

## 2. Core Concepts

### 2.1 Floor Structure

A tronc is a vertical stack of floors (pisos). Floor 1 (P1, `z=0`) is always **Bases** — the intersection between tronc and pinya (`zone: BASE`). Floors 2+ (`z≥1`) are `zone: TRONC`.

Each floor contains 1–7+ nodes. Each node represents one person position.

### 2.2 Relative Unit System

Node positioning within the tronc uses **relative units (u)** instead of pixel coordinates:

- **`width`** (integer 1–4): how many base units wide the node is. `1u` = one person width. `2u` = spanning two people below.
- **`x`** (integer, 0-based): horizontal start position in units.

The total grid width (`totalColumns`) is computed as `max(x + width)` across all tronc + base nodes.

**Example — Xopera (5 floors):**

```
P5: [x:1, w:1]                                      → 1 node
P4: [x:0, w:2]                                      → 1 node spanning 2
P3: [x:0, w:2] [x:2, w:2]                           → 2 nodes spanning 2 each
P2: [x:0, w:1] [x:1, w:1] [x:2, w:1] [x:3, w:1]    → 4 nodes
P1: [x:0, w:1] [x:1, w:1] [x:2, w:1] [x:3, w:1]    → 4 bases
```

**Example — Canya (asymmetric P2):**

```
P5: [x:1, w:1]
P4: [x:1, w:1]
P3: [x:0, w:2] [x:2, w:1]
P2: [x:0, w:1] [x:1, w:2] [x:3, w:1]
P1: [x:0, w:1] [x:1, w:1] [x:2, w:1] [x:3, w:1]
```

**Convention:** For `zone === TRONC` and `zone === BASE` nodes, `x` and `width` are relative units. For `zone === PINYA` nodes, `x`/`width` remain pixel coordinates for the Konva canvas (no change).

### 2.3 No New Database Columns

The `FigureNode` entity already has `x` (number) and `width` (number) fields. We reinterpret them as relative units for TRONC/BASE zones. No migration of the schema is needed — only a data migration to set existing nodes to meaningful values.

---

## 3. Component Design: `TroncViewComponent`

A single standalone Angular component, rendered with **CSS Grid**, reusable in both template editor and assignment screen.

### 3.1 Inputs

| Input | Type | Description |
|-------|------|-------------|
| `troncNodes` | `TroncNodeItem[]` | Nodes with `zone === TRONC` |
| `baseNodes` | `TroncNodeItem[]` | Nodes with `zone === BASE` (shown as P1) |
| `assignments` | `Map<string, AssignmentInfo>` | nodeId → person info (assignment mode only) |
| `selectedNodeId` | `string \| null` | Currently selected node |
| `mode` | `'editor' \| 'assignment'` | Operating mode |
| `heightMode` | `'relative' \| 'absolute'` | Height display mode (baseline 140cm) |
| `highlightedNodeIds` | `Set<string>` | Nodes to visually highlight |

`TroncNodeItem` is a subset of `FigureNodeItem` / `InstanceNodeItem` — only the fields needed for rendering: `id`, `label`, `zone`, `positionType`, `x`, `z`, `width`.

`AssignmentInfo` contains: `personAlias`, `shoulderHeight`, `attendanceStatus`.

### 3.2 Outputs

| Output | Type | Description |
|--------|------|-------------|
| `nodeSelected` | `string` | Node id clicked |
| `nodeClicked` | `{nodeId, event}` | For popover positioning (unassign) |
| `nodeUpdated` | `{nodeId, x, width}` | Position/width change (editor) |
| `nodeAdded` | `{z, positionType}` | New node on a floor (editor) |
| `nodeRemoved` | `string` | Node id removed (editor) |
| `floorAdded` | `{z, positionType}` | New floor added (editor) |
| `floorRemoved` | `number` | Floor z removed (editor) |

### 3.3 CSS Grid Rendering

The component renders a vertical stack of floor rows. Each floor is a CSS Grid where `grid-template-columns: repeat(totalColumns, 1fr)` and each node is placed with `grid-column: (x+1) / span width`.

```
┌──────────────────────────────────────────────────┐
│ Header: figure name + orientation toggle ↕       │
├────────┬──────────────────────────────┬───────────┤
│ P5     │ [node grid]                 │ Δ —       │
├────────┼──────────────────────────────┼───────────┤
│ P4     │ [node grid]                 │ Δ 2cm     │
├────────┼──────────────────────────────┼───────────┤
│ P3     │ [node grid]                 │ Δ 5cm     │
├────────┼──────────────────────────────┼───────────┤
│ P2     │ [node grid]                 │ Δ 3cm     │
├────────┼──────────────────────────────┼───────────┤
│ P1     │ [base node grid]            │ Δ 4cm     │
├────────┴──────────────────────────────┴───────────┤
│ [Editor controls — mode editor only]              │
└──────────────────────────────────────────────────┘
```

### 3.4 Orientation Toggle

A button toggles the visual order of floors:
- **Default (bottom-up):** P1 at bottom, highest floor at top (as built in reality).
- **Inverted (top-down):** P1 at top, highest floor at bottom.

This is a local UI state — no data change, no persistence.

### 3.5 Node Rendering States

Each node is a `<button>` element for native keyboard accessibility.

**Unassigned:**
- Shows node label (e.g., "Segon 1", "Alçadora")
- Neutral background (`btn-ghost` or similar)

**Assigned:**
- Person alias displayed prominently
- Height (relative `+5`/`-3` or absolute `145cm`) at top-left
- Attendance status icon at bottom-left (consistent with pinya nodes)
- Background tinted by assignment state

**Selected:**
- Primary border highlight (`ring-primary`)
- Triggers `PersonPanel` to filter/show available persons

**Editor mode:**
- Clicking a node selects it and shows its `x`/`width` in the editor controls below

### 3.6 Floor Variance Display

For each floor in assignment mode, show height variance at the right side:
- Computed as `max(shoulderHeight) - min(shoulderHeight)` for assigned nodes on that floor.
- `—` if fewer than 2 assigned nodes.
- Color-coded: green (≤2cm), yellow (3-4cm), red (≥5cm).
- Format: `Δ Xcm`.

### 3.7 Floor Progress

Each floor label shows assignment progress: `P3 · Terces (2/4)` — assigned count / total nodes.

---

## 4. Assignment Screen Integration

### 4.1 Layout Change

The assignment screen (`AssignmentCanvasComponent`) adopts a 3-column layout:

```
┌──────────────┬─────────────────────────┬──────────────┐
│  Tronc Panel │   FigureCanvas          │  PersonPanel │
│  (collapsible│   (pinya + bases only)  │              │
│   left panel)│                         │              │
└──────────────┴─────────────────────────┴──────────────┘
```

- **Left panel (tronc):** `TroncViewComponent` in `assignment` mode. Collapsible via toggle button.
- **Center:** `FigureCanvas` — filters out `zone === TRONC` nodes. Only renders PINYA, BASE, and direction zones.
- **Right panel (persons):** `PersonPanel` — shared between pinya and tronc. When a tronc node is selected, PersonPanel works the same way as for pinya nodes.

### 4.2 Selection Flow

1. User clicks a tronc node → `nodeSelected` fires → `selectedNodeId` updates.
2. `PersonPanel` reacts to the selection (same as pinya node selection).
3. User picks a person → assignment API call → node shows person info.
4. Clicking an assigned tronc node → popover appears (reuse pinya popover) with person info + "Desassignar" button.

### 4.3 Base Node Synchronization

Bases (`zone: BASE`) appear in both the tronc panel (as P1) and the pinya canvas. Selection is synchronized — selecting a base in either view highlights it in both and activates the PersonPanel.

### 4.4 No-Tronc Figures

If the figure has no TRONC nodes, the left panel shows an informational message: *"Aquesta figura no té tronc configurat. Pots crear-lo des de l'editor de plantilles."* The panel remains visible but does not block any functionality.

---

## 5. Template Editor Integration

### 5.1 Layout Change

The template editor (`TemplateEditorComponent`) replaces the floating `TroncWidget` with `TroncViewComponent` as a fixed left panel:

```
┌──────────────┬─────────────────────────┬──────────────┐
│  Tronc View  │   FigureCanvas          │  Properties  │
│  (editor)    │   (pinya + bases)       │  Panel       │
│              │                         │              │
│  [grid view] │                         │              │
│              │                         │              │
│  [editor     │                         │              │
│   controls]  │                         │              │
└──────────────┴─────────────────────────┴──────────────┘
```

### 5.2 Editor Controls (bottom section)

When a node is selected, the bottom area of the tronc panel shows:

- **Posició (x):** numeric input (0-based). Helper text: *"Posició horitzontal en unitats"*.
- **Amplada:** numeric input (1–4). Helper text: *"Amplada en unitats (1u = 1 persona)"*.
- **Eliminar node:** button to remove the selected node. If it's the last node on a floor, the entire floor is removed.

Floor/node management:
- **Afegir pis:** dropdown with available next floor types (Segon, Terç, Quart, Alçadora, Xiqueta) + button. Reuses existing `FLOOR_OPTIONS` logic.
- **Afegir node:** button to add a new node to the currently viewed/selected floor. Defaults to `x: nextAvailablePosition, width: 1`.
- **Afegir base / Treure base:** buttons to manage BASE nodes (synced with pinya canvas).

### 5.3 Replacing TroncWidget

The existing `TroncWidgetComponent` is **deleted**. All its functionality (floor management, base CRUD, node CRUD) is absorbed by `TroncViewComponent` in editor mode. The `FloorCanvasComponent` (WIP Konva mini-canvas) is also removed — no longer needed since we render with CSS Grid.

---

## 6. Cleanup: WIP Components

The following WIP components are **removed** as part of this work:

| Component | Reason |
|-----------|--------|
| `TroncWidgetComponent` | Replaced by `TroncViewComponent` |
| `TroncAssignmentPanelComponent` | Replaced by `TroncViewComponent` in assignment mode |
| `FloorCanvasComponent` | Not needed — CSS Grid replaces Konva for tronc |
| `floor-variance.util.ts` | Kept as a standalone pure utility, imported by `TroncViewComponent` |

---

## 7. Data Migration

### 7.1 Seed Updates

All figure seeds update TRONC and BASE nodes to use relative units:

**Before:**
```typescript
{ zone: 'TRONC', x: 0, y: 0, width: 60, height: 40 }
{ zone: 'BASE',  x: 0, y: 0, width: 60, height: 40 }
```

**After:**
```typescript
{ zone: 'TRONC', x: 0, y: 0, width: 1, height: 40 }
{ zone: 'BASE',  x: 0, y: 0, width: 1, height: 40 }
```

Seeds with multiple nodes per floor (when created) will have distinct `x` values.

### 7.2 Database Migration Script

A TypeORM migration normalizes existing data:

```sql
UPDATE figure_nodes
SET width = 1, x = 0
WHERE zone IN ('TRONC', 'BASE');

UPDATE instance_nodes
SET width = 1, x = 0
WHERE zone IN ('TRONC', 'BASE');
```

This is safe because all existing TRONC/BASE nodes have the generic `x: 0, width: 60` values.

---

## 8. Accessibility

- All tronc nodes are `<button>` elements — full keyboard navigation (Tab, Enter/Space to select).
- Floor labels use heading semantics for screen readers.
- Variance indicators include `aria-label` with full text (e.g., `aria-label="Variança d'alçada: 3 centímetres"`).
- Orientation toggle is a `<button>` with `aria-label="Invertir vista del tronc"`.
- Focus management: selecting a node moves focus to PersonPanel search (consistent with pinya behavior).
- Color-coded variance is supplemented with text — not color-only.

---

## 9. File Structure

```
apps/dashboard/src/app/features/pinyes/
├── components/
│   ├── tronc-view/                          # NEW — replaces tronc-widget + tronc-assignment-panel
│   │   ├── tronc-view.component.ts
│   │   ├── tronc-view.component.html
│   │   ├── tronc-view.component.scss
│   │   └── tronc-view.component.spec.ts
│   ├── tronc-widget/                        # DELETED
│   ├── tronc-assignment-panel/              # DELETED
│   ├── floor-canvas/                        # DELETED
│   ├── template-editor/                     # MODIFIED — uses tronc-view instead of tronc-widget
│   └── assignment-canvas/                   # MODIFIED — adds tronc-view left panel, filters pinya-only for canvas
├── utils/
│   └── floor-variance.util.ts              # KEPT — pure function for variance calculation, imported by TroncViewComponent
```

---

## 10. Out of Scope

- **Drag & drop** for repositioning nodes within floors — `x`/`width` are configured via numeric inputs.
- **Projection mode** (P5.7 future) — read-only public view of the tronc.
- **Spatial 2D layout per floor** — the previous `FloorCanvas` approach. The CSS Grid with `x`/`width` units is sufficient.
- **Pinya canvas changes** — beyond filtering out TRONC nodes, no pinya rendering changes.
- **Node `y` or `height` semantics for tronc** — `y` remains 0, `height` remains 40 (visual row height is CSS-controlled).

---

## 11. Invariants

1. Every figure SHOULD have tronc nodes, but the system does not enforce it — a warning message is shown instead.
2. A person can only be assigned to **one node** per figure instance and composition slot (existing constraint: `unique(figureInstance, person, compositionSlot)`). This prevents duplicate assignments across tronc and pinya.
3. BASE nodes appear in both tronc view (P1) and pinya canvas — selection is synchronized.
4. The orientation toggle is ephemeral — it does not persist.
5. `width` values for TRONC/BASE nodes are integers 1–4. `x` values are non-negative integers.
6. `totalColumns = max(x + width)` across all TRONC + BASE nodes in the figure.
