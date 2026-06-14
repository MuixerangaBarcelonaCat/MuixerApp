# Ad-Hoc Instance Nodes — Phase 3 Specification

> **Status:** Implemented (Revised)
> **Created:** 2026-06-11
> **Revised:** 2026-06-11
> **Parent spec:** [`docs/specs/2026-06-10-ad-hoc-instance-nodes-design.md`](../2026-06-10-ad-hoc-instance-nodes-design.md)
> **Phase 2 spec:** [`docs/specs/plans/ad-hoc-nodes-phase-2-spec.md`](ad-hoc-nodes-phase-2-spec.md)
> **Branch:** `feat/ad-hoc-nodes-phase-3`
> **Scope:** Direction nodes (FIGURE_DIRECTION, XICALLA_DIRECTION) as ad-hoc assignable positions; UX redesign (split FAB); swap fix; decoration assignment guard

---

## 1. Executive Summary

Phase 3 extends the ad-hoc node system to support `FIGURE_DIRECTION` and `XICALLA_DIRECTION` zones — **assignable** positions indicating figure/xicalla orientation. Direction nodes can exist in multiple instances within the same segment; the existing segment-level **person uniqueness** constraint (a person cannot be assigned twice in the same segment) is the only restriction.

Additionally: FAB menu split into 3 independent buttons, swap assignment bug fix, decoration assignment frontend guard, and shape change from ARROW to RECTANGLE for direction nodes.

---

## 2. What Phase 2 Already Provides

| Item | Status |
|------|--------|
| `FigureZone.FIGURE_DIRECTION`, `XICALLA_DIRECTION` in PostgreSQL enum | Done (original migration) |
| `NodeShape.ARROW` rendering in Konva (`createNodeShape`) | Done (Phase 2) |
| Template editor: direction nodes created via zone dropdown | Done |
| Assignment canvas: template direction nodes are assignable | Done |
| Ad-hoc CRUD endpoints (POST/PATCH/DELETE) | Done (Phase 1) |
| Dashed border for `isAdHoc` nodes | Done (Phase 1) |
| FAB + placement mode | Done (Phase 1) |
| Bulk import clones ad-hoc nodes (idempotent via `originNodeId`) | Done (Phase 1) |
| Properties panel for ad-hoc nodes | Done (Phase 2) |
| Assignment guard: `zone === DECORATION` → 400 | Done (Phase 1) |

---

## 3. Phase 3 Scope — What Changes

### 3.1 Shared Library (`libs/shared`)

**New constants** in `constants/ad-hoc-node.constants.ts`:

```typescript
export const AD_HOC_ALLOWED_ZONES_PHASE3 = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

export const DIRECTION_ZONES = [
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

export const AD_HOC_DIRECTION_PRESETS: AdHocNodePreset[] = [
  { zone: FigureZone.FIGURE_DIRECTION, positionType: null, label: 'Direcció fig.', width: 90, height: 44, shape: NodeShape.RECTANGLE, color: '#d97706', requiresCustomLabel: false },
  { zone: FigureZone.XICALLA_DIRECTION, positionType: null, label: 'Direcció xic.', width: 90, height: 44, shape: NodeShape.RECTANGLE, color: '#db2777', requiresCustomLabel: false },
];
```

Key design choices:
- `positionType: null` — directions have no subtypes (unlike PINYA/DECORATION)
- `requiresCustomLabel: false` — fixed default labels, no user input needed
- `shape: NodeShape.RECTANGLE` — better hit detection and visually distinct with bold colors
- Colors `#d97706` (amber-600) / `#db2777` (pink-600) — vibrant, high contrast, gives importance
- Size `90×44` — slightly larger than pinya nodes for visual prominence

### 3.2 Backend — DTO Zone Whitelist

`CreateAdHocNodeDto`:
- Change `@IsIn([...AD_HOC_ALLOWED_ZONES_PHASE2])` → `@IsIn([...AD_HOC_ALLOWED_ZONES_PHASE3])`
- Extend `IsValidPositionTypeConstraint`: direction zones → `positionType` must be `null`/`undefined`

