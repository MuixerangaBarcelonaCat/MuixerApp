# P5.4 — Node Assignment (Assignació de Persones a Figures)

**Date**: 2026-05-12
**Status**: Draft
**Depends on**: P5.3 (EventSegment + FigureInstance)
**Parent spec**: `docs/specs/2026-05-07-p5-figures-module-overview-design.md` §4.1, §5.4

---

## 1. Objective

Enable technicians to assign real persons to figure nodes within event segments, with full visibility of attendance status, height information, and conflict management.

Key goals:

- CRUD of `NodeAssignment` with optimistic UI for fast interaction
- Canvas-based assignment with pick-and-place + swap interaction model
- Person panel with attendance-aware filtering (confirmed / pending / declined)
- Visual indicators on nodes showing attendance risk (badge + border)
- Height visualization (relative by default, absolute toggle) critical for bases and tronc
- Import assignments from past events for the same figure template
- Cross-event awareness: indicator showing if a person confirmed the next performance (for rehearsals)
- Progress tracking: assigned/total per figure + free persons count (potential "mans")

---

## 2. Data Model

### 2.1. `NodeAssignment` (table: `node_assignments`)


| Column            | DB Type                  | Nullable | Default | Notes                                                                                                                                                                                                                                |
| ----------------- | ------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | `uuid` PK                | No       | auto    |                                                                                                                                                                                                                                      |
| `figureInstance`  | FK → `figure_instances`  | No       | —       | `ManyToOne`, `onDelete: CASCADE`                                                                                                                                                                                                     |
| `figureNode`      | FK → `figure_nodes`      | No       | —       | `ManyToOne`                                                                                                                                                                                                                          |
| `person`          | FK → `persons`           | No       | —       | `ManyToOne`                                                                                                                                                                                                                          |
| `compositionSlot` | FK → `composition_slots` | Yes      | `null`  | `ManyToOne`. Required when `figureInstance` references a `CompositionTemplate`. Disambiguates which slot within a composition the node belongs to (e.g., which of the two pd3s in an Altar). `null` for standalone figure instances. |
| `createdAt`       | `timestamp`              | No       | auto    |                                                                                                                                                                                                                                      |
| `updatedAt`       | `timestamp`              | No       | auto    |                                                                                                                                                                                                                                      |


**DB Constraints:**

- `UNIQUE(figureInstance, figureNode, compositionSlot)` — one person per node per slot per instance. For standalone figures (compositionSlot=null), this effectively becomes UNIQUE(figureInstance, figureNode).
- `UNIQUE(figureInstance, person, compositionSlot)` — one person cannot occupy two nodes within the same figure of a composition slot

**Service-level validation:**

- A person cannot appear in two `NodeAssignment`s of `FigureInstance`s within the **same** `EventSegment`. Validated at `create()` with a query.

### 2.2. Design Decision: No Status Duplication

The person's attendance status (`ANIRE`/`PENDENT`/`NO_VAIG`) is **not** stored on `NodeAssignment`. The frontend resolves visual indicators by consulting the person's `Attendance` record for the current event. Reasons:

- Single source of truth: `Attendance` entity owns status
- No sync issues when a person changes their attendance
- Frontend already loads attendance data for the person panel

### 2.3. Composition Slot Disambiguation

When a `FigureInstance` references a `CompositionTemplate` (e.g., an Altar with 2 pd3s + 1 pd4 + 2 pd2s):

- The composition has `CompositionSlot`s, each pointing to a `FigureTemplate`
- The same `FigureTemplate` can appear in multiple slots (e.g., two pd3s)
- `NodeAssignment.compositionSlot` identifies WHICH slot the assignment belongs to
- The frontend expands composition instances into per-slot tabs for assignment
- The backend validates that `figureNode` belongs to the `FigureTemplate` referenced by the given `compositionSlot`

For standalone `FigureInstance`s (pointing directly to a `FigureTemplate`):

- `compositionSlot` is always `null`
- Validation ensures `figureNode` belongs to the instance's `figureTemplate`

### 2.4. Relation Changes to Existing Entities

`**FigureInstance`** entity:

```typescript
@OneToMany(() => NodeAssignment, (a) => a.figureInstance, { cascade: true })
assignments: NodeAssignment[];
```

---

## 3. Backend Architecture

### 3.1. New Module: `node-assignment`

