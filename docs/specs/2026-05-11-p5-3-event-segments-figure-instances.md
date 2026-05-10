# P5.3 — EventSegment + FigureInstance

**Date**: 2026-05-11
**Status**: Draft
**Depends on**: P5.1 (FigureTemplate), P5.2 (CompositionTemplate)
**Parent spec**: `docs/specs/2026-05-07-p5-figures-module-overview-design.md` §4.1, §5.3, §7.3

---

## 1. Objective

Allow technicians to plan which figures (templates or compositions) will be performed at each event, organized into ordered segments. Each segment groups one or more simultaneous figures and can optionally include timing information.

Key goals:
- CRUD of `EventSegment` and `FigureInstance` with a dedicated NestJS module
- Dashboard UI: section in event detail to manage segments and their figures
- Quick access from the event list to navigate directly to an event's segments
- Link from figure instances to template/composition editors for quick modifications
- Segment visibility toggle to control what members can see (preparation for PWA in P6)

---

## 2. Data Model

### 2.1. `EventSegment` (table: `event_segments`)

| Column | DB Type | Nullable | Default | Notes |
|--------|---------|----------|---------|-------|
| `id` | `uuid` PK | No | auto | |
| `event` | FK → `events` | No | — | `ManyToOne`, `onDelete: CASCADE` |
| `name` | `varchar` | Yes | `null` | `null` = auto-generated from figures. Non-null = custom name override |
| `sortOrder` | `int` | No | — | Reorderable via up/down arrows |
| `startTime` | `varchar` | Yes | `null` | Informational only. Ex: "19:30" |
| `endTime` | `varchar` | Yes | `null` | Informational only |
| `notes` | `text` | Yes | `null` | Internal technician notes |
| `isVisible` | `boolean` | No | `false` | Visibility control for members (PWA) |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

**Auto-generated name logic** (frontend):
- When `name` is `null`, the frontend computes the display name by concatenating the names of the segment's figure instances with " + ". Ex: "pd4 + pd3 + Altar".
- Empty segment with no instances and `name = null`: displays "Segment 1", "Segment 2"... based on position.
- When a technician manually edits the name, the value is saved to the DB and no longer auto-computed.

### 2.2. `FigureInstance` (table: `figure_instances`)

| Column | DB Type | Nullable | Default | Notes |
|--------|---------|----------|---------|-------|
| `id` | `uuid` PK | No | auto | |
| `segment` | FK → `event_segments` | No | — | `ManyToOne`, `onDelete: CASCADE` |
| `figureTemplate` | FK → `figure_templates` | Yes | `null` | `ManyToOne`. Mutually exclusive with `compositionTemplate` |
| `compositionTemplate` | FK → `composition_templates` | Yes | `null` | `ManyToOne`. Mutually exclusive with `figureTemplate` |
| `label` | `varchar` | Yes | `null` | Optional override label |
| `sortOrder` | `int` | No | — | Order within segment |
| `createdAt` | `timestamp` | No | auto | |
| `updatedAt` | `timestamp` | No | auto | |

**XOR constraint**: Exactly one of `figureTemplate` or `compositionTemplate` must be non-null. Validated at service level (not DB constraint).

**Composition as single reference**: When adding a composition to a segment, a single `FigureInstance` is created pointing to the `CompositionTemplate`. Compositions are NOT expanded into individual figure instances.

### 2.3. Relation Changes to Existing Entities

**`Event` entity** (`apps/api/src/modules/event/event.entity.ts`):
- Add `@OneToMany(() => EventSegment, s => s.event)` — lazy, no cascade

**`FigureTemplate` entity** (`apps/api/src/modules/figure/entities/figure-template.entity.ts`):
- Add `@OneToMany(() => FigureInstance, i => i.figureTemplate)` — for delete guard (409)

**`CompositionTemplate` entity** (`apps/api/src/modules/composition/entities/composition-template.entity.ts`):
- Add `@OneToMany(() => FigureInstance, i => i.compositionTemplate)` — for delete guard (409)

### 2.4. Entity Relationship Diagram (P5.3 scope)

```
Event ──< EventSegment ──< FigureInstance ──> FigureTemplate
                                         └──> CompositionTemplate
```

---

## 3. Backend Architecture

### 3.1. Module: `event-segment`