```typescript
if ((DIRECTION_ZONES as readonly FigureZone[]).includes(obj.zone)) {
  return !positionType;
}
```

### 3.3 Backend — No Segment-Level Node Uniqueness

Direction nodes **can exist in multiple instances** within the same segment. There is no restriction on how many direction nodes can be created per segment.

The **only constraint** is person uniqueness: a person cannot be assigned twice in the same segment. This was already implemented in the `assign()` method's segment-wide person conflict check — no additional backend logic required.

### 3.4 Backend — Preset Lookup

`createAdHocNode()`: extend `allPresets` to include `AD_HOC_DIRECTION_PRESETS`:

```typescript
const allPresets = [...AD_HOC_PINYA_PRESETS, ...AD_HOC_DECORATION_PRESETS, ...AD_HOC_DIRECTION_PRESETS];
```

### 3.5 Backend — Bulk Import

No special handling for direction nodes during bulk import. They're cloned like any other ad-hoc node, with the existing idempotent check via `originNodeId`. Person assignment during clone is subject to the standard segment-wide person conflict check.

### 3.6 Backend — Swap Assignment Fix

The original `CASE WHEN` UPDATE caused `UQ_node_assignments_instance_person` violation because PostgreSQL evaluates uniqueness constraints per-row within a single statement.

**Fix:** Delete both assignments, then recreate with swapped persons in a single transaction:

```typescript
await this.dataSource.transaction(async (manager) => {
  await manager.delete(NodeAssignment, { id: dto.assignmentIdA });
  await manager.delete(NodeAssignment, { id: dto.assignmentIdB });

  const newA = manager.create(NodeAssignment, {
    id: dto.assignmentIdA,
    figureInstance: assignmentA.figureInstance,
    instanceNode: assignmentA.instanceNode,
    person: assignmentB.person,
    compositionSlot: assignmentA.compositionSlot,
  });
  const newB = manager.create(NodeAssignment, {
    id: dto.assignmentIdB,
    figureInstance: assignmentB.figureInstance,
    instanceNode: assignmentB.instanceNode,
    person: assignmentA.person,
    compositionSlot: assignmentB.compositionSlot,
  });

  await manager.save(NodeAssignment, [newA, newB]);
});
```

Preserves original assignment IDs for frontend consistency.

### 3.7 Frontend — Split FAB into 3 Buttons

Replaces single FAB dropdown with 3 independent buttons:

```
[Ajuda] [Dir] [Dec] [+]
                         ← Pinya (primary, blue)
              ← Decoratiu (grey)
       ← Direccions (amber)
```

Each button has its own dropdown:
- **Pinya** (`btn-primary`): 9 position types
- **Decoratiu** (grey): 3 shapes (Rectangle, Fletxa, Cercle)
- **Direccions** (amber): 2 entries (Direcció fig., Direcció xic.)

### 3.8 Frontend — Canvas Rendering

Direction nodes get **distinctive visual treatment**:
- `strokeWidth: 2.5` (vs 1.5 for pinya) — thicker border for emphasis
- Colors: `#d97706` (FIGURE_DIRECTION), `#db2777` (XICALLA_DIRECTION)
- Shape: `RECTANGLE` with `cornerRadius: 4`
- Dashed border for ad-hoc, solid for template-sourced

### 3.9 Frontend — Decoration Assignment Guard

Frontend prevents assignment to DECORATION nodes in `onPersonSelected`:
- If selected node is DECORATION zone → toast "Els nodes decoratius no es poden assignar." and return
- Backend guard remains as fallback

### 3.10 Frontend — Properties Panel

Added `isDirection` computed signal:
- Shows info alert: "La mateixa persona no pot repetir-se al segment (entre totes les instàncies)."
- All standard fields editable (label, shape, dimensions, rotation, position, color)

### 3.11 Frontend — Help Modal