Dedicated NestJS module at `apps/api/src/modules/node-assignment/`. Separate from `event-segment` due to:

- Distinct business logic (attendance awareness, conflict resolution, history, bulk import)
- Own controller with diverse route prefixes (`/figure-instances/...`, `/figure-templates/...`, `/events/...`)
- Complex query logic (available-persons with joins to Attendance, proximity sorting)
- Independent testability

```
apps/api/src/modules/node-assignment/
├── node-assignment.module.ts
├── node-assignment.controller.ts
├── node-assignment.service.ts
├── available-persons.service.ts        — Complex query logic for person filtering/sorting
├── entities/
│   └── node-assignment.entity.ts
└── dto/
    ├── create-assignment.dto.ts
    └── bulk-import-assignment.dto.ts
```

**Module configuration:**

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NodeAssignment,
      FigureInstance,
      FigureNode,
      Person,
      Attendance,
      Event,
      CompositionSlot,
      EventSegment,
    ]),
  ],
  controllers: [NodeAssignmentController],
  providers: [NodeAssignmentService, AvailablePersonsService],
  exports: [NodeAssignmentService], // exported for delete-guard in FigureTemplateService
})
export class NodeAssignmentModule {}
```

Registered in `app.module.ts` alongside existing modules.

**Cross-module dependency**: `FigureModule` imports `NodeAssignmentModule` to use `NodeAssignmentService` for the delete-guard (409 when deleting a node that has assignments). No circular dependency: `NodeAssignmentModule` depends on entities (`FigureNode`, `FigureInstance`) but NOT on `FigureModule`.

### 3.2. API Endpoints — NodeAssignment


| Method   | Route                                            | Description                                                                              | Response                                                       |
| -------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GET`    | `/figure-instances/:instanceId/assignments`      | List assignments with person data (alias, shoulderHeight) and node data (label, zone, z) | `{ data: AssignmentDetail[] }`                                 |
| `POST`   | `/figure-instances/:instanceId/assignments`      | Assign person to node. Body: `{ nodeId, personId, compositionSlotId? }`                  | `NodeAssignment` (with person and node populated)              |
| `DELETE` | `/figure-instances/:instanceId/assignments/:id`  | Unassign person from node                                                                | `204 No Content`                                               |
| `POST`   | `/figure-instances/:instanceId/assignments/bulk` | Bulk import from a past instance                                                         | `{ created: AssignmentDetail[], conflicts: ConflictDetail[] }` |


### 3.3. API Endpoints — Available Persons


| Method | Route                                                    | Description                     |
| ------ | -------------------------------------------------------- | ------------------------------- |
| `GET`  | `/events/:eventId/segments/:segmentId/available-persons` | Filtered persons for assignment |


**Query params:**

- `search` — name/alias search (ILIKE)
- `height` — single number. When present, results are sorted by proximity to this value (exact match first, then +/-1, +/-2...). Acts as both filter context and sort criteria.
- `isXicalla` — boolean filter
- `excludeAssigned` — `true` by default: excludes persons already assigned to any node in any instance/slot of the segment. For compositions, a person assigned in slot A of an instance is still excluded from slot B of the same instance (segment-level uniqueness).

**Response:**

```typescript
interface AvailablePersonDto {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  attendanceStatus: AttendanceStatus; // for current event
  nextPerformanceStatus: AttendanceStatus | null; // for next performance (if event is ASSAIG)
  assignedInSegment: boolean; // already assigned to another instance in the segment
}
```

### 3.4. API Endpoints — History for Import


| Method | Route                                   | Description                                                      |
| ------ | --------------------------------------- | ---------------------------------------------------------------- |
| `GET`  | `/figure-templates/:templateId/history` | Past events where this figure was instantiated, with assignments |


**Response:**

```typescript
interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  segmentName: string | null;
  instanceId: string;
  assignmentCount: number;
  totalNodes: number;
  assignments: { nodeId: string; nodeLabel: string; personId: string; personAlias: string }[];
}
```

### 3.5. API Endpoints — Next Performance


