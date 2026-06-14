# Ad-Hoc Instance Nodes — Phase 5 Specification

> **Status:** Draft (Deferred)
> **Created:** 2026-06-11
> **Parent spec:** [`docs/specs/2026-06-10-ad-hoc-instance-nodes-design.md`](../2026-06-10-ad-hoc-instance-nodes-design.md)
> **Phase 4 spec:** [`docs/specs/plans/ad-hoc-nodes-phase-4-spec.md`](ad-hoc-nodes-phase-4-spec.md)
> **Branch:** `feat/ad-hoc-nodes-phase-5`
> **Scope:** Undo/redo stack, save as template preset, template preview
> **DB migration:** Required (Part 2 — `figure_nodes_zone_enum`)

---

## 1. Executive Summary

Phase 5 contains **high-complexity, architecturally significant** features that were deferred from the original Phase 4 scope. These features introduce new patterns (operation stack, node promotion) and require careful design to avoid breaking snapshot immutability invariants.

This spec documents the intended design for future implementation. Each section is self-contained and can be implemented independently.

---

## 2. Prerequisites

All of Phases 1–4 must be implemented before Phase 5.

---

## 3. Part 1 — Undo/Redo Stack

### 3.1 Goal

Allow users to undo/redo ad-hoc node operations (create, move, resize, rotate, delete, assign, unassign) in the assignment canvas.

### 3.2 Architecture

**In-memory only** — no database persistence. The operation stack lives in a new Angular service and is cleared on tab switch, instance change, or page navigation.

```
UndoRedoService
├── stack: UndoableAction[]      (max ~50)
├── pointer: number              (current position)
├── canUndo: Signal<boolean>
├── canRedo: Signal<boolean>
├── push(action: UndoableAction): void
├── undo(): void
├── redo(): void
└── clear(): void
```

### 3.3 Action Types

```typescript
interface UndoableAction {
  type: AdHocActionType;
  forward: () => Observable<void>;   // Execute or re-execute
  reverse: () => Observable<void>;   // Undo
  description: string;               // For UI tooltip: "Crear Agulla", "Moure node"
}

enum AdHocActionType {
  CREATE = 'CREATE',
  DELETE = 'DELETE',
  MOVE = 'MOVE',
  RESIZE = 'RESIZE',
  ROTATE = 'ROTATE',
  PROPERTY_CHANGE = 'PROPERTY_CHANGE',
  ASSIGN = 'ASSIGN',
  UNASSIGN = 'UNASSIGN',
}
```

### 3.4 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z / Cmd+Z | Undo last operation |
| Ctrl+Shift+Z / Cmd+Shift+Z | Redo last undone operation |

### 3.5 Integration Points

- `AssignmentCanvasComponent`: wrap all ad-hoc mutations in `UndoableAction` before calling the service
- `AssignmentStateService`: `pendingOperations` must not conflict with undo/redo (both use optimistic UI)
- `AdHocNodePropertiesComponent`: debounced PATCH must coalesce into a single undoable action per property edit session

### 3.6 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Undo CREATE | DELETE the created node (including any assignment made after creation) |
| Undo DELETE | Re-create the node at original position (new UUID — original is gone) |
| Undo ASSIGN | Unassign the person from the node |
| Undo after tab switch | Stack cleared — no undo available |
| Redo after new action | Redo stack truncated (standard undo/redo behavior) |
| Undo while locked | Block with toast |
| Stack overflow (>50) | Oldest actions dropped |

### 3.7 Complexity Estimate

**3–5 days.** The main challenges:
- CREATE undo must track the server-assigned UUID to delete later
- DELETE undo must recreate with potentially different UUID (old one is gone)
- ASSIGN undo needs the person ID and node ID
- Property coalescing: multiple rapid changes should be one undo step
- Error handling: if undo API call fails, rollback the stack pointer

### 3.8 DB Migration

**None.** All state is in-memory.

---

## 4. Part 2 — Save as Template Preset

### 4.1 Goal

Promote selected ad-hoc `InstanceNode`s back to `FigureNode`s in the template. This lets users "discover" new positions during assignment and persist them for future instances.

### 4.2 DB Migration Required

`figure_nodes` uses a **separate** PostgreSQL enum `figure_nodes_zone_enum` (created in migration `1780982679300-RemoveFigureFamily`), while `instance_nodes` uses `figure_zone_enum`.

To support promoting DECORATION or DIRECTION ad-hoc nodes:

```sql
ALTER TYPE "public"."figure_nodes_zone_enum" ADD VALUE IF NOT EXISTS 'DECORATION';
```