"Nodes de Direcció" section:
- Explains assignability
- Lists FIGURE_DIRECTION / XICALLA_DIRECTION purposes
- Mentions person uniqueness constraint

---

## 4. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Create FIGURE_DIRECTION ad-hoc (first in instance) | Success, RECTANGLE shape, dashed border, amber color |
| Create second FIGURE_DIRECTION in same instance | Allowed (no node-level uniqueness) |
| Create FIGURE_DIRECTION in instance B (same segment) | Allowed |
| Assign same person to two direction nodes in segment | Blocked by existing segment person uniqueness |
| Template has FIGURE_DIRECTION → create ad-hoc | Allowed |
| Assign person to direction ad-hoc node | Works normally (not DECORATION) |
| Assign person to DECORATION ad-hoc node | Blocked frontend (toast) + backend (400) |
| Drag direction ad-hoc node | Moves, PATCH on release |
| Arrow keys on selected direction ad-hoc | Moves 1px (shift: 10px) |
| Delete direction ad-hoc with assignment | Confirmation dialog, then cascade delete |
| Swap two assigned nodes | Delete + recreate in transaction (no unique violation) |
| Bulk import: source has ad-hoc direction | Cloned normally |
| Reset instance with direction ad-hoc | Deleted with everything else |

---

## 5. Invariants

1. **Person uniqueness per segment** — the only constraint; a person cannot be assigned twice in the same segment (regardless of node type).
2. **Direction nodes are assignable** — unlike DECORATION, no assignment guard blocks them.
3. **No node-level uniqueness** — multiple direction nodes of the same type can coexist per instance and per segment.
4. **Snapshot nodes remain read-only** — unchanged from Phase 1.
5. **DECORATION never assignable** — frontend + backend double-guard.
6. **Swap is safe** — uses delete+recreate in transaction to avoid unique constraint violations.
7. **Phase 1 + Phase 2 behavior unchanged** — PINYA and DECORATION ad-hoc nodes work identically.

---

## 6. Manual Testing Checklist — Phase 3

### DIR1 — FAB Menu: Split Buttons

| # | Test | Expected |
|---|------|----------|
| DIR1.1 | Click Pinya FAB (blue "+") | Shows 9 pinya presets |
| DIR1.2 | Click Decoratiu FAB ("Dec") | Shows 3 decoration shapes |
| DIR1.3 | Click Directions FAB ("Dir") | Shows 2 direction entries |
| DIR1.4 | Select "Direcció fig." | Enters placement mode directly (no label dialog) |
| DIR1.5 | Click on canvas | RECTANGLE node created: dashed border, color `#d97706`, label "Direcció fig." |
| DIR1.6 | Select "Direcció xic." → place | RECTANGLE node: color `#db2777`, size 90×44, label "Direcció xic." |
| DIR1.7 | Press Escape during placement | Cancelled, cursor normal |
| DIR1.8 | Escape closes any open FAB dropdown | Dropdown closes |

### DIR2 — Assignment

| # | Test | Expected |
|---|------|----------|
| DIR2.1 | Click direction node → select person in panel | Assignment created, name shows |
| DIR2.2 | Assign same person to another node in segment | Conflict: person already in segment |
| DIR2.3 | Swap between direction node and pinya node | Works correctly (no duplicate key error) |
| DIR2.4 | Click DECORATION node → select person | Toast: "Els nodes decoratius no es poden assignar." |

### DIR3 — Multiple Direction Nodes

| # | Test | Expected |
|---|------|----------|
| DIR3.1 | Create "Direcció fig." in instance A | Created successfully |
| DIR3.2 | Create second "Direcció fig." in same instance A | Allowed |
| DIR3.3 | Create "Direcció fig." in instance B (same segment) | Allowed |
| DIR3.4 | Assign different persons to each | All succeed |
| DIR3.5 | Assign same person to two of them | Blocked (person uniqueness) |

### DIR4 — Canvas Interaction