| Method | Route                               | Description                                                       |
| ------ | ----------------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/events/:eventId/next-performance` | Returns the next performance event after the current event's date |


Logic: finds next event with `eventType = ACTUACIO` and `date > currentEvent.date`, ordered by date ASC, limit 1. Returns `null` if none found.

### 3.6. Service Validations


| Validation                                                                                 | Behavior                                                                               |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Person already assigned in segment                                                         | 409 Conflict: "Aquesta persona ja està assignada a una altra figura d'aquest segment"  |
| Node already occupied                                                                      | 409 Conflict: "Aquesta posició ja està ocupada"                                        |
| FigureInstance not found                                                                   | 404                                                                                    |
| FigureNode doesn't belong to the instance's template (or slot's template for compositions) | 400 Bad Request                                                                        |
| `compositionSlotId` required but missing (instance references a composition)               | 400 Bad Request                                                                        |
| `compositionSlotId` provided but instance is standalone (not a composition)                | 400 Bad Request                                                                        |
| Person not found                                                                           | 404                                                                                    |
| Bulk import: partial conflicts                                                             | 207 Multi-Status: returns `created` (successes) and `conflicts` (failures with reason) |


### 3.7. Bulk Import Logic

`POST /figure-instances/:instanceId/assignments/bulk`

Body: `{ sourceInstanceId: string, sourceCompositionSlotId?: string }`

The `sourceCompositionSlotId` is required when the source instance references a composition — it identifies which slot's assignments to import. The frontend resolves this automatically (the import modal is opened from a specific slot tab).

Process:

1. Load assignments from `sourceInstanceId` (filtered by `sourceCompositionSlotId` if provided)
2. For each assignment, attempt to create in target instance:
  - Match by `figureNode.id` (node must exist in current template)
  - Skip if node doesn't exist in current template (template changed)
  - Skip if node already has an assignment in target (same slot context)
  - Skip if person already assigned in target segment
  - Set `compositionSlot` to the target's current slot (if target is composition-based)
3. Return `{ created: [...], conflicts: [...] }`

**Cross-context import**: importing from a standalone instance into a composition slot (or vice versa) works correctly because matching is by `figureNode.id` — the nodes belong to the same `FigureTemplate` regardless of whether the instance was standalone or part of a composition.

### 3.8. Permissions

All endpoints protected by `@UseGuards(AuthGuard, RolesGuard)` with roles `TECHNICAL` and `ADMIN`.

---

## 4. Frontend — Assignment Canvas

### 4.1. Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Top Bar                                                          │
│ [← Tornar] [Tabs: pd4 (12/18) | pd3 (8/12) | ...] [Editar ↗]  │
├─────────────────────────────────────────┬───────────────────────┤
│                                         │  Person Panel          │
│          Canvas Konva                   │                       │
│     (Pinya + Tronc lateral)             │  [🔍 Cerca...]        │
│                                         │  [Alçada: ___] [Xic.] │
│      Nodes with:                        │                       │
│      - positionType background color    │  ── Confirmades (24) ─│
│      - Attendance badge (●/●/●)         │  · Pepa (+3) 🎭       │
│      - Person alias or node label       │  · Joan (-2)          │
│      - Relative height (tronc)          │  · Maria (+5) 🎭      │
│                                         │  ...                   │
│                                         │                       │
│                                         │  ── Altres (collapsed)─│
│                                         │  ▶ Pendents (8)       │
│                                         │  ▶ No vindran (3)     │
│                                         │                       │
├─────────────────────────────────────────┴───────────────────────┤
│ Bottom Bar                                                       │
│ [Zoom +/-] [Abs/Rel] [Lliures: 11 de 45] [Importar pinya]      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2. Top Bar

- **← Tornar**: navigates back to event detail (segment manager)
- **Figure Tabs**: one tab per `FigureInstance` in the segment. For standalone figures: one tab showing name + progress "(assigned/total)". For compositions: the composition expands into one tab per `CompositionSlot` (e.g., Altar → "pd4 central", "pd3 esquerra", "pd3 dreta", "pd2 esq.", "pd2 dreta"). Each slot tab shows its own progress.
- **Editar template ↗**: opens template editor in new tab (for adjusting nodes of the currently active figure)

### 4.3. Canvas (Central Area)

Reuses `FigureCanvasComponent` in mode `'assignment'`:

- Pinya (70%) + Tronc lateral (30%, toggleable)
- Nodes display:
  - **Background**: `positionType` color (preserved from template editor)
  - **Primary text**: person alias (if assigned) or node label (if empty)
  - **Secondary text (tronc only)**: relative height (+3, -3) when person has `shoulderHeight`
  - **Corner badge**: small circle indicating attendance status (green = ANIRE, orange = PENDENT, red = NO_VAIG)
  - **Border**: solid if assigned, dashed if empty, thick red if conflict (inactive person)
- Nodes are NOT draggable (fixed positions)

### 4.4. Interaction Model (Pick & Place with Swap)


| Action                                            | Behavior                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Click empty node → click person in panel          | Assigns person to node                                                                    |
| Click occupied node → click person in panel       | Replaces current person (previous becomes free)                                           |
| Click occupied node → click another occupied node | Swaps the two persons                                                                     |
| Click occupied node → click empty node            | Moves person to empty node (previous becomes empty)                                       |
| Double-click occupied node                        | Opens popover (unassign / change info)                                                    |
| Click person in panel (no node selected)          | Selects that person, ready to click a node                                                |
| Hover node                                        | Tooltip with full info (full name, absolute height, habitual position, attendance status) |


After each assignment, **auto-advance** selects the next empty node in the same floor (z) and zone, following `sortOrder`. The technician can always click any other node to skip.

### 4.5. Person Panel (Right Side)

- **Search**: text input for name/alias filtering
- **Quick filters**: height field (single number, sorts by proximity) + "Xicalla" checkbox + "Només lliures" checkbox (excludes already-assigned in segment, on by default)
- **Block "Confirmades"**: persons with `ANIRE` status. Each shows: alias, relative height, 🎭 icon if confirmed next performance.
- **Block "Altres" (collapsed by default)**: expandable. Sub-divided into "Pendents" and "No vindran". Same display format.
- **Click person**: assigns to selected node (optimistic UI) or selects person if no node selected
- **Collapse toggle**: button to hide panel and give full space to canvas

### 4.6. Bottom Bar

- **Zoom +/-**: zoom controls
- **Abs/Rel**: height display toggle (relative by default, baseline 140 cm)
- **Lliures: X de Y**: count of confirmed persons (ANIRE) not assigned to any node in the segment (potential "mans" / safety hands)
- **Importar pinya**: opens import modal

### 4.7. Node Visual States Summary


| State                      | Background                             | Border         | Badge         | Text          |
| -------------------------- | -------------------------------------- | -------------- | ------------- | ------------- |
| Empty                      | positionType color (light/desaturated) | dashed gray    | none          | node label    |
| Assigned + ANIRE           | positionType color                     | solid          | green ●       | person alias  |
| Assigned + PENDENT         | positionType color                     | solid          | orange ●      | person alias  |
| Assigned + NO_VAIG         | positionType color                     | solid orange   | red ●         | person alias  |
| Assigned + inactive person | positionType color                     | thick red      | gray ●        | person alias  |
| Selected (highlight)       | positionType color + glow/ring         | blue highlight | (if assigned) | (if assigned) |


---

## 5. Import Pinya Modal

### 5.1. Flow

1. Technician clicks "Importar pinya" (bottom bar)
2. Modal opens with:
  - List of past events containing an instance of the same `FigureTemplate`, ordered by date descending
  - Each entry: event date, title, segment name, assignment progress (e.g., "16/18 assignats")
3. Technician selects an event → modal shows a **read-only preview** of that event's pinya (miniature canvas with names)
4. Button **"Importar"**: copies assignments via `POST /assignments/bulk`
5. Result:
  - Nodes matching (same `figureNode.id`): assigned with the same person
  - Nodes no longer in current template: silently ignored
  - New nodes (didn't exist in past event): remain empty
  - Persons not attending current event (NO_VAIG/PENDENT): assigned with risk indicator (orange/red badge)
  - Persons already assigned in another instance of the segment: conflict, returned in `conflicts[]`, not assigned
6. After import, canvas shows a **brief summary** (toast): "Importades 14 assignacions. 2 conflictes. 3 persones amb risc."

### 5.2. Template Change Resilience

Import works **by node ID**: only assigns persons to nodes that exist both in the source event and in the current template. `FigureNode.id` values are stable across template edits (nodes are updated in place, not recreated).

---

## 6. Frontend Components & Services

### 6.1. New Components

```
features/pinyes/
├── components/
│   ├── assignment-canvas/              — Main assignment page
│   │   ├── assignment-canvas.component.ts
│   │   ├── assignment-canvas.component.html
│   │   └── assignment-canvas.component.scss
│   ├── person-panel/                   — Right-side person panel
│   │   ├── person-panel.component.ts
│   │   ├── person-panel.component.html
│   │   └── person-panel.component.scss
│   ├── import-pinya-modal/             — Import from past events
│   │   ├── import-pinya-modal.component.ts
│   │   ├── import-pinya-modal.component.html
│   │   └── import-pinya-modal.component.scss
│   └── node-popover/                   — Quick popover for assigned nodes
│       ├── node-popover.component.ts
│       ├── node-popover.component.html
│       └── node-popover.component.scss
```

### 6.2. New Services

`**NodeAssignmentService**` (HTTP client):

```typescript
getByInstance(instanceId: string): Observable<AssignmentDetail[]>
assign(instanceId: string, dto: { nodeId: string; personId: string; compositionSlotId?: string }): Observable<NodeAssignment>
unassign(instanceId: string, assignmentId: string): Observable<void>
bulkImport(instanceId: string, dto: { sourceInstanceId: string; sourceCompositionSlotId?: string }): Observable<BulkResult>
getAvailablePersons(eventId: string, segmentId: string, params: AvailablePersonsQuery): Observable<AvailablePersonDto[]>
getHistory(templateId: string): Observable<FigureHistoryEntry[]>
getNextPerformance(eventId: string): Observable<NextPerformanceDto | null>
```

`**AssignmentStateService**` (signal-based local state):

```typescript
selectedNodeId = signal<string | null>(null);
selectedPersonId = signal<string | null>(null);
assignments = signal<AssignmentDetail[]>([]);
pendingOperations = signal<PendingOp[]>([]);
heightMode = signal<'relative' | 'absolute'>('relative');
panelCollapsed = signal<boolean>(false);
activeInstanceId = signal<string | null>(null);
freePersonsCount = computed(() => /* confirmed persons not assigned in segment */);
```

### 6.3. Component Responsibilities

`**AssignmentCanvasComponent**` (page):

- Route: `/events/:eventId/segments/:segmentId/assign`
- Loads `FigureInstance`s for the segment
- Manages figure tabs
- Contains `FigureCanvasComponent` (mode `'assignment'`) + `PersonPanelComponent`
- Coordinates pick-and-place interaction between canvas and panel
- Manages optimistic UI (operation queue, rollback on error)
- Bottom bar: zoom, height toggle, free persons counter, import button

`**PersonPanelComponent**`:

- Inputs: `eventId`, `segmentId`, `selectedNodeId`, `currentInstanceAssignments`
- Output: `personSelected` event
- Calls `available-persons` endpoint with filters
- Displays "Confirmades" / "Altres" blocks
- Search, height filter, xicalla/free checkboxes
- 🎭 indicator for next performance attendance

`**ImportPinyaModalComponent**`:

- Input: `figureTemplateId`, `currentInstanceId`
- Output: `importCompleted` event
- Loads history via `GET /figure-templates/:id/history`
- Shows event list + preview
- Executes `POST /assignments/bulk` and shows summary

`**NodePopoverComponent**`:

- Input: `assignment`, `node`
- Output: `unassign`, `swapRequested`
- Appears on double-click of an occupied node
- Shows: full name, height, attendance status, "Desassignar" / "Canviar" buttons

### 6.4. Modification to `FigureCanvasComponent`

New mode `'assignment'` added (alongside existing `'editor'` and `'composition'`):

- Nodes are NOT draggable (fixed positions)
- Click selects node (output `nodeSelected`)
- Renders attendance badge at corner
- Shows person alias instead of label when assigned
- Shows relative height on tronc nodes
- Double-click opens popover (output `nodeDoubleClicked`)

### 6.5. New Route

```typescript
// pinyes.routes.ts
{
  path: 'events/:eventId/segments/:segmentId/assign',
  component: AssignmentCanvasComponent,
  canActivate: [AuthGuard],
}
```

### 6.6. Modification to `SegmentManagerComponent`

Each segment card gets an **"Assignar"** button (Lucide `Users` icon) that navigates to the assignment canvas route.

### 6.7. Frontend Models

`**assignment.model.ts`**:

```typescript
export interface AssignmentDetail {
  id: string;
  figureInstanceId: string;
  compositionSlotId: string | null;
  node: { id: string; label: string; zone: FigureZone; z: number; positionType: string | null };
  person: { id: string; alias: string; name: string; firstSurname: string; shoulderHeight: number | null };
}

