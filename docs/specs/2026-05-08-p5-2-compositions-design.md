# P5.2 — Mòdul Pinyes: Composicions

> **Data**: 8 de maig de 2026
> **Estat**: Pendent d'aprovació
> **Depèn de**: P5.1 (Templates i Editor Visual)
> **Spec pare**: `docs/specs/2026-05-07-p5-figures-module-overview-design.md` (secció 11, P5.2)

---

## 1. Objectiu

Implementar la gestió de **composicions** (`CompositionTemplate` + `CompositionSlot`): arranjaments reutilitzables que agrupen múltiples `FigureTemplate` amb posicions relatives (offsets).

Exemples reals: un "Altar" és una composició de 1 pd4 + 2 pd3 + 2 pd2. Un "5 de Oros" és 5 figures disposades en creu.

---

## 2. Model de Dades

### 2.1. Entitats

Les entitats segueixen la definició de l'spec pare (secció 4.1).

#### `CompositionTemplate`

Table: `composition_templates`

| Camp | Tipus DB | TypeScript | Nullable | Notes |
|------|----------|------------|----------|-------|
| `id` | `uuid` | `string` | No | PK, auto-generat |
| `name` | `varchar` | `string` | No | Únic. Ex: "Altar", "5 de Oros" |
| `slug` | `varchar` | `string` | No | Únic. Ex: "altar", "5-de-oros" |
| `description` | `text` | `string \| null` | Sí | Notes del tècnic |
| `createdAt` | `timestamp` | `Date` | No | Auto |
| `updatedAt` | `timestamp` | `Date` | No | Auto |

Relations:
- `OneToMany → CompositionSlot` (cascade: true)

#### `CompositionSlot`

Table: `composition_slots`

| Camp | Tipus DB | TypeScript | Nullable | Notes |
|------|----------|------------|----------|-------|
| `id` | `uuid` | `string` | No | PK, auto-generat |
| `composition` | FK → `composition_templates` | `CompositionTemplate` | No | ManyToOne, CASCADE delete |
| `figureTemplate` | FK → `figure_templates` | `FigureTemplate` | No | ManyToOne, RESTRICT delete |
| `label` | `varchar` | `string \| null` | Sí | Ex: "pd4 central", "pd3 esquerra" |
| `offsetX` | `float` | `number` | No | Default `0`. Posició relativa X |
| `offsetY` | `float` | `number` | No | Default `0`. Posició relativa Y |
| `sortOrder` | `int` | `number` | No | Default `0`. Ordre visual |

Relations:
- `ManyToOne → CompositionTemplate` (onDelete: CASCADE)
- `ManyToOne → FigureTemplate` (onDelete: RESTRICT — cannot delete a template in use)

### 2.2. Integritat Referencial

| Acció | Comportament | Detall |
|-------|-------------|--------|
| Eliminar `CompositionTemplate` | CASCADE slots | Tots els `CompositionSlot` associats s'eliminen |
| Eliminar `FigureTemplate` amb slots | **409 Conflict** | Si el template està referenciat per algun `CompositionSlot`, retorna error amb llistat de composicions afectades |
| Eliminar `FigureTemplate` sense slots | Normal | Eliminació permesa |
| Modificar `FigureTemplate` | **Propagació en viu** | Les composicions que referencien aquell template reflecteixen els canvis automàticament (FK, no còpia) |
| Eliminar `CompositionTemplate` amb `FigureInstance`s | **409 Conflict** | Preparat per P5.3: si la composició té instàncies actives, no es pot eliminar |

**Canvi a `FigureTemplateService.remove()`**: Abans d'eliminar, comprovar si existeix algun `CompositionSlot` referenciant el template. Si existeix → `ConflictException` amb missatge informatiu.

---

## 3. API Endpoints

Base path: `/api/composition-templates`