PINYA and direction zones already exist in `figure_nodes_zone_enum`, so only DECORATION requires the migration.

### 4.3 UX Flow

1. User selects one or more ad-hoc nodes in the assignment canvas
2. Clicks "Desar al template" button (new, in properties panel or context menu)
3. Confirmation dialog: "Es crearan {n} node(s) nous al template «{name}». Les instàncies existents no es veuran afectades."
4. On confirm: API call to create `FigureNode`s matching the ad-hoc nodes' geometry

### 4.4 API Design

```
POST /figure-templates/:templateId/nodes/from-instance
Body: { instanceNodeIds: string[] }
```

Backend:
1. Load each `InstanceNode` by ID, verify `isAdHoc = true`
2. For each node, create a `FigureNode` with matching zone, positionType, label, x, y, width, height, rotation, shape, color
3. Set `sortOrder = MAX(existing) + 1`
4. Return created `FigureNode`s

### 4.5 Position Mapping

Instance coordinates may differ from template coordinates if the user repositioned nodes. The simplest approach: **copy coordinates as-is** — the template editor uses the same coordinate system as the assignment canvas.

If the template has been modified since the snapshot, the promoted nodes may overlap with new template nodes. This is acceptable — the user can reposition in the template editor.

### 4.6 Invariants

- Promoting does NOT modify the `InstanceNode` — it creates a **new** `FigureNode` in the template
- Existing snapshots are NOT affected (they were taken from the template at a previous point in time)
- The ad-hoc `InstanceNode` remains `isAdHoc: true` (it doesn't retroactively become a snapshot node)

### 4.7 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Promote PINYA ad-hoc | New `FigureNode` with same zone/positionType |
| Promote DECORATION ad-hoc | Requires `figure_nodes_zone_enum` migration |
| Promote DIRECTION ad-hoc | Already supported by `figure_nodes_zone_enum` |
| Template modified since snapshot | Promoted nodes may overlap — user repositions manually |
| Promote from composition instance | Blocked (ad-hoc nodes cannot exist on composition instances) |
| Promote same node twice | Creates duplicate `FigureNode` — warn user? |

### 4.8 Complexity Estimate

**3–4 days.** Migration, new endpoint, frontend UX (selection, confirmation, success feedback), template editor node refresh after promotion.

---

## 5. Part 3 — Template Preview

### 5.1 Goal

Show in the template editor what the next snapshot would look like: the current set of `FigureNode`s that would be copied to `InstanceNode`s.

### 5.2 Depends On

This feature gains value after "Save as template preset" (Part 2) exists — users can see the effect of promoted nodes before creating new instances.

### 5.3 Implementation Sketch

- Read-only Konva overlay in the template editor
- Toggle button: "Previsualitzar snapshot"
- Renders all `FigureNode`s as they would appear in the assignment canvas
- No interaction (pure visual preview)
- Could show a ghost overlay comparing current template with the last-snapshotted state

### 5.4 Complexity Estimate

**1–2 days.** Mostly frontend — reuse existing `renderReadonlyNodes()` from `FigureCanvasComponent`.

---

## 6. Implementation Priority

| Part | Priority | Dependencies | Migration |
|------|----------|-------------|-----------|
| Undo/Redo | Medium | Phase 4 complete | None |
| Save as Template | Low | Phase 4 + enum migration | Yes |
| Template Preview | Low | Part 2 for full value | None |

Recommendation: implement Part 1 (undo/redo) first — it provides immediate UX value without migration risk. Parts 2 and 3 can be deferred further or implemented together.

---

## 7. File Changes Summary (Estimated)

| File | Change |
|------|--------|
| `apps/dashboard/.../services/undo-redo.service.ts` | **New** — in-memory undo/redo stack |
| `apps/dashboard/.../assignment-canvas/assignment-canvas.component.ts` | Wrap mutations in undoable actions, Ctrl+Z/Ctrl+Shift+Z |
| `apps/api/src/modules/figure/figure-template.controller.ts` | New endpoint for node promotion |
| `apps/api/src/modules/figure/figure-template.service.ts` | `promoteFromInstance()` method |
| `apps/api/src/migrations/{timestamp}-AddDecorationToFigureNodesEnum.ts` | **New** — enum migration |
| `apps/dashboard/.../template-editor/template-editor.component.ts` | Preview toggle, refresh after promotion |
| `libs/shared/src/interfaces/pinyes/figure.interfaces.ts` | Promotion DTO/response interfaces |