export interface AvailablePerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  attendanceStatus: AttendanceStatus;
  nextPerformanceStatus: AttendanceStatus | null;
  assignedInSegment: boolean;
}

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  segmentName: string | null;
  instanceId: string;
  assignmentCount: number;
  totalNodes: number;
  assignments: { nodeId: string; nodeLabel: string; personId: string; personAlias: string }[];
}

export interface BulkImportResult {
  created: AssignmentDetail[];
  conflicts: { nodeId: string; nodeLabel: string; personAlias: string; reason: string }[];
}

export interface PendingOp {
  id: string;
  type: 'assign' | 'unassign' | 'swap';
  status: 'pending' | 'success' | 'failed';
  rollbackFn: () => void;
}
```

---

## 7. Edge Cases & Conflict Handling

### 7.1. Attendance Status Changes


| Situation                                      | Behavior                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Assigned person changes to `NO_VAIG`           | Assignment persists. Red badge on node. Technician decides.                            |
| Assigned person changes to `PENDENT`           | Assignment persists. Orange badge. Moderate risk visible.                              |
| Assigned person is `ANIRE`                     | Green badge. Normal state.                                                             |
| Technician assigns a `NO_VAIG` person manually | Allowed. Red badge immediate. No confirmation modal (block separation is the warning). |
| Technician assigns a `PENDENT` person manually | Allowed. Orange badge immediate.                                                       |


### 7.2. Uniqueness Conflicts


| Situation                                                  | Behavior                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Person already assigned in another instance of the segment | Backend 409. Frontend rollback + toast: "Ja assignada a [figure name]" |
| Node already occupied (concurrent, rare)                   | Backend 409. Frontend rollback + toast: "Posició ja ocupada"           |
| Swap between instances                                     | Not supported directly. Must unassign + reassign across instances.     |


### 7.3. Template Modifications with Active Instances


| Situation                                           | Behavior                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Node deleted from template with existing assignment | Template `PUT` returns 409 for that node (existing P5.1 protection). Technician must unassign first. |
| Node added to template                              | Appears as empty in all existing instances. No action required.                                      |
| Node repositioned in template                       | Assignment persists (FK by ID, not position). Person "moves" with node.                              |


### 7.4. Optimistic UI Failure Handling

```
1. Technician clicks → UI paints assignment immediately (optimistic)
2. POST sent to backend
3a. ✅ 201 Created → no action (already painted)
3b. ❌ 409/404/400 → visual rollback + error toast + auto-advance reverted
```

**Operation queue**: if technician makes 3 rapid assignments (< 500ms apart), they queue and execute sequentially. If one fails, subsequent are cancelled and all reverted. Toast: "Error en assignar [person]. Operacions posteriors revertides."

### 7.5. Data Freshness

Attendance status is loaded when opening the assignment canvas and **not auto-refreshed** (no SSE/WebSocket in this phase). A "Refrescar" button in the person panel triggers a reload of `available-persons` data.

### 7.6. Inactive Persons


| Situation                     | Behavior                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Person with `isActive: false` | Not shown in person panel. If already assigned (became inactive after assignment), node shows person with gray badge + tooltip "Persona inactiva". |


---

## 8. Accessibility


| Element                 | Requirement                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Canvas nodes**        | Dynamic `aria-label`: "[node label] - [person or empty] - [attendance status]"           |
| **Person panel**        | Tab-navigable. Each person is a `button` with full `aria-label` (name + height + status) |
| **Figure tabs**         | `role="tablist"` + `role="tab"` + `aria-selected`. Arrow keys to navigate                |
| **Import modal**        | Focus trap. `aria-modal="true"`. Escape to close. Focus returns to trigger button        |
| **Collapsible blocks**  | `aria-expanded` on toggle button. Content with `aria-hidden` when collapsed              |
| **Status indicators**   | Not color-only: badge + textual tooltip. Minimum 3:1 contrast for badges                 |
| **Node popover**        | `role="dialog"`. Lightweight focus trap. Escape to close                                 |
| **Counters**            | `aria-live="polite"` on free persons and progress counters                               |
| **Keyboard navigation** | Tab navigates between nodes. Enter/Space selects. Arrow keys move between adjacent nodes |


---

## 9. Responsive


| Device                  | Behavior                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop** (≥1280px)   | Full layout: canvas + side panel visible                                                                                            |
| **Tablet** (768-1279px) | Collapsible side panel (toggle). Canvas takes available width                                                                       |
| **Mobile** (<768px)     | Full-screen canvas. Panel via bottom drawer (slide up). Primarily consultation mode — assignment possible but optimized for desktop |


---

## 10. File Structure Summary

### 10.1. New Files

```
apps/api/src/modules/node-assignment/
├── node-assignment.module.ts
├── node-assignment.controller.ts
├── node-assignment.service.ts
├── available-persons.service.ts
├── entities/
│   └── node-assignment.entity.ts
└── dto/
    ├── create-assignment.dto.ts
    └── bulk-import-assignment.dto.ts