| Mètode | Endpoint | Descripció | Response |
|--------|----------|------------|----------|
| `GET` | `/api/composition-templates` | Llistat amb cerca i paginació | `{ data, meta }` |
| `POST` | `/api/composition-templates` | Crear composició amb slots inline | `CompositionTemplateDetail` |
| `GET` | `/api/composition-templates/:id` | Detall amb slots i figure templates populats (incl. nodes) | `CompositionTemplateDetail` |
| `PUT` | `/api/composition-templates/:id` | Actualitzar composició + slots (reemplaçament complet) | `CompositionTemplateDetail` |
| `DELETE` | `/api/composition-templates/:id` | Eliminar (409 si té instàncies a P5.3) | 204 |
| `POST` | `/api/composition-templates/:id/duplicate` | Duplicar composició amb tots els slots | `CompositionTemplateDetail` |

Permisos: Tots protegits per `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`.

### 3.1. DTOs

#### `CreateCompositionSlotDto`

```typescript
{
  figureTemplateId: string;  // UUID, required
  label?: string;            // optional
  offsetX: number;           // required, default 0
  offsetY: number;           // required, default 0
  sortOrder?: number;        // optional, default 0
}
```

#### `CreateCompositionTemplateDto`

```typescript
{
  name: string;              // required, unique
  slug: string;              // required, unique
  description?: string;      // optional
  slots: CreateCompositionSlotDto[];  // required (can be empty)
}
```

#### `UpdateCompositionTemplateDto`

All fields optional. `slots` optional — when provided, full replace (delete all + recreate).

#### `CompositionTemplateFilterDto`

```typescript
{
  search?: string;   // name or slug (ILIKE, unaccent)
  page?: number;     // default 1
  limit?: number;    // default 25
}
```

### 3.2. Response Shapes

#### List item

```typescript
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Detail (GET /:id, POST, PUT, POST /duplicate)

```typescript
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotCount: number;
  createdAt: Date;
  updatedAt: Date;
  slots: Array<{
    id: string;
    label: string | null;
    offsetX: number;
    offsetY: number;
    sortOrder: number;
    figureTemplate: {
      id: string;
      name: string;
      slug: string;
      hasPinya: boolean;
      direction: number;
      nodeCount: number;
      nodes: FigureNodeItem[];  // Full nodes for canvas rendering
    };
  }>;
}
```

The detail endpoint includes full `nodes[]` of each referenced `FigureTemplate` because the composition editor canvas needs to render all nodes.

### 3.3. Validation Rules

| Rule | Where |
|------|-------|
| `figureTemplateId` must reference an existing `FigureTemplate` | Service (NotFoundException) |
| `name` must be unique | DB constraint (409 on duplicate) |
| `slug` must be unique | DB constraint (409 on duplicate) |
| Same `FigureTemplate` can appear multiple times in one composition | Allowed (ex: 2× pd3 in an Altar) |

---

## 4. Backend Architecture

### 4.1. Module Structure

```
apps/api/src/modules/composition/
├── entities/
│   ├── composition-template.entity.ts
│   └── composition-slot.entity.ts
├── dto/
│   ├── create-composition-template.dto.ts
│   ├── update-composition-template.dto.ts
│   ├── create-composition-slot.dto.ts
│   └── composition-template-filter.dto.ts
├── composition-template.controller.ts
├── composition-template.service.ts
├── composition-template.service.spec.ts
├── composition-template.controller.spec.ts
└── composition.module.ts
```

### 4.2. Module Wiring

- `CompositionModule` imports `TypeOrmModule.forFeature([CompositionTemplate, CompositionSlot])`.
- Also imports `FigureModule` (needs `FigureTemplateService` for validation) OR injects `Repository<FigureTemplate>` directly.
- Registered in `AppModule`.
- `FigureModule` imports `CompositionModule` would create circular dependency → inject `Repository<CompositionSlot>` in `FigureTemplateService` instead.

**Chosen approach**: `FigureTemplateService` receives `Repository<CompositionSlot>` via `TypeOrmModule.forFeature([CompositionSlot])` added to `FigureModule.imports`. This avoids circular module dependencies while enabling the referential integrity check on delete.

### 4.3. Service Pattern

`CompositionTemplateService` follows the same pattern as `FigureTemplateService`:

- `findAll(filters)` → QueryBuilder with search (unaccent ILIKE), pagination, `slotCount` via `loadRelationCountAndMap`.
- `findOne(id)` → Loads with relations `['slots', 'slots.figureTemplate', 'slots.figureTemplate.nodes']`.
- `create(dto)` → Save template, validate each `figureTemplateId` exists, create slots.
- `update(id, dto)` → Patch scalar fields, sync slots (delete all + recreate) when `slots` is provided.
- `remove(id)` → Check for `FigureInstance` references (P5.3, prep-only). Remove.
- `duplicate(id)` → Copy template + all slots with same figureTemplate references.

### 4.4. FigureTemplate Delete Protection

Add to `FigureTemplateService.remove()`:

```typescript
const slotCount = await this.compositionSlotRepository.count({
  where: { figureTemplate: { id } },
});
if (slotCount > 0) {
  throw new ConflictException(
    `Cannot delete FigureTemplate: it is referenced by ${slotCount} composition slot(s)`,
  );
}
```

---

## 5. Frontend — Dashboard

### 5.1. Listing (Tab "Composicions")

Replace the current placeholder in `TemplateListComponent`:

- Same card grid layout as figures.
- Each card: name, slug, description, figure count (slotCount), updated date.
- Preview: `LayoutGrid` icon with badge showing figure count.
- Actions: Editar, Duplicar, Eliminar (confirm-dialog).
- "+ Nova composició" button in header (visible when tab = `'compositions'`).
- Search with debounce 300ms (same pattern as figures).
- Loading/empty states reuse shared components (`skeleton-cards`, `empty-state`).

### 5.2. Composition Editor

New component: `CompositionEditorComponent` at `/pinyes/compositions/:id/edit` and `/pinyes/compositions/new`.

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ◀ Tornar │ Nom ─ Slug │ ○ Guardat │
├─────────┬───────────────────────────────────┬───────────────┤
│ FIGURES │                                   │  PROPIETATS   │
│ [search]│                                   │               │
│         │                                   │  Label: ____  │
│ ┌─────┐ │        KONVA CANVAS               │  Offset X: _  │
│ │ pd4 │ │   (pinya-view nodes, read-only)   │  Offset Y: _  │
│ ├─────┤ │                                   │               │
│ │ pd3 │ │      ○  ○ ○  ○                    │  Figura: pd4  │
│ ├─────┤ │    ○ ○ ○ ○ ○ ○ ○                  │  → Editar ↗   │
│ │ pd2 │ │      ○  ○ ○  ○                    │               │
│ └─────┘ │                                   │  [Eliminar]   │
└─────────┴───────────────────────────────────┴───────────────┘
```

