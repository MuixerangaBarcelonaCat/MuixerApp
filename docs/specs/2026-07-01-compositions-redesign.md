# Compositions Redesign — Spec

> **Status:** Draft
> **Created:** 2026-07-01
> **Phases:** 4 (Phase 0 is cleanup, Phases 1–4 build the new feature)
> **Branch prefix:** `feat/compositions-redesign-phase-X`

## 1. Executive Summary

Replace the old composition feature with **compositions**: named spatial layouts of figure templates that can be applied to a segment in one action. Applying creates all the figure instances with distribution positions pre-filled and renames the segment to the composition name.

### What was wrong with the old feature

The old `CompositionTemplate` attached a `compositionTemplateId` FK to each `FigureInstance` individually. It had no spatial layout data (no x/y positions or rotation per figure). The compositions were conceptually a "type annotation" on instances rather than a useful spatial arrangement tool. The editor was functional but the entire concept was decoupled from the distribution system built in P5.

### New approach

A **composition** is a named set of figure templates with their position (x, y, angle, troncPanelX/Y), figure mode (completa/peu/remat/neta), and number of cordons. It is the template-level counterpart of a segment distribution.

**Workflow:**
1. In the Templates section → Composicions tab, create and edit compositions using a 3-column editor (template picker sidebar → canvas → properties panel).
2. In the assignment canvas → Add figure modal → Composicions tab, select a composition and click "Aplica". This creates all instances with distribution positions set and renames the segment.

---

## 2. What Gets Removed

### 2.1 Backend — old composition module

**Deleted entirely:**
- `apps/api/src/modules/composition/` — all 11 files (entities, service, controller, DTOs, module)

**Stripped from other modules:**

| File | What changes |
|---|---|
| `figure-instance.entity.ts` | Remove `compositionTemplate` `@ManyToOne` relation and field |
| `figure-instance.service.ts` | Remove `CompositionTemplate` import/injection; simplify `create()` to only accept `figureTemplateId`; remove `compositionTemplate` join in `findOneById()` |
| `event-segment.service.ts` | Remove `compositionTemplate` join in `getSegment()` / `getOne()`; remove `compositionTemplate` from `toSegmentWithInstances()` and `InstanceRef` type |
| `dto/create-instance.dto.ts` | Remove `compositionTemplateId` field |
| `app.module.ts` | Remove old `CompositionModule` import (a new one is added in Phase 1) |
| `figure-instance.service.spec.ts` | Remove `compositionTemplateRepository` mock and composition-related test cases |

### 2.2 Database migration — drop old tables

Migration `<timestamp>-DropOldCompositionTables.ts`:

```sql
-- Nullify FK column before dropping (safety in prod if any data exists)
UPDATE figure_instances SET "compositionTemplateId" = NULL WHERE "compositionTemplateId" IS NOT NULL;
-- Drop FK column
ALTER TABLE figure_instances DROP COLUMN IF EXISTS "compositionTemplateId";
-- Drop tables (order matters — slots FK references templates)
DROP TABLE IF EXISTS composition_slots;
DROP TABLE IF EXISTS composition_templates;
```

### 2.3 Frontend — old composition code

**Deleted files:**
- `components/composition-editor/composition-editor.component.ts` and `.html`
- `services/composition-template.service.ts`
- `models/composition.model.ts`

**Stripped from existing files:**

| File | What changes |
|---|---|
| `pinyes.routes.ts` | Remove `/compositions/new` and `/compositions/:id/edit` routes (re-added in Phase 3 pointing to new component) |
| `template-list.component.ts` | Remove all `compositions*` signals and methods; remove `CompositionTemplateService` injection; make "Composicions" tab render `<app-composition-grid-tab />` (stub) |
| `composition-grid-tab.component.ts` | Strip all old composition logic; make it a stub empty-state placeholder for Phase 4 |
| `figure-picker-modal.component.ts` | Remove `CompositionTemplateService`, `CompositionTemplateListItem`, composition loading; remove `compositionTemplateId` from `InstanceSelection`; keep "Composicions" tab structure as stub |
| `segment.model.ts` | Remove `compositionTemplate` from `InstanceDetail`; remove `compositionTemplateId` from `CreateInstancePayload` |
| `assignment-canvas.component.ts` | Remove `compositionSlotId: null` from the figure-instance create calls |