apps/dashboard/src/app/features/pinyes/
├── components/
│   ├── assignment-canvas/
│   │   ├── assignment-canvas.component.ts
│   │   ├── assignment-canvas.component.html
│   │   └── assignment-canvas.component.scss
│   ├── person-panel/
│   │   ├── person-panel.component.ts
│   │   ├── person-panel.component.html
│   │   └── person-panel.component.scss
│   ├── import-pinya-modal/
│   │   ├── import-pinya-modal.component.ts
│   │   ├── import-pinya-modal.component.html
│   │   └── import-pinya-modal.component.scss
│   └── node-popover/
│       ├── node-popover.component.ts
│       ├── node-popover.component.html
│       └── node-popover.component.scss
├── services/
│   ├── node-assignment.service.ts
│   └── assignment-state.service.ts
└── models/
    └── assignment.model.ts
```

### 10.2. Modified Files


| File                                                                                  | Change                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/api/src/app/app.module.ts`                                                      | Import `NodeAssignmentModule`                                                 |
| `apps/api/src/modules/event-segment/entities/figure-instance.entity.ts`               | Add `OneToMany → NodeAssignment[]`                                            |
| `apps/api/src/modules/figure/figure-template.service.ts`                              | Import `NodeAssignmentService` for delete-guard (409 if node has assignments) |
| `apps/dashboard/.../pinyes/components/figure-canvas/figure-canvas.component.ts`       | Add mode `'assignment'` with badge rendering, click-to-select, height display |
| `apps/dashboard/.../events/components/segment-manager/segment-manager.component.html` | Add "Assignar" button per segment                                             |
| `apps/dashboard/.../pinyes/pinyes.routes.ts`                                          | Add assignment canvas route                                                   |