#### Top Bar

- Back link to `/pinyes` (tab composicions).
- Inline editable name + slug (same UX as template editor).
- Description field (expandable).
- Auto-save indicator (Guardat / Guardant... / Error).

#### Left Panel — Figure Picker

- Searchable list of all `FigureTemplate`s (calls `GET /api/figure-templates` with search).
- Each item shows: name, nodeCount badge, hasPinya indicator.
- Click → adds a new slot to the composition at offset (0, 0) with the selected figure template.
- Same figure can be added multiple times (each creates a new slot).

#### Center — Konva Canvas

Reuses `FigureCanvasComponent` with a new mode: `'composition'`.

**New inputs for composition mode:**

```typescript
// New input: composition slots with their figure templates' nodes
compositionSlots: input<CompositionSlotWithNodes[]>([]);
```

Where:
```typescript
interface CompositionSlotWithNodes {
  slotId: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: {
    id: string;
    name: string;
    hasPinya: boolean;
    nodes: FigureNodeItem[];
  };
}
```

**Which nodes are rendered?**

The composition canvas shows only the **pinya-view** of each figure: nodes with zone `PINYA` plus nodes with zone `TRONC` and `z === 0` (baixos). These are the same nodes the template editor renders in its pinya layer. Upper tronc floors (z ≥ 1: segons, terços, alçadora, xiqueta) are **not shown** — they are vertical and have no spatial relationship with adjacent figures.

To view or edit the tronc of a figure within a composition, the user clicks "Editar figura ↗" in the right panel, which opens the full template editor (with tronc panel) in a new tab.

**Canvas behavior in composition mode:**