---

## 3. New Data Model

### 3.1 Tables

**`compositions`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | auto-generated |
| `name` | VARCHAR NOT NULL | |
| `description` | TEXT | nullable |
| `createdAt` | TIMESTAMP | auto |
| `updatedAt` | TIMESTAMP | auto |

**`composition_entries`**

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| `id` | UUID PK | | | |
| `compositionId` | UUID FK → compositions | | NO | ON DELETE CASCADE |
| `figureTemplateId` | UUID FK → figure_templates | | NO | ON DELETE RESTRICT |
| `label` | VARCHAR | | YES | name override for this figure within this composition |
| `offsetX` | FLOAT | 0 | NO | X position in the composition canvas |
| `offsetY` | FLOAT | 0 | NO | Y position |
| `angle` | FLOAT | 0 | NO | rotation in degrees |
| `troncPanelX` | FLOAT | | YES | null = linked (auto above figure) |
| `troncPanelY` | FLOAT | | YES | |
| `figureMode` | FigureMode ENUM | COMPLETA | NO | reuses existing `FigureMode` enum |
| `numberOfCordons` | INT | | YES | null = all cordons visible |
| `sortOrder` | INT | 0 | NO | display/creation order |

### 3.2 Entities

**`Composition`** (`apps/api/src/modules/composition/entities/composition.entity.ts`):