---

## 11. Out of Scope (Deferred)


| Feature                                                                | Deferred to                    |
| ---------------------------------------------------------------------- | ------------------------------ |
| Inline template editing from assignment canvas                         | P5.4.1 (future)                |
| Auto-suggestion of persons by suitability (height + habitual position) | P5.4.1 (future)                |
| Real-time sync between multiple technicians (WebSocket)                | P7                             |
| Advanced undo/redo (operation history)                                 | P5.4.1 (future)                |
| Fullscreen projection of assigned pinya                                | P5.5                           |
| Per-person figure history ("where have I been?")                       | P5.5                           |
| PWA member view (read-only)                                            | P6                             |
| Push notifications on assignment change                                | P7                             |
| Drag & drop persons from panel to canvas                               | P5.4.1 (future UX improvement) |


---

## 12. Technical Dependencies

No new packages required. Uses existing `konva` (canvas) and `@angular/cdk` (accessibility utilities).

---

## 13. Testing Strategy

### Backend

- Unit tests for `NodeAssignmentService`: create, delete, bulk import, validations (409 conflicts, 404s)
- Unit tests for `available-persons` query with all filter combinations
- Unit tests for `figure-templates/:id/history` endpoint
- Integration: verify CASCADE delete (segment deleted → assignments deleted)

### Frontend

- Unit tests for `AssignmentStateService`: signal state transitions, computed values
- Unit tests for `PersonPanelComponent`: filter logic, block rendering, search
- Unit tests for `AssignmentCanvasComponent`: interaction model (pick & place, swap), optimistic UI rollback
- Unit tests for `ImportPinyaModalComponent`: selection flow, bulk result handling