| Aspect | Behavior |
|--------|----------|
| Rendering | For each slot, render pinya-view nodes (zone PINYA + TRONC z=0) with offset applied (`node.x + slot.offsetX`, `node.y + slot.offsetY`). Same visual as template editor pinya layer (shapes, colors, labels). |
| Group label | Floating text above each figure group with the figure name (e.g., "pd4 central") |
| Group border | Subtle dashed bounding box around each figure group to visually separate figures |
| Selection | Click any node → selects the entire slot/group (highlight all nodes in group) |
| Drag | Drag any node → moves the entire group. Updates `offsetX`/`offsetY` of the slot |
| Individual nodes | NOT draggable, NOT resizable, NOT editable. Read-only rendering |
| Grid | Available (toggle), snap-to-grid applies to group position |
| Zoom/Pan | Same as template editor |

**New outputs:**

```typescript
slotSelected: output<string | null>();  // slotId
slotMoved: output<{ slotId: string; offsetX: number; offsetY: number }>();
```

#### Right Panel — Slot Properties

Visible when a slot is selected:

- **Label**: Editable text input for the slot label (e.g., "pd3 esquerra").
- **Offset X / Offset Y**: Numeric inputs. Updates canvas position and vice-versa (bidirectional sync via drag).
- **Figura**: Read-only display of the referenced `FigureTemplate` name.
  - **Link "Editar figura ↗"**: `routerLink` to `/pinyes/templates/:figureTemplateId/edit` opening in a new tab (`target="_blank"`). Allows the user to edit the base template. Changes propagate automatically since the composition references the template by FK.
- **Eliminar slot**: Button with confirmation. Removes the slot from the composition.

**Not shown in P5.2:** `sortOrder` exists in the entity/API but is not exposed in the composition editor UI. It will be relevant at P5.3 when ordering instances within a segment.

When no slot is selected: empty state with hint text.

### 5.3. Routes

Add to `pinyes.routes.ts`:

```typescript
{
  path: 'compositions/new',
  loadComponent: () =>
    import('./components/composition-editor/composition-editor.component')
      .then(m => m.CompositionEditorComponent),
},
{
  path: 'compositions/:id/edit',
  loadComponent: () =>
    import('./components/composition-editor/composition-editor.component')
      .then(m => m.CompositionEditorComponent),
},
```

### 5.4. Service

`CompositionTemplateService` extends `ApiService`:

- `getAll(params)` → `GET /composition-templates`
- `getOne(id)` → `GET /composition-templates/:id`
- `create(payload)` → `POST /composition-templates`
- `update(id, payload)` → `PUT /composition-templates/:id`
- `delete(id)` → `DELETE /composition-templates/:id`
- `duplicate(id)` → `POST /composition-templates/:id/duplicate`

### 5.5. Models

New file: `models/composition.model.ts`

```typescript
interface CompositionSlotItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: FigureTemplateDetail;
}

interface CompositionTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CompositionTemplateDetail extends CompositionTemplateListItem {
  slots: CompositionSlotItem[];
}
```

### 5.6. Auto-save

Same pattern as template-editor:

1. Any change (name, slug, description, slot added/removed/moved/label changed) triggers a debounced save (2s).
2. `PUT /composition-templates/:id` with full current state.
3. Indicator: "Guardat ✓" / "Guardant..." / "Error en guardar".
4. New composition: `POST` first, then `replaceUrl` to `/:id/edit`.

---

## 6. Tests

### 6.1. Backend — `composition-template.service.spec.ts`

| Test | Description |
|------|-------------|
| **findAll — empty list** | Returns `{ data: [], total: 0 }` |
| **findAll — search filter** | Applies ILIKE with unaccent on name and slug |
| **findAll — pagination** | Correct skip/take values |
| **findOne — success** | Returns detail with slots and populated figureTemplate + nodes |
| **findOne — not found** | Throws `NotFoundException` |
| **create — without slots** | Creates composition, returns detail |
| **create — with slots** | Creates composition + slots, validates figureTemplateIds exist |
| **create — invalid figureTemplateId** | Throws `NotFoundException` for non-existent figure template |
| **update — scalar fields** | Patches name, slug, description |
| **update — replace slots** | Deletes existing slots, creates new ones |
| **update — not found** | Throws `NotFoundException` |
| **remove — success** | Removes composition |
| **remove — not found** | Throws `NotFoundException` |
| **duplicate — success** | Creates copy with "(còpia)" suffix and same slots |
| **duplicate — not found** | Throws `NotFoundException` |