New NestJS module at `apps/api/src/modules/event-segment/`.

```
apps/api/src/modules/event-segment/
├── event-segment.module.ts
├── event-segment.controller.ts
├── event-segment.service.ts
├── figure-instance.service.ts
├── dto/
│   ├── create-segment.dto.ts
│   ├── update-segment.dto.ts
│   ├── reorder-segments.dto.ts
│   ├── create-instance.dto.ts
│   └── update-instance.dto.ts
└── entities/
    ├── event-segment.entity.ts
    └── figure-instance.entity.ts
```

**Module imports**: `TypeOrmModule.forFeature([EventSegment, FigureInstance, Event, FigureTemplate, CompositionTemplate])`

### 3.2. API Endpoints — EventSegment

| Method | Route | Description | Response |
|--------|-------|-------------|----------|
| `GET` | `/events/:eventId/segments` | List segments ordered by `sortOrder`, with instances eagerly loaded (including template/composition names) | `{ data: SegmentWithInstances[] }` |
| `POST` | `/events/:eventId/segments` | Create segment. `sortOrder` auto-assigned (max + 1) | `EventSegment` |
| `PUT` | `/events/:eventId/segments/:id` | Update name, startTime, endTime, notes, isVisible | `EventSegment` |
| `DELETE` | `/events/:eventId/segments/:id` | Delete segment + CASCADE instances. Frontend must confirm first | `204 No Content` |
| `PATCH` | `/events/:eventId/segments/reorder` | Body: `{ segmentIds: string[] }`. Reassigns `sortOrder` based on array order | `204 No Content` |

### 3.3. API Endpoints — FigureInstance

| Method | Route | Description | Response |
|--------|-------|-------------|----------|
| `POST` | `/events/:eventId/segments/:segmentId/instances` | Add figure or composition. Body: `{ figureTemplateId?: string, compositionTemplateId?: string, label?: string }` | `FigureInstance` |
| `PUT` | `/events/:eventId/segments/:segmentId/instances/:id` | Update label, sortOrder | `FigureInstance` |
| `DELETE` | `/events/:eventId/segments/:segmentId/instances/:id` | Remove figure/composition from segment. Frontend must confirm first | `204 No Content` |
| `PATCH` | `/events/:eventId/segments/:segmentId/instances/reorder` | Reorder instances within segment | `204 No Content` |

### 3.4. GET Segments — Response Shape

```typescript
interface SegmentWithInstances {
  id: string;
  name: string | null;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isVisible: boolean;
  instances: {
    id: string;
    label: string | null;
    sortOrder: number;
    figureTemplate: { id: string; name: string } | null;
    compositionTemplate: { id: string; name: string } | null;
  }[];
}
```

### 3.5. Service Validations

| Validation | Level | Behavior |
|-----------|-------|----------|
| Event exists | `EventSegmentService` | 404 if event not found |
| Segment belongs to event | `EventSegmentService` | 404 if segment's `eventId` doesn't match route param |
| Instance belongs to segment | `FigureInstanceService` | 404 if instance's `segmentId` doesn't match route param |
| XOR template/composition | `FigureInstanceService.create()` | 400 if both provided or neither provided |
| Template/composition exists | `FigureInstanceService.create()` | 404 if referenced template/composition not found |
| Reorder IDs match | Both services | 400 if provided IDs don't match existing records |

### 3.6. Delete Guards on Existing Modules

**`FigureTemplateService.remove()`**: Before deleting, check if any `FigureInstance` references this template. If so, return **409 Conflict** with message: "Aquesta figura s'utilitza a X events i no es pot eliminar."

**`CompositionTemplateService.remove()`**: Same check for composition references. **409 Conflict** with message: "Aquesta composició s'utilitza a X events i no es pot eliminar."

### 3.7. Permissions

All endpoints protected by `@UseGuards(AuthGuard, RolesGuard)` with roles `TECHNICAL` and `ADMIN`.

---

## 4. Frontend — Dashboard UI

### 4.1. Event List — Quick Access Column

Add a new column to the events `app-data-table`:

- **Icon**: Lucide `Layers`
- **Label**: Short text next to icon. Ex: "2 seg · 5 fig" (2 segments, 5 figures)
- **Click**: Navigates to event detail, scrolling/focusing to the Pinyes section
- **Tooltip**: Lists figure names per segment. Ex: "Bloc 1: pd4, pd3 · Bloc 2: Altar"
- **Empty state**: Gray icon, no label, tooltip "Sense pinyes"

