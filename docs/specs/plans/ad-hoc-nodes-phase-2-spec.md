# Ad-Hoc Instance Nodes — Phase 2 Specification

> **Status:** Implemented
> **Created:** 2026-06-10
> **Parent spec:** [`docs/specs/2026-06-10-ad-hoc-instance-nodes-design.md`](../2026-06-10-ad-hoc-instance-nodes-design.md)
> **Phase 1 plan:** [`docs/specs/plans/ad-hoc-nodes-phase-1-plan.md`](ad-hoc-nodes-phase-1-plan.md)
> **Branch:** `feat/ad-hoc-nodes-phase-2`
> **Scope:** Decorative elements (DECORATION zone) + projection rendering + ARROW/CIRCLE Konva shapes

---

## 1. Executive Summary

Phase 2 adds **DECORATION** nodes to the assignment canvas — non-assignable spatial/orientation elements (rectangles, arrows, circles) that replace the removed `ReferenceElement` concept. These elements mark landmarks (e.g. "Església"), indicate directions, or annotate the canvas for projection display.

Phase 1 already laid the groundwork: `FigureZone.DECORATION` exists in the DB enum, `NodeShape.ARROW` and `NodeShape.CIRCLE` exist, and the backend assignment guard rejects DECORATION nodes. Phase 2 **unlocks** DECORATION creation and implements the missing Konva shapes.

---

## 2. What Phase 1 Already Provides

| Item | Status |
|------|--------|
| `FigureZone.DECORATION` in PostgreSQL enum | Done (migration `1781200000000`) |
| `NodeShape.ARROW`, `NodeShape.CIRCLE` in PostgreSQL enum | Done |
| Backend `assign()` rejects `zone === DECORATION` → 400 | Done |
| `InstanceNode` entity: `isAdHoc`, `createdById` columns | Done |
| Ad-hoc CRUD endpoints (POST/PATCH/DELETE) | Done |
| `AssignmentStateService` placement mode signals | Done |
| FAB button + placement flow | Done (PINYA presets only) |
| Move/resize/rotate via Konva Transformer | Done |
| Bulk import clones ad-hoc nodes (idempotent via `originNodeId`) | Done |
| Dashed border for ad-hoc nodes | Done |

---

## 3. Phase 2 Scope — What Changes

### 3.1 Shared Library (`libs/shared`)

**New constants** in `constants/ad-hoc-node.constants.ts`:

```typescript
export const DECORATION_POSITION_TYPES = ['rectangle', 'arrow', 'circle'] as const;
export type DecorationPositionType = typeof DECORATION_POSITION_TYPES[number];

export const AD_HOC_ALLOWED_ZONES_PHASE2 = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
] as const;

export const AD_HOC_DECORATION_PRESETS: AdHocNodePreset[] = [
  { zone: FigureZone.DECORATION, positionType: 'rectangle', label: '',  width: 120, height: 80, shape: NodeShape.RECTANGLE, color: '#999999', requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'arrow',     label: '',  width: 80,  height: 30, shape: NodeShape.ARROW,     color: '#999999', requiresCustomLabel: true },
  { zone: FigureZone.DECORATION, positionType: 'circle',    label: '',  width: 60,  height: 60, shape: NodeShape.CIRCLE,    color: '#999999', requiresCustomLabel: true },
];
```

All DECORATION presets have `requiresCustomLabel: true` — the user must provide a label (e.g. "Església", "Nord", "Escenari").

### 3.2 Backend — DTO Zone Whitelist

`CreateAdHocNodeDto`:
- Change `@IsIn([...AD_HOC_ALLOWED_ZONES_PHASE1])` → `@IsIn([...AD_HOC_ALLOWED_ZONES_PHASE2])`
- `positionType` validation must support both PINYA and DECORATION types:
  - When `zone === PINYA` → validate against `PINYA_POSITION_TYPES`
  - When `zone === DECORATION` → validate against `DECORATION_POSITION_TYPES`
  - Use a custom class-validator decorator or conditional validation

### 3.3 Backend — Preset Lookup