```typescript
@Entity('compositions')
export class Composition {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @OneToMany(() => CompositionEntry, (e) => e.composition, { cascade: true })
  entries: CompositionEntry[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**`CompositionEntry`** (`apps/api/src/modules/composition/entities/composition-entry.entity.ts`):

```typescript
@Entity('composition_entries')
export class CompositionEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Composition, (c) => c.entries, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn() composition: Composition;
  @ManyToOne(() => FigureTemplate, { nullable: false, onDelete: 'RESTRICT', eager: false })
  @JoinColumn() figureTemplate: FigureTemplate;
  @Column({ type: 'varchar', nullable: true }) label: string | null;
  @Column({ type: 'float', default: 0 }) offsetX: number;
  @Column({ type: 'float', default: 0 }) offsetY: number;
  @Column({ type: 'float', default: 0 }) angle: number;
  @Column({ type: 'float', nullable: true }) troncPanelX: number | null;
  @Column({ type: 'float', nullable: true }) troncPanelY: number | null;
  @Column({ type: 'enum', enum: FigureMode, default: FigureMode.COMPLETA }) figureMode: FigureMode;
  @Column({ type: 'int', nullable: true }) numberOfCordons: number | null;
  @Column({ type: 'int', default: 0 }) sortOrder: number;
}
```

---

## 4. API Changes

### 4.1 New module: `/compositions`

Module files live in `apps/api/src/modules/composition/` (recreated after the old module is deleted in Phase 0).

| Method | Endpoint | Response |
|---|---|---|
| GET | `/compositions` | Paginated list (`data`, `meta`) |
| GET | `/compositions/:id` | Full detail with entries + figure nodes |
| POST | `/compositions` | Created detail |
| PUT | `/compositions/:id` | Updated detail (entries fully replaced) |
| DELETE | `/compositions/:id` | 204 No Content |
| POST | `/compositions/:id/duplicate` | Duplicated detail |

**`CreateCompositionEntryDto`:**

```typescript
class CreateCompositionEntryDto {
  @IsUUID() figureTemplateId: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsNumber() offsetX?: number;    // default 0
  @IsOptional() @IsNumber() offsetY?: number;
  @IsOptional() @IsNumber() angle?: number;
  @IsOptional() @IsNumber() troncPanelX?: number | null;
  @IsOptional() @IsNumber() troncPanelY?: number | null;
  @IsOptional() @IsEnum(FigureMode) figureMode?: FigureMode;
  @IsOptional() @IsInt() numberOfCordons?: number | null;
  @IsOptional() @IsInt() sortOrder?: number;
}
```

**`CreateCompositionDto`:**

```typescript
class CreateCompositionDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @ValidateNested({ each: true }) entries?: CreateCompositionEntryDto[];
}
```

**`UpdateCompositionDto`:** all fields optional (same shape, wrapped in `@IsOptional()`).

**List response shape** (`CompositionListItem`):
```typescript
{ id, name, description, entryCount, createdAt, updatedAt }
```

**Detail response shape** (`CompositionDetail`):
```typescript
{
  id, name, description, createdAt, updatedAt,
  entries: [{
    id, label, offsetX, offsetY, angle, troncPanelX, troncPanelY,
    figureMode, numberOfCordons, sortOrder,
    // Tronc grid dimensions — computed by backend from tronc nodes (never stored).
    // Same computation as GET /segments/:id/distribution returns for DistributionItem.
    troncGridCols: number,
    troncGridRows: number,
    figureTemplate: { id, name, hasPinya, direction, nodes: FigureNodeItem[] }
  }]
}
```

`figureTemplate.nodes` includes all node types (PINYA, TRONC, BASE, directions). The editor frontend filters pinya nodes based on `figureMode` and `numberOfCordons` at render time, exactly like `DistributionEditorComponent.mapItemsToSlots()`.

### 4.2 New endpoint — apply composition to segment

Added to `EventSegmentController`:

```
POST /events/:eventId/segments/:segmentId/apply-composition
```

Body — `ApplyCompositionDto`:
```typescript
class ApplyCompositionDto {
  @IsUUID() compositionId: string;
}
```

**Implementation** (in `FigureInstanceService.applyComposition()`):
1. Verify segment belongs to event.
2. Load `Composition` (with entries + figureTemplate).
3. If not found → 404.
4. In a transaction:
   a. Update `segment.name = composition.name`.
   b. For each entry (ordered by `sortOrder`), compute the next `sortOrder` for the segment and create a `FigureInstance` with:
      - `figureTemplate = entry.figureTemplate`
      - `label = entry.label`
      - `figureMode = entry.figureMode`
      - `numberOfCordons = entry.numberOfCordons`
      - `projectionX = entry.offsetX`
      - `projectionY = entry.offsetY`
      - `projectionAngle = entry.angle`
      - `troncPanelX = entry.troncPanelX`
      - `troncPanelY = entry.troncPanelY`
5. Save all instances.
6. Return the updated `SegmentWithInstances` (same shape as `GET /events/:eventId/segments/:segmentId`).

**Note on existing instances:** applying a composition to a segment that already has instances will append the new instances (it does not replace). The segment name is always updated. This is intentional — the user is in control of clearing instances first if needed.

**Response:** `SegmentWithInstances` (200).

**Error cases:**
- 404 if composition or segment/event not found.

### 4.3 `CompositionService` — implementation notes

`syncEntries()` (used by `create` and `update`) deletes all existing entries for the composition and recreates them from the DTO. Entry IDs are not client-controlled.

`duplicate()` deep-copies name (appends ` - còpia`), description, and all entries (new UUIDs, same figureTemplateId references).

---

## 5. Frontend Changes

### 5.1 New model file

`apps/dashboard/src/app/features/pinyes/models/composition.model.ts` (new file replacing the deleted old one — completely different shape)

```typescript
export interface CompositionEntryItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  angle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  figureMode: FigureMode;
  numberOfCordons: number | null;
  sortOrder: number;
  troncGridCols: number;
  troncGridRows: number;
  figureTemplate: FigureTemplateDetail;
}