### 6.2. Backend — `composition-template.controller.spec.ts`

| Test | Description |
|------|-------------|
| **findAll — envelope** | Returns `{ data, meta: { total, page, limit } }` |
| **findOne — delegates** | Passes UUID to service |
| **create — delegates** | Passes DTO to service |
| **update — delegates** | Passes UUID + DTO to service |
| **remove — 204** | Returns NO_CONTENT |
| **duplicate — delegates** | Passes UUID to service |

### 6.3. Backend — FigureTemplate Referential Integrity Tests

Add to `figure-template.service.spec.ts`:

| Test | Description |
|------|-------------|
| **remove — 409 when used in composition** | Throws `ConflictException` when `CompositionSlot` references the template |
| **remove — success when not used** | Allows deletion when no composition slots reference the template |

### 6.4. Frontend — `CompositionTemplateService` Tests

| Test | Description |
|------|-------------|
| **getAll** | Calls correct endpoint with params |
| **getOne** | Calls `GET /:id` |
| **create** | Calls `POST` with payload |
| **update** | Calls `PUT /:id` with payload |
| **delete** | Calls `DELETE /:id` |
| **duplicate** | Calls `POST /:id/duplicate` |

---

## 7. Files to Create/Modify

### New Files

**Backend:**
- `apps/api/src/modules/composition/entities/composition-template.entity.ts`
- `apps/api/src/modules/composition/entities/composition-slot.entity.ts`
- `apps/api/src/modules/composition/dto/create-composition-template.dto.ts`
- `apps/api/src/modules/composition/dto/update-composition-template.dto.ts`
- `apps/api/src/modules/composition/dto/create-composition-slot.dto.ts`
- `apps/api/src/modules/composition/dto/composition-template-filter.dto.ts`
- `apps/api/src/modules/composition/composition-template.controller.ts`
- `apps/api/src/modules/composition/composition-template.service.ts`
- `apps/api/src/modules/composition/composition-template.service.spec.ts`
- `apps/api/src/modules/composition/composition-template.controller.spec.ts`
- `apps/api/src/modules/composition/composition.module.ts`

**Frontend:**
- `apps/dashboard/src/app/features/pinyes/components/composition-editor/composition-editor.component.ts`
- `apps/dashboard/src/app/features/pinyes/components/composition-editor/composition-editor.component.html`
- `apps/dashboard/src/app/features/pinyes/services/composition-template.service.ts`
- `apps/dashboard/src/app/features/pinyes/models/composition.model.ts`

### Modified Files

**Backend:**
- `apps/api/src/modules/figure/figure.module.ts` — Add `CompositionSlot` to `TypeOrmModule.forFeature()`
- `apps/api/src/modules/figure/figure-template.service.ts` — Inject `Repository<CompositionSlot>`, add delete protection
- `apps/api/src/modules/figure/figure-template.service.spec.ts` — Add referential integrity tests
- `apps/api/src/app/app.module.ts` — Register `CompositionModule`

**Frontend:**
- `apps/dashboard/src/app/features/pinyes/pinyes.routes.ts` — Add composition routes
- `apps/dashboard/src/app/features/pinyes/components/template-list/template-list.component.ts` — Wire real composition data, add composition CRUD
- `apps/dashboard/src/app/features/pinyes/components/template-list/template-list.component.html` — Replace placeholder with real cards
- `apps/dashboard/src/app/features/pinyes/components/figure-canvas/figure-canvas.component.ts` — Add composition mode

---

## 8. Fora d'abast

| Funcionalitat | Fase |
|---------------|------|
| `FigureInstance` referencing compositions | P5.3 |
| `EventSegment` management | P5.3 |
| Person assignment to composition nodes | P5.4 |
| Projection view of compositions | P5.5 |
| Tronc panel (lateral floor view) in composition editor | Deferred — composition canvas renders pinya-view nodes (zone PINYA + TRONC z=0 baixos, same as template editor pinya layer). The lateral tronc floor panel is per-figure only |