`createAdHocNode()` currently only searches `AD_HOC_PINYA_PRESETS`. Extend to also search `AD_HOC_DECORATION_PRESETS` (or unify into a single `AD_HOC_ALL_PRESETS` map keyed by `zone:positionType`).

### 3.4 Frontend — FAB Menu Categories

The "+" menu gains a second category section:

```
── Pinya ──────────────────
  Agulla
  Mans
  Laterals
  Vents
  Cordó obert
  Tap
  Crossa
  Contrafort
  Comodí (etiqueta lliure)
── Decoratiu ──────────────
  Rectangle (etiqueta lliure)
  Fletxa (etiqueta lliure)
  Cercle (etiqueta lliure)
```

All three DECORATION presets require label input (same comodín flow).

### 3.5 Frontend — Konva ARROW Shape

New Konva rendering for `NodeShape.ARROW` — a directional polygon/path:

```
     ◀──────▶ width
  ┌──────────────▶    ▲
  │  ╲                │ height
  │    ▶              │
  │  ╱                │
  └──────────────▶    ▼
```

Implementation: `Konva.Line` with `closed: true` and arrow-head points, or `Konva.Arrow` (simpler). The arrow direction is controlled by the node's `rotation`.

### 3.6 Frontend — Konva CIRCLE Shape

`NodeShape.CIRCLE` renders as `Konva.Ellipse` with equal `radiusX = radiusY = width/2`. When `width !== height`, it still uses an ellipse (the circle preset sets `width = height = 60`).

### 3.7 Frontend — DECORATION Visual Style

In **assignment mode** (`renderAssignmentNodes`):
- Fill: transparent (stroke-only)
- Stroke: `node.color` (default `#999999`)
- Stroke width: 2
- Opacity: 0.6
- Dash: `[6, 3]` for ad-hoc (same as PINYA ad-hoc), solid for any future template-sourced DECORATION
- Label: centered inside the shape, same color as stroke

In **readonly/projection mode** (`renderReadonlyNodes`):
- Fill: transparent (stroke-only)
- Stroke: `node.color`
- Stroke width: 2
- Opacity: 0.4
- No person badge (never assigned)
- Label: centered inside

### 3.8 Frontend — DECORATION Interaction Model

DECORATION nodes must be:
- **Movable** (drag) ✅ — same as PINYA ad-hoc
- **Resizable/rotatable** (double-click transformer) ✅ — same as PINYA ad-hoc
- **Deletable** (Backspace) ✅ — immediate, no confirmation (never assigned)
- **NOT selectable for assignment** ❌ — clicking a DECORATION node does NOT trigger `nodeSelected.emit()`

Implementation: in `renderAssignmentNodes()`, when `isAdHoc && zone === DECORATION`:
- `group.draggable = true` (move)
- Double-click → transformer (resize/rotate)
- Single click → NO `nodeSelected.emit()`, NO `nodeClicked.emit()`
- No tooltip "Node creat manualment" — instead show label

### 3.9 Projection View

Phase 1 PINYA ad-hoc nodes already render in projection (verified: `renderReadonlyNodes` processes all non-TRONC nodes, no zone filter excludes DECORATION). Phase 2 adds:

- DECORATION-specific rendering in `renderReadonlyNodes()` (stroke-only, opacity 0.4)
- ARROW and CIRCLE shape branches (currently only ELLIPSE vs RECT)
- No interaction (readonly mode is already non-interactive)

### 3.10 L2 Enum Divergence — Not Blocking

The code review L2 note about `figure_nodes` potentially using separate enum types (`figure_nodes_zone_enum`) is irrelevant for Phase 2: DECORATION nodes only exist on `instance_nodes`. Template-editor DECORATION support is Phase 4. Track the audit in Phase 4 plan.

---