export interface CompositionDetail {
  id: string;
  name: string;
  description: string | null;
  entries: CompositionEntryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CompositionListItem {
  id: string;
  name: string;
  description: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

// Payload types
export interface CreateCompositionEntryPayload {
  figureTemplateId: string;
  label?: string;
  offsetX: number;
  offsetY: number;
  angle: number;
  troncPanelX?: number | null;
  troncPanelY?: number | null;
  figureMode?: FigureMode;
  numberOfCordons?: number | null;
  sortOrder?: number;
}

export interface CreateCompositionPayload {
  name: string;
  description?: string;
  entries?: CreateCompositionEntryPayload[];
}

export interface UpdateCompositionPayload {
  name?: string;
  description?: string;
  entries?: CreateCompositionEntryPayload[];
}

export interface PaginatedCompositions {
  data: CompositionListItem[];
  meta: { total: number; page: number; limit: number };
}
```

### 5.2 New service: `CompositionService`

`apps/dashboard/src/app/features/pinyes/services/composition.service.ts` (replaces the deleted `composition-template.service.ts`)

```typescript
@Injectable({ providedIn: 'root' })
export class CompositionService {
  getAll(filters): Observable<PaginatedCompositions>
  getOne(id: string): Observable<CompositionDetail>
  create(payload: CreateCompositionPayload): Observable<CompositionDetail>
  update(id: string, payload: UpdateCompositionPayload): Observable<CompositionDetail>
  remove(id: string): Observable<void>
  duplicate(id: string): Observable<CompositionDetail>
  applyToSegment(eventId: string, segmentId: string, compositionId: string): Observable<SegmentDetail>
}
```

`applyToSegment` sends `POST /api/events/:eventId/segments/:segmentId/apply-composition` with body `{ compositionId }`.

### 5.3 New `CompositionEditorComponent`

Route: `/pinyes/compositions/:id/edit` (edit) and `/pinyes/compositions/new` (create).

New file at the same path as the deleted old component — completely different implementation.

**Layout:** fullscreen 3-column, same fullscreen mechanism as `DistributionEditorComponent` (`layoutService.requestFullscreen()` / `exitFullscreen()`).

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Composicions   [Nom de la composició............]  ● Alçat ✓    │
│  □ Quadrícula  ⊞ Snap  ⊞ Ajusta tot                                 │
├─────────────────┬────────────────────────────────┬──────────────────┤
│  Figures        │                                │  Propietats      │
│  [Cerca...]     │                                │  (quan          │
│  ┌──────────┐   │      FigureCanvasComponent     │   seleccionada)  │
│  │Pilar 3   │   │      mode: 'composition'       │                  │
│  │Pilar 4   │   │      (amb rotació)             │  Nom            │
│  │Dos de 6  │   │                                │  Mode           │
│  │...       │   │                                │  Cordons        │
│  └──────────┘   │                                │  X / Y / Angle  │
│                 │                                │  [Elimina]       │
└─────────────────┴────────────────────────────────┴──────────────────┘
```

**Left panel (280 px) — figure template picker:**
- Search input (filters synchronously)
- Scrollable list of `FigureTemplateListItem[]` loaded on mount via `FigureTemplateService.getAll({ limit: 200 })`
- Click on a template: adds a new entry at `(maxOffsetX + 300, 0)` with `figureMode: COMPLETA`, `numberOfCordons: null`, `angle: 0`
- If composition has no saved id yet (new): on first add, POSTs to create the composition (uses the figure's name as the initial composition name if the user hasn't typed one yet), then navigates to `/pinyes/compositions/:id/edit` via `router.navigate([...], { replaceUrl: true })`

**Center panel — `FigureCanvasComponent`:**
- `mode="composition"` — same mode as the distribution editor. Tronc panels are rendered and draggable when `angle`, `troncGridCols`, and `troncGridRows` are set on the slot (canvas condition at line 981–983 of `figure-canvas.component.ts`).
- `compositionSlots` computed from composition entries, mapping identically to how `DistributionEditorComponent.mapItemsToSlots()` works:
  - `slotId = entry.id` (or a temp ID for unsaved entries)
  - `offsetX = entry.offsetX`, `offsetY = entry.offsetY`, `angle = entry.angle`
  - `troncGridCols = entry.troncGridCols`, `troncGridRows = entry.troncGridRows`
  - `troncPanelX = entry.troncPanelX`, `troncPanelY = entry.troncPanelY`
  - `figureTemplate.nodes` filtered by `figureMode` and `numberOfCordons`
- `(slotSelected)` output → sets `selectedEntryId`
- `(slotMoved)` output (carries `{ slotId, offsetX, offsetY, angle }`) → updates entry in local state, schedules autosave
- `(troncMoved)` output (carries `{ slotId, troncPanelX, troncPanelY }`) → updates `entry.troncPanelX/Y` in local state, schedules autosave

**Right panel (280 px) — entry properties:**

Visible when `selectedEntryId !== null`. Fields:

| Field | Control | Notes |
|---|---|---|
| **Nom** | text input | `entry.label`; placeholder is the template name; null when empty |
| **Mode** | select | COMPLETA / PEU / REMAT / NETA; Catalan labels "Completa / Peu / Remat / Neta" |
| **Cordons** | number input (1–N) | shown only when mode is COMPLETA or PEU; empty = all (`null`) |
| **X** | number input | mirrors `entry.offsetX`; synced bidirectionally with canvas drag |
| **Y** | number input | mirrors `entry.offsetY` |
| **Angle** | number input (degrees) | mirrors `entry.angle` |
| **Elimina** | danger button | removes entry from local state, clears `selectedEntryId`, schedules autosave |

When mode changes to REMAT or NETA, `numberOfCordons` is forced to `null` and the cordons input is hidden.

**Top bar:**
- Back button → `/pinyes?tab=compositions`
- Composition name: inline `<input>` (auto-saves on change)
- Save status indicator: same `'idle' | 'saving' | 'saved' | 'error'` pattern as distribution editor
- Grid toggle, snap toggle, fit-all button

**Autosave:** debounced 1500 ms after any change. Calls `CompositionService.update(id, { name, description, entries })`.

**Entries payload** on save:
```typescript
entries: localEntries.map((e) => ({
  figureTemplateId: e.figureTemplate.id,
  label: e.label ?? undefined,
  offsetX: e.offsetX,
  offsetY: e.offsetY,
  angle: e.angle,
  troncPanelX: e.troncPanelX ?? null,
  troncPanelY: e.troncPanelY ?? null,
  figureMode: e.figureMode,
  numberOfCordons: e.numberOfCordons ?? null,
  sortOrder: e.sortOrder,
}))
```

After each save, the returned detail is merged back into local state (entry IDs update from temp IDs to real UUIDs).

### 5.4 Updated routes

In `pinyes.routes.ts`, replace the two old composition routes with the new component:
```typescript
{
  path: 'compositions/new',
  loadComponent: () =>
    import('./components/composition-editor/composition-editor.component')
      .then((m) => m.CompositionEditorComponent),
},
{
  path: 'compositions/:id/edit',
  loadComponent: () =>
    import('./components/composition-editor/composition-editor.component')
      .then((m) => m.CompositionEditorComponent),
},
```

### 5.5 Repurposed `CompositionGridTabComponent`

Component file stays, internals replaced. Injects `CompositionService`.

**UI:**
- "Nova composició" button → navigate to `/pinyes/compositions/new`
- Search input + pagination (same pattern as `FigureListTabComponent`)
- Cards showing: name, entry count ("X figures"), description snippet, formatted date
- Card actions: "Edita" (navigate to editor), "Duplica", "Elimina" (with inline confirm)

Delete: straightforward (no cascading instance reference check — compositions are not attached to instances in the new model).

### 5.6 Simplified `TemplateListComponent`

- Remove all inline `compositions*` signals, methods, and `CompositionTemplateService` injection
- Import `CompositionGridTabComponent` in the standalone `imports` array
- In the template, the "Composicions" tab body renders `<app-composition-grid-tab />` directly
- The `figures` tab code is untouched

### 5.7 Updated `FigurePickerModalComponent`

The "Composicions" tab is repurposed to show compositions. Figures tab is unchanged.

**Changes:**
- Replace `CompositionTemplateService` injection with `CompositionService`
- Replace `CompositionTemplateListItem[]` with `CompositionListItem[]`
- `loadCompositions()` calls `CompositionService.getAll({ limit: 200 })`
- Remove `addComposition()` method and the `compositionTemplateId` path from `InstanceSelection`
- The compositions tab shows a single-select list (clicking a card highlights it as `selectedComposition`)
- When a composition is selected, the bottom action bar shows: "Aplica «{name}»" button
- Clicking that button emits the new `compositionSelected` output and closes the modal

**New output:**
```typescript
compositionSelected = output<{ compositionId: string; compositionName: string }>();
```

The existing `confirmed` output continues to carry only figure template selections (unchanged API for the figures tab).

**`InstanceSelection` interface** (cleaned up):
```typescript
export interface InstanceSelection {
  figureTemplateId: string;  // compositionTemplateId removed
}
```

### 5.8 Updated `SegmentManagerComponent`

The `FigurePickerModal` already lives in `SegmentManagerComponent` (not in `AssignmentCanvasComponent`). The manager owns `eventId` as an `input()` and tracks the open segment via `pickerSegmentId` signal. The existing `onInstancesConfirmed()` handler is the model to follow.

In the template, wire the new output alongside the existing `(confirmed)`:
```html
<app-figure-picker-modal
  ...
  (confirmed)="onInstancesConfirmed($event)"
  (compositionSelected)="onCompositionSelected($event)"
/>
```

New handler:
```typescript
onCompositionSelected(event: { compositionId: string; compositionName: string }): void {
  const segmentId = this.pickerSegmentId();
  if (!segmentId) return;

  this.compositionService
    .applyToSegment(this.eventId(), segmentId, event.compositionId)
    .subscribe({
      next: (updatedSegment) => {
        this.segments.update((list) =>
          list.map((s) => (s.id === segmentId ? updatedSegment : s)),
        );
        this.toast.success(`Composició "${event.compositionName}" aplicada`);
        this.closePicker();
      },
      error: () => this.toast.error("No s'ha pogut aplicar la composició"),
    });
}
```

Inject `CompositionService` in the component constructor.

---

## 6. Implementation Phases

### Phase 0 — Cleanup: Remove Old Compositions

**Goal:** codebase compiles cleanly with the old composition feature removed. All existing tests still pass.

**Backend:**
- Write and apply migration `<ts>-DropOldCompositionTables.ts`
- Delete `apps/api/src/modules/composition/` directory (all 11 files)
- Remove old `CompositionModule` from `AppModule`
- Strip `FigureInstance` entity, `FigureInstanceService`, `EventSegmentService`, `InstanceRef`, `CreateInstanceDto` as described in §2.2
- Update `figure-instance.service.spec.ts`: remove mocked `compositionTemplateRepository` and composition-branch test cases

**Frontend:**
- Delete `composition-editor/` directory
- Delete `services/composition-template.service.ts`
- Delete `models/composition.model.ts`
- Remove old composition routes from `pinyes.routes.ts`
- Strip `TemplateListComponent` of all composition code; make the "Composicions" tab render `<app-composition-grid-tab />` (stub empty state)
- Strip `CompositionGridTabComponent` to a stub empty state
- Strip `FigurePickerModalComponent` of all composition loading; keep the "Composicions" tab button but show an empty state in the tab body
- Remove `compositionTemplate` from `segment.model.ts`
- Remove `compositionSlotId: null` from `AssignmentCanvasComponent`

**Deliverable:** clean build, passing tests, old compositions gone.

---

### Phase 1 — Backend: New Data Model + CRUD API

**Migration:**
- `<ts>-CreateCompositions.ts`: creates `compositions` and `composition_entries` tables

**New files in `apps/api/src/modules/composition/`** (new module recreated at same path):
- `composition.module.ts` — registers entities, service, controller; imports `TypeOrmModule.forFeature()`; imported by `AppModule`
- `entities/composition.entity.ts`
- `entities/composition-entry.entity.ts`
- `dto/create-composition.dto.ts`
- `dto/update-composition.dto.ts`
- `dto/composition-filter.dto.ts`
- `composition.service.ts` — `findAll`, `findOne`, `create`, `update`, `remove`, `duplicate`
- `composition.controller.ts` — 6 endpoints (see §4.1)
- `composition.controller.spec.ts` — integration tests

**Apply endpoint:**
- Add `applyComposition(eventId, segmentId, compositionId)` method to `FigureInstanceService` (already has access to `FigureInstanceRepository`, `EventSegmentRepository`; add `CompositionRepository` injection)
- Add `POST :segmentId/apply-composition` endpoint to `EventSegmentController` (body: `ApplyCompositionDto`)
- Add `ApplyCompositionDto` to `apps/api/src/modules/event-segment/dto/`
- Update `EventSegmentModule` to import `Composition` entity (for the inject)

**Tests:**
- `CompositionService`: findAll pagination, findOne with relations, create+entries, update (entries replaced), remove, duplicate
- `CompositionController`: basic CRUD e2e
- `FigureInstanceService.applyComposition`: creates correct instances, sets distribution fields, updates segment name; 404 for missing composition

**Deliverable:** CRUD + apply endpoints fully tested.

---

### Phase 2 — Frontend: Service + Model

**New files:**
- `models/composition.model.ts` (see §5.1 — new shape, not the old one)
- `services/composition.service.ts` (see §5.2)
- `services/composition.service.spec.ts` — tests for HTTP methods (HttpClientTestingModule)

**Deliverable:** typed service layer ready for editor and list components.

---

### Phase 3 — Frontend: Composition Editor

**New files:**
- `components/composition-editor/composition-editor.component.ts` (new file at same path as deleted old component — completely different implementation)
- `components/composition-editor/composition-editor.component.html`

**Update:**
- `pinyes.routes.ts`: replace old composition routes with new component (see §5.4)

**Implementation notes:**
- The component follows the same structure as `DistributionEditorComponent` but with a left figure-picker panel and a right properties panel added
- For the entry-to-slot mapping, apply the same pinya node filtering by `figureMode` and `numberOfCordons` that `DistributionEditorComponent.mapItemsToSlots()` does — extract this logic into a shared utility (`mapEntryToSlot()` in a new util file or co-located) to avoid duplication
- Temp IDs use `temp-${Date.now()}-${index}` pattern for unsaved entries; after a POST/PUT response the component re-maps real IDs
- The "new composition" flow: `isNew = !route.snapshot.paramMap.get('id')`. On first figure add, if `nameValue` is empty auto-set it to the template name; immediately POST and navigate to edit URL
- Properties panel angle input uses `type="number"` and updates `entry.angle` directly; the canvas `slotMoved` event also updates the angle when the rotation handle is dragged

**Tests:**
- Load existing composition → entries mapped to canvas slots
- `slotMoved` → local entry updated
- Autosave debounce: timer fires after 1500 ms → `update()` called
- Mode change → node filtering recomputed (via `mapEntryToSlot`)
- Delete entry → removed from local state, `selectedEntryId` cleared
- New composition flow: first add → POST called, navigate to edit URL

**Deliverable:** users can create and edit compositions.

---

### Phase 4 — Frontend: List + Apply

**Update `CompositionGridTabComponent`** (see §5.5):
- Wire `CompositionService.getAll()`, create/edit/duplicate/delete flows
- Delete shows inline confirm with composition name

**Update `TemplateListComponent`** (see §5.6):
- Remove inline composition code; import and render `CompositionGridTabComponent`

**Update `FigurePickerModalComponent`** (see §5.7):
- Replace old composition service with `CompositionService`
- Single-select flow + `compositionSelected` output

**Update `SegmentManagerComponent`** (see §5.8):
- Wire `(compositionSelected)` handler
- Inject `CompositionService`

**Tests:**
- `CompositionGridTabComponent`: list loads, delete confirms, navigate to editor
- `FigurePickerModalComponent`: compositions tab shows list; selecting one enables "Aplica" button; confirming emits `compositionSelected`
- `SegmentManagerComponent`: `onCompositionSelected` calls apply endpoint, updates matching segment in `segments` signal on success

**Deliverable:** full end-to-end — define composition in Templates → apply in assignment canvas → instances created with positions, segment renamed.

---

## 7. Open Questions

- **Segment name on apply:** if `segment.name` is already set when apply is called, it is still overwritten with the composition name. If this feels destructive, we can add a `renameTo` flag on the DTO, but keeping it simple for now.
- **Composition name uniqueness:** `name` is not enforced as unique at DB level (unlike old `slug`). Not adding a unique constraint — different events/seasons may reuse the same composition name.

---

## 8. Out of Scope

- Composition "preview" thumbnail in the picker modal or list grid
- Per-entry scale override (figures are natural size, same as the distribution editor)
- Undo/redo in the composition editor
- Importing from an existing segment distribution ("save as composition" action)