Requires `GET /events` to return a computed summary:

```typescript
interface EventListItem {
  // ...existing fields...
  segmentsSummary: {
    segmentCount: number;
    instanceCount: number;
    segments: { name: string | null; figureNames: string[] }[];
  } | null;
}
```

The `segments` array preserves which figures belong to which segment, enabling the tooltip to render "Bloc 1: pd4, pd3 · Bloc 2: Altar".

### 4.2. Event Detail — Pinyes Section

New card inserted **between** the info/summary cards and the attendance list.

#### Card Header
- Title: "Pinyes" with `badge badge-neutral` showing segment count
- Button: "+ Segment" (creates a new empty segment)

#### Segment Cards (always visible, not collapsible)

Each segment renders as a sub-card (`bg-base-200 rounded-box p-3`):

**Segment header row:**
- Up/down arrow buttons (`btn btn-ghost btn-xs`) for reordering — disabled at boundaries
- Segment display name (auto-generated or custom, see §2.1)
- Optional time range in muted text: "19:30 – 20:00"
- Visibility toggle: Lucide `Eye` / `EyeOff` icon button
- Context menu button (`⋮`): "Editar" (inline edit of name/times/notes), "Eliminar" (with `app-confirm-dialog`)

**Segment body — figure chips:**
- Each `FigureInstance` displayed as a `badge` / chip:
  - Small icon distinguishing individual template vs composition (Lucide `Box` vs `Boxes`)
  - Figure/composition name (or custom label if set)
  - Context menu (`⋮`): "Editar template" (navigates to editor), "Canviar etiqueta" (inline edit), "Treure del segment" (with `app-confirm-dialog`)
- "+" button at the end of chips row to open figure picker modal

**Empty segment**: "Cap figura assignada" message + "Afegir figura" button

#### Empty State (no segments)
`app-empty-state` with Lucide `Layers` icon, message "Encara no hi ha pinyes per aquest event", CTA button "Crear primer segment".

### 4.3. Figure Picker Modal

Native `<dialog>` modal with DaisyUI styling:

- **Tabs**: "Figures" / "Composicions" (DaisyUI `tabs tabs-bordered`)
- **Search**: `input input-bordered input-sm` to filter by name
- **List**: Compact cards with name + short description. Single click adds immediately to the segment
- **Multi-add**: Modal stays open after adding. Each add triggers a toast "Figura afegida al segment"
- **Close**: "Tancar" button or backdrop click

### 4.4. Segment Creation Flow

1. Click "+ Segment" button
2. A new empty segment card appears at the end of the list
3. Segment name is `null` (displays "Segment N" placeholder)
4. Technician can immediately add figures via the "+" button or figure picker
5. As figures are added, the auto-generated name updates in real-time

### 4.5. Inline Segment Editing

Click "Editar" from segment context menu opens inline editing within the segment card:
- Name field (text input, placeholder with auto-generated name)
- Start time / End time fields (text inputs, optional)
- Notes field (textarea, optional)
- Save / Cancel buttons

### 4.6. New Angular Services

**`EventSegmentService`** (`apps/dashboard/src/app/features/pinyes/services/event-segment.service.ts`):
- `getByEvent(eventId: string): Observable<SegmentWithInstances[]>`
- `create(eventId: string, dto: CreateSegmentDto): Observable<EventSegment>`
- `update(eventId: string, segmentId: string, dto: UpdateSegmentDto): Observable<EventSegment>`
- `remove(eventId: string, segmentId: string): Observable<void>`
- `reorder(eventId: string, segmentIds: string[]): Observable<void>`

**`FigureInstanceService`** (`apps/dashboard/src/app/features/pinyes/services/figure-instance.service.ts`):
- `create(eventId: string, segmentId: string, dto: CreateInstanceDto): Observable<FigureInstance>`
- `update(eventId: string, segmentId: string, instanceId: string, dto: UpdateInstanceDto): Observable<FigureInstance>`
- `remove(eventId: string, segmentId: string, instanceId: string): Observable<void>`
- `reorder(eventId: string, segmentId: string, instanceIds: string[]): Observable<void>`

### 4.7. New Angular Components