## 4. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Assign person to DECORATION node (API) | 400 "Els nodes decoratius no es poden assignar." (Phase 1 guard) |
| Click DECORATION node in assignment mode | No selection, no assignment popover |
| Delete DECORATION node | Immediate delete (no assignment → no confirmation needed) |
| Bulk import with DECORATION nodes | Cloned to target (no assignments to copy) |
| Reset instance with DECORATION nodes | Deleted along with everything else |
| DECORATION node in projection | Stroke-only outline, label centered, opacity 0.4 |
| DECORATION `positionType` not provided | 400 validation error (required for DECORATION zone) |
| DECORATION with empty label | 400 validation error (all DECORATION presets require label) |

---

## 5. Invariants

1. **DECORATION zone is never assignable** — enforced backend (400) + frontend (no selection emit).
2. **Snapshot nodes remain read-only** — unchanged from Phase 1.
3. **Template isolation** — ad-hoc DECORATION nodes are instance-scoped; template save never touches them.
4. **Phase 1 behavior unchanged** — PINYA ad-hoc nodes work identically.

---

## 6. Manual Testing Checklist — Phase 2

> Full detailed checklist with file references: see the implementation plan at `docs/specs/plans/ad-hoc-nodes-phase-2-plan.md`

### D1 — FAB Menu: Decoration Category

| # | Test | Expected |
|---|------|----------|
| D1.1 | Click FAB "+" button | Menu shows "Pinya" (9 presets) + "Decoratiu" (Rectangle, Fletxa, Cercle) |
| D1.2 | Select "Rectangle" from Decoratiu | Label dialog: "Etiqueta del node decoratiu" |
| D1.3 | Type "Església" → confirm → click canvas | Rectangle: stroke-only, 0.6 opacity, label centered |
| D1.4 | Select "Fletxa" → "Nord" → place | Arrow shape, stroke-only |
| D1.5 | Select "Cercle" → "Pilar" → place | Circle, stroke-only, label centered |
| D1.6 | Submit with empty label | Button disabled |
| D1.7 | Select comodin after decorations | Dialog title reverts to "Etiqueta del comodí" |

### D2 — DECORATION Visual & Interaction

| # | Test | Expected |
|---|------|----------|
| D2.1 | Click DECORATION node | Selected + properties panel, NO assignment popover |
| D2.2 | Person selected → click DECORATION | No assignment (guard blocks) |
| D2.3 | Assign via API (curl) | 400 "Els nodes decoratius no es poden assignar" |
| D2.4 | Drag DECORATION | Moves, PATCH on release |
| D2.5 | Double-click → resize/rotate | Transformer handles, PATCH on release |
| D2.6 | Delete (keyboard) | Immediate delete, no confirmation |
| D2.7 | Arrow keys | Moves 1px / 10px with Shift |
| D2.8 | Visual check | `#999999` stroke, transparent fill, 0.6 opacity |

### D3 — Properties Panel

| # | Test | Expected |
|---|------|----------|
| D3.1 | Select DECORATION → panel | Shows label, shape (4 options), dims, rotation, position, color |
| D3.2 | Change shape to Fletxa | Arrow shape on canvas |
| D3.3 | Change shape to Cercle | Circle shape on canvas |
| D3.4 | Change color | Stroke color changes |
| D3.5 | Trash icon | Immediate delete |

### D4 — Projection

| # | Test | Expected |
|---|------|----------|
| D4.1 | Projection with PINYA ad-hoc + DECORATION | PINYA: solid + badge. DECORATION: stroke-only, 0.4 opacity |
| D4.2 | Fullscreen projection | Correct scale, label readable |
| D4.3 | ARROW shape in projection | Arrow polygon, correct rotation |

### D5 — Import & Reset

| # | Test | Expected |
|---|------|----------|
| D5.1 | Import from instance with DECORATION | Cloned, no conflict entries |
| D5.2 | Re-import same source | Idempotent, no duplicates |
| D5.3 | Reset with DECORATION + PINYA | Warning shows count. All removed. |

### D6 — Phase 1 Regression

| # | Test | Expected |
|---|------|----------|
| D6.1 | Create PINYA ad-hoc | Dashed border, selectable, assignable |
| D6.2 | Assign person to PINYA ad-hoc | Works |
| D6.3 | Comodin label flow | "Etiqueta del comodí" dialog |
| D6.4 | Keyboard shortcuts | Unchanged |