| # | Test | Expected |
|---|------|----------|
| DIR4.1 | Drag direction ad-hoc node | Moves, PATCH on release |
| DIR4.2 | Arrow keys (selected) | Moves 1px per press |
| DIR4.3 | Shift+Arrow keys | Moves 10px per press |
| DIR4.4 | Double-click → resize/rotate | Transformer handles, PATCH on release |
| DIR4.5 | Backspace (no assignment) | Immediate delete |
| DIR4.6 | Backspace (with assignment) | Confirmation dialog, then delete |
| DIR4.7 | Drag template direction node (snapshot) | Not draggable |

### DIR5 — Properties Panel

| # | Test | Expected |
|---|------|----------|
| DIR5.1 | Select direction ad-hoc node | Panel shows person uniqueness info + all fields |
| DIR5.2 | Change label to "Cap a l'altar" | Saved (PATCH debounced) |
| DIR5.3 | Change shape to Arrow | Shape updates on canvas |
| DIR5.4 | Rotate via slider | Node rotates |
| DIR5.5 | Change color | Updated on canvas |
| DIR5.6 | Delete via trash icon | Node deleted |

### DIR6 — Import & Reset

| # | Test | Expected |
|---|------|----------|
| DIR6.1 | Import from instance with ad-hoc direction | Cloned to target |
| DIR6.2 | Re-import (same origin) | Idempotent via originNodeId |
| DIR6.3 | Import direction with assignment | Cloned with assignment (if person free) |
| DIR6.4 | Reset with direction ad-hoc nodes | Warning count includes them, all removed |

### DIR7 — Phase 1 + 2 Regression

| # | Test | Expected |
|---|------|----------|
| DIR7.1 | Create PINYA ad-hoc (Cordó obert) | Works as before |
| DIR7.2 | Create DECORATION (Rectangle) | Works, non-assignable |
| DIR7.3 | Comodin label flow | Dialog appears |
| DIR7.4 | Locked event → FAB buttons | Disabled/hidden |
| DIR7.5 | Swap any two assigned nodes | No duplicate key error |

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `libs/shared/src/constants/ad-hoc-node.constants.ts` | Add `AD_HOC_ALLOWED_ZONES_PHASE3`, `DIRECTION_ZONES`, `AD_HOC_DIRECTION_PRESETS` (RECTANGLE shape, amber/pink) |
| `apps/api/src/modules/node-assignment/dto/create-ad-hoc-node.dto.ts` | Zone whitelist → PHASE3; direction branch in validator |
| `apps/api/src/modules/node-assignment/node-assignment.service.ts` | Direction presets lookup; swap fix (delete+recreate); removed segment uniqueness |
| `apps/dashboard/.../assignment-canvas/assignment-canvas.component.ts` | Split FAB signals; decoration guard; direction presets |
| `apps/dashboard/.../assignment-canvas/assignment-canvas.component.html` | 3 separate FAB buttons |
| `apps/dashboard/.../figure-canvas/figure-canvas.component.ts` | Direction stroke/color styling; DIRECTION_ZONES import |
| `apps/dashboard/.../ad-hoc-node-properties/ad-hoc-node-properties.component.ts` | `isDirection` computed |
| `apps/dashboard/.../ad-hoc-node-properties/ad-hoc-node-properties.component.html` | Person uniqueness info alert |
| `apps/dashboard/.../ad-hoc-nodes-help-modal/ad-hoc-nodes-help-modal.component.html` | Updated "Nodes de Direcció" section |

---

## 8. Definition of Done

- [x] Direction nodes render as RECTANGLE with distinctive colors
- [x] FAB split into 3 independent buttons (Pinya, Decoratiu, Direccions)
- [x] Swap assignment works without unique constraint violations
- [x] Decoration nodes blocked from assignment (frontend + backend)
- [x] No segment-level node uniqueness — only person uniqueness matters
- [x] Arrow keys work for direction ad-hoc nodes
- [x] Backend unit tests pass
- [x] No lint errors introduced
- [x] Shared lib compiles cleanly
- [x] Phase 1 + Phase 2 behavior unchanged