**`SegmentManagerComponent`** (`apps/dashboard/src/app/features/events/components/segment-manager/`):
- Standalone component embedded in `event-detail`
- Input: `eventId` signal
- Manages segment list state, CRUD operations, reordering
- Contains figure picker modal

**`FigurePickerModalComponent`** (`apps/dashboard/src/app/features/pinyes/components/figure-picker-modal/`):
- Standalone modal component
- Tabs for templates and compositions
- Search filtering
- Emits selected figure/composition for the parent to create the instance

### 4.8. Frontend Models

**`segment.model.ts`** (`apps/dashboard/src/app/features/pinyes/models/`):

```typescript
export interface SegmentDetail {
  id: string;
  name: string | null;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isVisible: boolean;
  instances: InstanceDetail[];
}

export interface InstanceDetail {
  id: string;
  label: string | null;
  sortOrder: number;
  figureTemplate: { id: string; name: string } | null;
  compositionTemplate: { id: string; name: string } | null;
}
```

---

## 5. File Structure Summary

### 5.1. New Files

```
apps/api/src/modules/event-segment/
├── event-segment.module.ts
├── event-segment.controller.ts
├── event-segment.service.ts
├── figure-instance.service.ts
├── dto/
│   ├── create-segment.dto.ts
│   ├── update-segment.dto.ts
│   ├── reorder-segments.dto.ts
│   ├── create-instance.dto.ts
│   └── update-instance.dto.ts
└── entities/
    ├── event-segment.entity.ts
    └── figure-instance.entity.ts

apps/dashboard/src/app/features/events/components/
└── segment-manager/
    ├── segment-manager.component.ts
    ├── segment-manager.component.html
    └── segment-manager.component.scss

apps/dashboard/src/app/features/pinyes/
├── components/
│   └── figure-picker-modal/
│       ├── figure-picker-modal.component.ts
│       ├── figure-picker-modal.component.html
│       └── figure-picker-modal.component.scss
├── services/
│   ├── event-segment.service.ts
│   └── figure-instance.service.ts
└── models/
    └── segment.model.ts
```

### 5.2. Modified Files

| File | Change |
|------|--------|
| `apps/api/src/modules/event/event.entity.ts` | Add `OneToMany → EventSegment[]` |
| `apps/api/src/modules/event/event.service.ts` | Add `segmentsSummary` to list DTO query |
| `apps/api/src/modules/figure/entities/figure-template.entity.ts` | Add `OneToMany → FigureInstance[]` |
| `apps/api/src/modules/figure/figure-template.service.ts` | Add 409 guard on delete if instances exist |
| `apps/api/src/modules/composition/entities/composition-template.entity.ts` | Add `OneToMany → FigureInstance[]` |
| `apps/api/src/modules/composition/composition-template.service.ts` | Add 409 guard on delete if instances exist |
| `apps/api/src/app.module.ts` | Import `EventSegmentModule` |
| `apps/dashboard/.../events/components/event-detail/event-detail.component.ts` | Import and render `SegmentManagerComponent` |
| `apps/dashboard/.../events/components/event-detail/event-detail.component.html` | Insert segment-manager between info and attendance |
| `apps/dashboard/.../events/components/event-list/*` | Add Layers column with summary |
| `apps/dashboard/.../events/models/event.model.ts` | Add `segmentsSummary` to list model |

---

## 6. Accessibility

- All interactive elements keyboard-navigable (arrow buttons, context menus, modal)
- Context menus use DaisyUI `dropdown` with `tabindex="0"`
- Modal uses native `<dialog>` with focus trap
- Visibility toggle has `aria-label` describing current state
- Arrow buttons have `aria-label` ("Moure segment amunt" / "Moure segment avall")
- `type="button"` on all non-submit buttons
- Figure chips include `aria-label` with full figure name

---

## 7. Out of Scope (Deferred)

| Feature | Deferred to |
|---------|-------------|
| `NodeAssignment` (person → node) | P5.4 |
| Canvas view for assignment | P5.4 |
| Projection/fullscreen view | P5.5 |
| PWA member visibility of segments | P6 |
| `offsetX`, `offsetY`, `direction` on `FigureInstance` | P5.4 (if canvas needs positioning) |
| Drag-and-drop segment reordering | Future (arrows suffice for now) |
