# Ad-Hoc Instance Nodes — Spec General

> **Status:** Reviewed (blocking issues resolved)
> **Created:** 2026-06-10
> **Phases:** 4 (independently deployable)
> **Branch prefix:** `feat/ad-hoc-nodes-phase-X`
> **Replaces:** P5.8.1 `ReferenceElement` (removed module, now superseded by DECORATION nodes)

## 1. Executive Summary

Extend the assignment canvas to allow creating **instance-local nodes** post-snapshot. This relaxes the snapshot immutability invariant in a controlled way: `InstanceNode` rows can be **added/deleted** post-snapshot, but existing snapshot-sourced nodes remain untouched.

### Motivation

- Flexibility during assignment: add positions not foreseen at template design time.
- Simplify cordon obert: decouple from rengla system, make them freely addable.
- Directions (`FIGURE_DIRECTION`, `XICALLA_DIRECTION`) are often instance-specific (angle of approach varies per event/location). Templates may define them, but extras are needed per-instance.
- Spatial/decorative elements (rectangles, arrows) for orientation during projection — replaces the removed `ReferenceElement` concept, now scoped to instance level instead of event/segment level.
- Bulk import should capture the full "final state" of an instance, including ad-hoc additions.

### Approach

**Single-table extension** — `InstanceNode` gains `isAdHoc: boolean` discriminator. Ad-hoc nodes have `sourceNodeId = null`. Decorative elements use a new `FigureZone.DECORATION` enum value. No new tables required.

### Relationship to removed `ReferenceElement`

P5.8.1 designed event-scoped `ReferenceElement` (RECTANGLE | ARROW) for the projection canvas. That module was removed during the P5.9 CSS-grid refactor. This spec **replaces** that concept with instance-scoped `DECORATION` nodes — same visual intent (spatial orientation), better scoping (per-instance, travels with bulk import), simpler implementation (same table/rendering pipeline as other nodes).

---

## 2. Data Model Changes

### 2.1 `InstanceNode` — new columns


| Column      | Type      | Default | Nullable | Notes                                                                                                             |
| ----------- | --------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `isAdHoc`   | `boolean` | `false` | NO       | `true` for user-created post-snapshot nodes                                                                       |
| `createdBy` | `uuid`    | —       | YES      | FK → `users.id`, `@ManyToOne(() => User)`, `onDelete: SET NULL`. Set server-side from JWT, never client-supplied. |


**Existing columns — behavior for ad-hoc nodes:**


| Column           | Value for ad-hoc                       |
| ---------------- | -------------------------------------- |
| `sourceNodeId`   | Always `null` (no template source)     |
| `originNodeId`   | Always `null`                          |
| `renglaId`       | Always `null` (independent of rengles) |
| `renglaPosition` | Always `null`                          |
| `ringLevel`      | `null` (no concentric ring)            |
| `z`              | `0` (default floor)                    |
| `sortOrder`      | `MAX(sortOrder) + 1` within instance   |
| `metadata`       | `{}`                                   |


**No `updatedAt` added** — ad-hoc PATCH operations are positional (x/y/w/h) and frequent during drag. Tracking last-modified would add noise without value. If needed later, can be added in Phase 4.

**Index:** Add composite index `(figureInstanceId, isAdHoc)` for filtered queries.

### 2.2 `NodeShape` enum — new values

```typescript
export enum NodeShape {
  ELLIPSE = 'ELLIPSE',
  RECTANGLE = 'RECTANGLE',
  ARROW = 'ARROW',    // Phase 2 — directional indicator
  CIRCLE = 'CIRCLE',  // Phase 2 — alias for small ELLIPSE with equal w/h
}
```

### 2.3 `FigureZone` enum — new value

```typescript
export enum FigureZone {
  BASE = 'BASE',
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  FIGURE_DIRECTION = 'FIGURE_DIRECTION',
  XICALLA_DIRECTION = 'XICALLA_DIRECTION',
  DECORATION = 'DECORATION', // Non-assignable spatial/orientation element
}
```

### 2.4 `NodeAssignment` — validation rule

- Backend: `assign()` rejects if target `InstanceNode.zone === DECORATION` → 400 "Els nodes decoratius no es poden assignar."
- Frontend: DECORATION nodes are non-selectable for assignment (CSS `pointer-events` / Konva `listening: false` in assign interaction)

### 2.5 `FigureTemplate` schema — unchanged

No changes to `FigureTemplate`, `FigureNode`, or `Rengla`. Template editing remains independent. The invariant "template save never deletes/modifies ad-hoc `InstanceNode` rows" is guaranteed by the existing upsert logic which only touches `FigureNode` rows.

### 2.6 Migration

Single TypeORM migration:

1. `ALTER TABLE instance_nodes ADD COLUMN "isAdHoc" boolean NOT NULL DEFAULT false`
2. `ALTER TABLE instance_nodes ADD COLUMN "createdById" uuid REFERENCES users(id) ON DELETE SET NULL`
3. `ALTER TYPE figure_zone_enum ADD VALUE 'DECORATION'`
4. `ALTER TYPE node_shape_enum ADD VALUE 'ARROW'`
5. `ALTER TYPE node_shape_enum ADD VALUE 'CIRCLE'`
6. `CREATE INDEX idx_instance_nodes_instance_adhoc ON instance_nodes("figureInstanceId", "isAdHoc")`

Non-breaking: all existing rows get `isAdHoc = false`, `createdById = null`.

**Note on `positionType`:** This is a plain `varchar` column, not a PostgreSQL enum. Adding `'comodin'` to the allowed values is done via application-level validation (`@IsIn(PINYA_POSITION_TYPES)`) — no DB migration required for new position types.

**Note on `shape`:** `node_shape_enum` is a PostgreSQL enum used by both `figure_nodes.shape` and `instance_nodes.shape`. Adding `ARROW` and `CIRCLE` requires `ALTER TYPE ... ADD VALUE` which is non-transactional in PostgreSQL. The migration must handle this correctly (commit after each `ADD VALUE`, or use `IF NOT EXISTS` in PG 12+).

---

## 3. API Endpoints

### 3.1 New endpoints


| Method   | Path                                         | Purpose                                       | Phase | Response             |
| -------- | -------------------------------------------- | --------------------------------------------- | ----- | -------------------- |
| `POST`   | `/figure-instances/:id/ad-hoc-nodes`         | Create ad-hoc node                            | 1     | `201` + created node |
| `PATCH`  | `/figure-instances/:id/ad-hoc-nodes/:nodeId` | Update position/size/label/rotation           | 1     | `200` + updated node |
| `DELETE` | `/figure-instances/:id/ad-hoc-nodes/:nodeId` | Delete node (transactional unassign + delete) | 1     | `204`                |


### 3.2 Modified endpoints


| Endpoint                                      | Change                                                                | Phase                                           |
| --------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| `GET /figure-instances/:id/nodes`             | Response includes `isAdHoc: boolean` on each node                     | 1                                               |
| `POST /figure-instances/:id/assignments`      | Validates target node is not `DECORATION` (400)                       | 1 (guard added, DECORATION creation in Phase 2) |
| `POST /figure-instances/:id/assignments/bulk` | Clones ad-hoc nodes from source + creates assignments                 | 1                                               |
| `POST /figure-instances/:id/reset`            | Deletes all (including ad-hoc), response includes `deletedAdHocCount` | 1                                               |


### 3.3 Guards & validation

- **Lock check:** All ad-hoc node operations respect `ASSIGNMENT_LOCK_DAYS`. Error: "L'esdeveniment està bloquejat. No es poden modificar els nodes."
- **Ownership:** Only `isAdHoc = true` nodes can be modified/deleted via ad-hoc endpoints. Attempting to delete a snapshot node → 403 "No es pot eliminar un node del template."
- **Auto-snapshot on first ad-hoc creation:** If instance is `snapshotted = false`, creating an ad-hoc node triggers `snapshotInstance()` first (same transaction), then inserts the ad-hoc node. This is consistent with the existing lazy-snapshot pattern from `assign()`.
- **Composition rejection:** All ad-hoc endpoints return 400 "Les instàncies de composició no suporten nodes ad-hoc" for composition-based instances (same guard as `snapshotInstance`).
- **Auth/roles:** Same as assignment endpoints — `@Roles(UserRole.TECHNICAL, UserRole.ADMIN)`.
- **Zone whitelist per phase:**
  - Phase 1: `@IsIn([FigureZone.PINYA])` on `CreateAdHocNodeDto.zone`
  - Phase 2: Extend to `[PINYA, DECORATION]`
  - Phase 3: Extend to `[PINYA, DECORATION, FIGURE_DIRECTION, XICALLA_DIRECTION]`

### 3.4 DTOs

```typescript
// CreateAdHocNodeDto
class CreateAdHocNodeDto {
  @IsIn(ALLOWED_AD_HOC_ZONES) // Phase-gated whitelist
  zone: FigureZone;

  @IsOptional()
  @IsIn(PINYA_POSITION_TYPES)
  // ['agulla', 'mans', 'laterals', 'vents', 'cordo-obert', 'tap', 'crossa', 'contrafort', 'comodin']
  positionType?: string;

  @IsString()
  @MaxLength(100)
  label: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional() @IsNumber() @Min(10)
  width?: number;   // Defaults: see §3.5 (80×40 matching template editor)

  @IsOptional() @IsNumber() @Min(10)
  height?: number;

  @IsOptional() @IsNumber()
  rotation?: number; // Default: 0

  @IsOptional() @IsIn(Object.values(NodeShape))
  shape?: NodeShape;

  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

// UpdateAdHocNodeDto — all optional (same fields as template editor node editing)
class UpdateAdHocNodeDto {
  @IsOptional() @IsString() @MaxLength(100)
  label?: string;

  @IsOptional() @IsNumber()
  x?: number;

  @IsOptional() @IsNumber()
  y?: number;

  @IsOptional() @IsNumber() @Min(10)
  width?: number;

  @IsOptional() @IsNumber() @Min(10)
  height?: number;

  @IsOptional() @IsNumber()
  rotation?: number;

  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @IsOptional() @IsIn(Object.values(NodeShape))
  shape?: NodeShape;
}
```

### 3.5 Default field values by zone/type

Defaults match the template editor behavior (`DEFAULT_NODE_WIDTH = 80`, `DEFAULT_NODE_HEIGHT = 40`) and use the same color palette as `PINYA_POSITIONS` in the template editor.

| Zone              | positionType | Default width | Default height | Default shape | Default color | Label default |
| ----------------- | ------------ | ------------- | -------------- | ------------- | ------------- | ------------- |
| PINYA             | agulla       | 80            | 40             | RECTANGLE     | `#0d9488`     | "Agulla"      |
| PINYA             | mans         | 80            | 40             | RECTANGLE     | `#FFE082`     | "Mans"        |
| PINYA             | laterals     | 80            | 40             | RECTANGLE     | `#80DEEA`     | "Laterals"    |
| PINYA             | vents        | 80            | 40             | RECTANGLE     | `#A5D6A7`     | "Vents"       |
| PINYA             | cordo-obert  | 80            | 40             | ELLIPSE       | `#FFF9C4`     | "Cordó obert" |
| PINYA             | tap          | 80            | 40             | RECTANGLE     | `#be185d`     | "Tap"         |
| PINYA             | crossa       | 80            | 40             | RECTANGLE     | `#9FA8DA`     | "Crossa"      |
| PINYA             | contrafort   | 80            | 40             | RECTANGLE     | `#EF9A9A`     | "Contrafort"  |
| PINYA             | comodin      | 80            | 40             | RECTANGLE     | `#B0BEC5`     | *(user input)* |
| FIGURE_DIRECTION  | —            | 80            | 40             | ARROW         | `#333333`     | "Direcció fig." |
| XICALLA_DIRECTION | —            | 60            | 40             | ARROW         | `#666666`     | "Direcció xic." |
| DECORATION        | rectangle    | 120           | 80             | RECTANGLE     | `#999999`     | *(user input)* |
| DECORATION        | arrow        | 80            | 30             | ARROW         | `#999999`     | *(user input)* |
| DECORATION        | circle       | 60            | 60             | CIRCLE        | `#999999`     | *(user input)* |

**"Comodín" node:** A generic PINYA node (`positionType: 'comodin'`) with a neutral color that the user labels freely. Designed for non-standard positions (e.g. "lateral-agulla", "reforç", "ajuda pinya") that don't fit the existing categories. The label is **required** and provided by the user at creation time (no default label).

These are applied server-side when `width`/`height`/`shape`/`color` are not provided in the DTO. The user can override any value at creation or afterwards via PATCH.

### 3.6 DELETE transaction semantics

```
BEGIN TRANSACTION
  1. Find node WHERE id = :nodeId AND figureInstanceId = :id AND isAdHoc = true
     → 404 if not found, 403 if isAdHoc = false
  2. DELETE FROM node_assignments WHERE instanceNodeId = :nodeId
  3. DELETE FROM instance_nodes WHERE id = :nodeId
COMMIT
→ Response: 204 No Content
```

This handles the `onDelete: RESTRICT` constraint on `NodeAssignment.instanceNode` by explicitly deleting assignments first.

### 3.7 Shared library changes (`libs/shared`)

All changes in `libs/shared/src/` — imported via `@muixer/shared`:

#### Enum updates (existing files)

**`enums/figure-zone.enum.ts`** — add `DECORATION`:
```typescript
export enum FigureZone {
  BASE = 'BASE',
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  FIGURE_DIRECTION = 'FIGURE_DIRECTION',
  XICALLA_DIRECTION = 'XICALLA_DIRECTION',
  DECORATION = 'DECORATION',
}
```

**`enums/node-shape.enum.ts`** — add `ARROW`, `CIRCLE`:
```typescript
export enum NodeShape {
  ELLIPSE = 'ELLIPSE',
  RECTANGLE = 'RECTANGLE',
  ARROW = 'ARROW',
  CIRCLE = 'CIRCLE',
}
```

#### New constants file

**`constants/ad-hoc-node.constants.ts`** (NEW):
```typescript
import { FigureZone } from '../enums/figure-zone.enum';
import { NodeShape } from '../enums/node-shape.enum';

export const PINYA_POSITION_TYPES = [
  'agulla', 'mans', 'laterals', 'vents',
  'cordo-obert', 'tap', 'crossa', 'contrafort', 'comodin',
] as const;

export type PinyaPositionType = typeof PINYA_POSITION_TYPES[number];

export const AD_HOC_ALLOWED_ZONES = [
  FigureZone.PINYA,
  FigureZone.DECORATION,
  FigureZone.FIGURE_DIRECTION,
  FigureZone.XICALLA_DIRECTION,
] as const;

export interface AdHocNodePreset {
  zone: FigureZone;
  positionType: string | null;
  label: string;
  width: number;
  height: number;
  shape: NodeShape;
  color: string;
  requiresCustomLabel: boolean;
}

export const AD_HOC_PINYA_PRESETS: AdHocNodePreset[] = [
  { zone: FigureZone.PINYA, positionType: 'agulla',      label: 'Agulla',      width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#0d9488', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'mans',        label: 'Mans',        width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#FFE082', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'laterals',    label: 'Laterals',    width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#80DEEA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'vents',       label: 'Vents',       width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#A5D6A7', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'cordo-obert', label: 'Cordó obert', width: 80, height: 40, shape: NodeShape.ELLIPSE,   color: '#FFF9C4', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'tap',         label: 'Tap',         width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#be185d', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'crossa',      label: 'Crossa',      width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#9FA8DA', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'contrafort',  label: 'Contrafort',  width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#EF9A9A', requiresCustomLabel: false },
  { zone: FigureZone.PINYA, positionType: 'comodin',     label: '',            width: 80, height: 40, shape: NodeShape.RECTANGLE, color: '#B0BEC5', requiresCustomLabel: true },
];
```

#### Interface updates (existing file)

**`interfaces/pinyes/assignment.interfaces.ts`** — extend `InstanceNodeItem`:
```typescript
export interface InstanceNodeItem {
  // ... existing fields ...
  isAdHoc: boolean;        // NEW — true for user-created post-snapshot nodes
  createdById?: string;    // NEW — null for snapshot nodes
}
```

**`interfaces/pinyes/assignment.interfaces.ts`** — extend `BulkImportResult`:
```typescript
export interface BulkImportResult {
  created: AssignmentDetail[];
  conflicts: BulkImportConflict[];
  clonedAdHocNodes: number;  // NEW
}
```

#### Export from index

**`index.ts`** — add export:
```typescript
export * from './constants/ad-hoc-node.constants';
```

Pre-snapshot GET nodes response: all items have `isAdHoc: false` (ad-hoc nodes cannot exist pre-snapshot).

---

## 4. Frontend — Assignment Canvas

### 4.1 "+" button interaction

- Floating action button on the Konva canvas (bottom-right area, outside figure bounds)
- Hidden/disabled when event is locked
- On click → categorized dropdown (Phase-gated categories):
  - **Phase 1 — Pinya:** agulla, mans, laterals, vents, cordo-obert, tap, crossa, contrafort, **comodín** (demana label a l'usuari)
  - **Phase 2 — Decoratiu:** Rectangle, Fletxa, Cercle
  - **Phase 3 — Direccions:** FIGURE_DIRECTION, XICALLA_DIRECTION
- Selection → enters "placement mode":
  - Cursor changes to crosshair
  - Click on canvas places node at click coordinates
  - Press Escape to cancel placement mode
  - Clicking outside canvas bounds cancels
- After placement → node is created (API call), then becomes interactive

### 4.2 Visual distinction

- **Ad-hoc nodes (assignment canvas):** dashed stroke border (2px dashed, same zone color)
- **DECORATION nodes (assignment canvas):** reduced opacity (0.6), stroke-only fill, larger size
- **Projection view:** ad-hoc PINYA/DIRECTION render identically to snapshot nodes (solid border, full opacity, name badge if assigned). DECORATION renders as stroke-only outline.
- Tooltip on hover for ad-hoc nodes: "Node creat manualment"

### 4.3 Interaction model — dual behavior for ad-hoc nodes

The key challenge: ad-hoc nodes need to be both **movable** (drag) and **selectable for assignment** (click). Resolution:


| Gesture                                 | Behavior                                             |
| --------------------------------------- | ---------------------------------------------------- |
| **Single click** (< 200ms, no movement) | Selects node for assignment (same as snapshot nodes) |
| **Click + drag** (movement > 5px)       | Moves the node (PATCH position on `dragend`)         |
| **Double-click**                        | Opens resize/rotate transformer (same Konva `Transformer` as template editor) |
| **Backspace/Delete** (while selected)   | Delete flow (with confirmation if assigned)          |
| **Escape**                              | Deselects / exits resize mode / cancels placement    |


Snapshot nodes remain `draggable: false` — only ad-hoc nodes get `draggable: true`.

**Resize & rotation** — same behavior as the template editor:
- Konva `Transformer` with corner resize handles + rotation anchor
- Min size enforced: 10×10
- Rotation snaps to 15° increments when holding Shift (same as editor)
- PATCH fires on `transformend` with updated `width`, `height`, `rotation`
- Visual feedback identical to the template editor (blue handles, dotted guidelines)

**PATCH debouncing:** Position updates on `dragend` only (not during drag). Resize/rotation updates on transformer `transformend`. Single PATCH per gesture. No intermediate saves.

**Optimistic UI:** Follow existing `pendingOperations` pattern from `AssignmentStateService`. Create → optimistic node appears immediately, confirmed on API success. Delete → optimistic removal, rollback on error.

### 4.4 State management (`AssignmentStateService`)

New signals:

```typescript
isPlacementMode = signal<boolean>(false);
placementPreset = signal<AdHocNodePreset | null>(null);
```

Computed:

```typescript
adHocNodes = computed(() => this.instanceNodes().filter(n => n.isAdHoc));
hasAdHocNodes = computed(() => this.adHocNodes().length > 0);
```

New methods:

```typescript
enterPlacementMode(preset: AdHocNodePreset): void;
exitPlacementMode(): void;
createAdHocNode(x: number, y: number): Observable<InstanceNodeItem>;
updateAdHocNode(nodeId: string, patch: Partial<UpdateAdHocNodeDto>): Observable<void>;
deleteAdHocNode(nodeId: string): Observable<void>;
```

### 4.5 Confirmation dialogs


| Trigger                          | Message (Catalan)                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Delete ad-hoc with assignment    | "El node «{label}» té la persona {name} assignada. Vols desassignar-la i eliminar el node?" |
| Delete ad-hoc without assignment | Immediate delete, no confirmation                                                           |
| Reset with ad-hoc nodes          | "Hi ha {n} node(s) creat(s) manualment que es perdran amb el reset. Vols continuar?"        |
| Template edit link click         | Info toast (3s): "Els canvis al template no afecten instàncies ja creades."                 |


### 4.6 Ghost clone exclusion

`isGhostEligible()` in the template editor must exclude `isAdHoc` nodes (they don't have `renglaId`). Since ghost clone only runs in editor mode and ad-hoc only exists in assignment mode, this is naturally excluded — but the check should be explicit for safety.

---

## 5. Cordon Obert Simplification

### Current model (complex)

```
Rengla { allowsCordoObert: true }
  → FigureNode { positionType: 'cordo-obert', renglaId: rengla.id }
    → Visibility controlled by FigureInstance.openCordons[]
```

### New model (simple, for ad-hoc)

```
InstanceNode {
  isAdHoc: true,
  zone: PINYA,
  positionType: 'cordo-obert',
  renglaId: null,  // Independent — no rengla association
  label: 'Cordó obert',
}
→ Always visible (not subject to openCordons filtering)
→ Not affected by repositionCordoObertNodes() — stays at manual position
→ Assignable like any PINYA node
```

The existing rengla-based cordons oberts continue working unchanged for template-sourced nodes. The simplification only applies to ad-hoc additions. Both types coexist.

**`isNodeVisible()` logic:** Nodes with `renglaId = null` are always visible (existing behavior handles this correctly — the filter only applies when `renglaId` is present).

---

## 6. Bulk Import Extension

### Current behavior

1. Load source instance assignments with their `InstanceNode` data
2. Match source → target by `renglaId:renglaPosition`
3. Fallback match by `sourceNodeId`
4. Create assignments on matched target nodes
5. Return `{ imported, skipped, conflicts }`

### Extended behavior (Phase 1)

After step 4 (template-node matching), add:

1. Load all `InstanceNode WHERE figureInstanceId = sourceId AND isAdHoc = true`
2. For each source ad-hoc node:
  a. Clone into target instance: new UUID, copy all geometry/zone/label fields, set `isAdHoc = true`, `createdById = current user`
   b. If source node had an assignment, create corresponding assignment on the cloned node (same person)
3. Return extended result: `{ imported, skipped, conflicts, clonedAdHocNodes: number }`

**No duplicate detection.** If the target already has ad-hoc nodes, the import still clones all source ad-hoc nodes. Rationale: ad-hoc nodes are positional and context-dependent — "same position" doesn't mean "same intent." The user can manually delete unwanted duplicates (simpler than implementing proximity thresholds with questionable UX).

**ID mapping:** Cloned ad-hoc nodes get new UUIDs. No `sourceNodeId` lineage — they're independent copies.

---

## 7. Projection View

- **Ad-hoc PINYA/DIRECTION nodes:** render identically to snapshot nodes in projection (solid border, full opacity, name badge if assigned)
- **DECORATION nodes:** render as shape outline (stroke-only, reduced opacity 0.4, label centered inside)
- **No special filtering** — `getProjection()` already loads all `InstanceNode` rows; ad-hoc nodes naturally appear
- **History/summary endpoints:** Ad-hoc nodes included in `totalNodes` count. This is correct — they represent real positions that were filled.

---

## 8. User Guide & Onboarding

### 8.1 Internal documentation (for future modal/guide)

Create `docs/internal/ad-hoc-nodes-user-guide.md` — internal Catalan guide for the eventual onboarding modal:

**Contingut del document:**

---

#### Què són els nodes ad-hoc?

Quan estàs assignant persones a una figura, a vegades necessites posicions que no existeixen al template original. Els **nodes ad-hoc** et permeten afegir posicions noves directament durant l'assignació, sense haver de modificar el template base.

#### Quan fer-los servir?

- **Cordons oberts extra:** necessites un cordó obert que no estava previst al template.
- **Posicions especials:** un "lateral-agulla" o "reforç" que només fa sentit per a aquest event concret.
- **Comodí:** qualsevol posició no estàndard amb un nom personalitzat.
- **Elements decoratius** (Fase 2): marcar on queda l'església, cap on mira la figura, etc.
- **Direccions** (Fase 3): indicar cap on s'orienta la figura o la xicalla.

#### Com funcionen?

1. **Fes clic al botó "+"** al canvas d'assignació.
2. **Tria el tipus** de node que vols afegir (agulla, cordó obert, comodí, etc.).
3. **Fes clic al canvas** per col·locar-lo on vulguis.
4. **Mou-lo** arrossegant-lo. **Redimensiona'l** fent doble clic i usant les nanses.
5. **Assigna persones** fent un sol clic al node i seleccionant la persona.

#### Diferències amb els nodes del template

| | Nodes del template | Nodes ad-hoc |
|---|---|---|
| **Origen** | Copiats del template al fer el snapshot | Creats manualment durant l'assignació |
| **Visual** | Vora contínua | Vora discontínua (guions) |
| **Moviment** | Fixos (no es poden moure) | Lliures (arrossega per moure) |
| **Eliminació** | No es poden eliminar individualment | Es poden eliminar (Suprimir/Backspace) |
| **Import** | Es copien per posició/rengla | Es copien íntegrament (amb assignacions) |
| **Template** | Canvis al template no afecten el snapshot | No tenen relació amb el template |

#### Important

- **El reset esborra tot:** Si fas reset de la pinya, els nodes ad-hoc es perdran juntament amb totes les assignacions.
- **El bloqueig s'aplica:** Quan un event està bloquejat, no es poden afegir ni modificar nodes ad-hoc.
- **L'import els copia:** Quan importes d'una altra instància, els nodes ad-hoc d'aquella instància es copiaran automàticament.

---

### 8.2 Help modal component (Phase 1)

Create `AdHocNodesHelpModalComponent` — accessible from a "?" icon button next to the "+" FAB. Same pattern as `TemplateEditorHelpModalComponent`:

```typescript
@Component({
  selector: 'app-ad-hoc-nodes-help-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './ad-hoc-nodes-help-modal.component.html',
})
export class AdHocNodesHelpModalComponent {
  readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void { this.dialogRef().nativeElement.showModal(); }
  close(): void { this.dialogRef().nativeElement.close(); }
}
```

**Modal content (Catalan):**
- Title: "Nodes ad-hoc — Guia ràpida"
- Sections: Què són, Com crear-los, Com moure/redimensionar, Com eliminar-los
- Visual: small inline diagrams showing dashed vs solid border
- DaisyUI `modal` with `steps` layout for each section
- Accessible: focus trap, Escape to close, `aria-labelledby`

### 8.3 "Comodín" creation flow

When the user selects "Comodí" from the "+" menu:
1. A small inline popover/input appears near the button: "Nom del node:" with a text input
2. User types the label (e.g. "Lateral-agulla") and presses Enter or clicks "Afegir"
3. Then enters placement mode as normal
4. The label is sent in `CreateAdHocNodeDto.label`

This is necessary because `comodin` is the only type with `requiresCustomLabel: true`.

---

## 9. Edge Cases & Invariants

### Explicitly handled


| Scenario                                       | Behavior                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Create ad-hoc on unsnapshotted instance        | Auto-snapshot first (same transaction)                          |
| Create ad-hoc on composition instance          | 400 rejection                                                   |
| Delete snapshot node via ad-hoc endpoint       | 403 rejection                                                   |
| Assign person to DECORATION node               | 400 rejection                                                   |
| Swap involving ad-hoc node                     | Allowed (same as any node)                                      |
| Lock active + any ad-hoc mutation              | 403 rejection                                                   |
| Template edited after instance has ad-hoc      | No effect — ad-hoc nodes are instance-scoped                    |
| Bulk import: source has ad-hoc, target doesn't | Ad-hoc cloned to target                                         |
| Bulk import: both have ad-hoc                  | Both sets coexist (no dedup)                                    |
| Person already in segment (assigned elsewhere) | Standard conflict → skip/error (existing logic)                 |
| Inactive person assigned to ad-hoc             | Same `isActive` check as regular assignment                     |
| `repositionCordoObertNodes()`                  | Skips nodes with `renglaId = null` (ad-hoc cordons stay put)    |
| Max ad-hoc nodes per instance                  | No hard limit (soft limit: performance concern above ~50 nodes) |


### Invariants (must never be violated)

1. **Template sync isolation:** `FigureNode` upsert/delete never touches `InstanceNode` rows (pre-existing invariant, still holds).
2. **Snapshot nodes are read-only:** Existing `InstanceNode` with `isAdHoc = false` cannot be modified or deleted via any ad-hoc endpoint.
3. **Ad-hoc nodes require snapshotted instance:** `isAdHoc = true` rows only exist in instances where `snapshotted = true`.
4. **DECORATION zone is never assignable:** No code path allows creating a `NodeAssignment` pointing to a DECORATION node.

---

## 10. Phases

### Phase 1 — Core: Instance-local PINYA nodes + simplified cordons

**Scope:**

- DB migration (`isAdHoc`, `createdById`, `DECORATION` + `ARROW` + `CIRCLE` enum values, index)
- Shared: enum updates (`FigureZone.DECORATION`, `NodeShape.ARROW`, `NodeShape.CIRCLE`)
- Shared: `InstanceNodeItem.isAdHoc` + `createdById` interface fields
- Shared: new `constants/ad-hoc-node.constants.ts` with `PINYA_POSITION_TYPES`, `AdHocNodePreset`, presets array
- Shared: `BulkImportResult.clonedAdHocNodes` field
- Backend: Ad-hoc node CRUD endpoints (POST/PATCH/DELETE) with full validation
- Backend: Auto-snapshot on first ad-hoc creation
- Backend: Zone whitelist `[PINYA]` for Phase 1
- Backend: Composition instance guard (400)
- Backend: Lock guard on all ad-hoc operations
- Backend: Modify `getInstanceNodes()` to include `isAdHoc` in response
- Backend: Modify `bulkImport()` to clone ad-hoc nodes
- Backend: DECORATION assignment rejection guard (ready for Phase 2)
- Backend: `resetInstance()` deletes all including ad-hoc (returns `deletedAdHocCount`)
- Frontend: "+" FAB button with PINYA category menu (incl. comodín with label input)
- Frontend: Placement mode (crosshair cursor, click-to-place, Escape to cancel)
- Frontend: Ad-hoc nodes with `draggable: true` + dual gesture (click=select, drag=move)
- Frontend: Transformer for resize + rotation on double-click (same handles as template editor)
- Frontend: Dashed border visual distinction for ad-hoc nodes
- Frontend: Delete with confirmation (if assigned)
- Frontend: Reset warning when `hasAdHocNodes`
- Frontend: Template editor link info toast
- Frontend: `AdHocNodesHelpModalComponent` with user guide (accessible from "?" button)
- Frontend: Comodín label input popover before placement
- Tests: Backend unit + integration for CRUD, lock, bulk import, auto-snapshot, composition guard

**Manual Testing Checklist — Phase 1:**


| #   | Test                                                             | Expected                                                       |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Open assignment canvas for a segment with a snapshotted instance | Canvas loads normally, "+" button visible                      |
| 2   | Open assignment canvas for a **locked** event                    | "+" button disabled/hidden                                     |
| 3   | Click "+" → select "Cordó obert" → click on canvas               | New node appears with dashed border at click position          |
| 4   | Press Escape while in placement mode                             | Placement cancelled, cursor back to normal                     |
| 5   | Drag the new ad-hoc node                                         | Node moves freely, PATCH on release                            |
| 6   | Double-click ad-hoc node → resize via handles                    | Node resizes, PATCH on release                                 |
| 7   | Click (not drag) ad-hoc node → select person from panel          | Assignment created on ad-hoc node                              |
| 8   | Try to drag a snapshot node                                      | Nothing happens (not draggable)                                |
| 9   | Delete unassigned ad-hoc node (Backspace)                        | Immediate deletion, no confirmation                            |
| 10  | Delete assigned ad-hoc node                                      | Confirmation dialog with person name, then deletion            |
| 11  | Create 2 ad-hoc cordons oberts, assign both                      | Both visible, both in summary, not affected by cordon selector |
| 12  | Click "Reset pinya" on instance with ad-hoc nodes                | Warning mentions N manually created nodes                      |
| 13  | Confirm reset                                                    | All nodes removed, instance unsnapshotted                      |
| 14  | Create ad-hoc on **unsnapshotted** instance (first interaction)  | Auto-snapshot triggers, then ad-hoc node created               |
| 15  | Bulk import from instance A (with 2 ad-hoc nodes) to instance B  | Template nodes matched + ad-hoc nodes cloned with assignments  |
| 16  | Reload page after creating ad-hoc nodes                          | Nodes persist (server-confirmed)                               |
| 17  | Click "Editar template" link                                     | Info toast about snapshot isolation                            |
| 18  | Swap assignment between snapshot node and ad-hoc node            | Swap works normally                                            |
| 19  | Try creating ad-hoc on a composition instance                    | Error message, creation blocked                                |
| 20  | Click "+" → "Comodí" → type "Lateral-agulla" → Enter → place    | Node created with custom label and neutral color (#B0BEC5)     |
| 21  | Double-click ad-hoc node → rotate using rotation anchor          | Node rotates, snaps to 15° with Shift, PATCH on release        |
| 22  | Double-click ad-hoc node → resize using corner handles           | Node resizes (min 10×10), PATCH on release                     |
| 23  | Click "?" help button next to "+" FAB                            | Help modal opens with user guide content                       |
| 24  | Verify ad-hoc node colors match template editor colors           | Same palette: agulla=#0d9488, mans=#FFE082, etc.               |


---

### Phase 2 — Decorative elements + projection

**Scope:**

- Backend: Extend zone whitelist to `[PINYA, DECORATION]`
- Frontend: "Decoratiu" category in "+" menu (Rectangle, Fletxa, Cercle)
- Frontend: Konva rendering for DECORATION shapes (RECTANGLE → rect stroke, ARROW → path/polygon, CIRCLE → ellipse)
- Frontend: DECORATION nodes `listening: false` for assignment interaction (non-selectable)
- Frontend: DECORATION nodes movable/resizable/deletable (separate interaction from assignment)
- Projection view: render DECORATION shapes (stroke-only, label inside)
- Projection view: ad-hoc PINYA nodes from Phase 1 already appear (verify)
- Tests: Assignment rejection for DECORATION, Konva shape rendering, projection display

**Manual Testing Checklist — Phase 2:**


| #   | Test                                                            | Expected                                                 |
| --- | --------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Click "+" → Decoratiu → Rectangle → place on canvas             | Rectangle appears with stroke-only fill, reduced opacity |
| 2   | Try to click rectangle to assign person                         | Nothing happens (not selectable for assignment)          |
| 3   | Try to assign via API directly (curl)                           | 400 "Els nodes decoratius no es poden assignar"          |
| 4   | Drag decoration element                                         | Moves freely                                             |
| 5   | Delete decoration element (Backspace)                           | Immediate delete (no assignment possible)                |
| 6   | Create rectangle + set label "Església"                         | Label renders centered inside rectangle                  |
| 7   | Click "+" → Decoratiu → Fletxa → place                          | Arrow shape with direction indicator                     |
| 8   | Rotate arrow decoration                                         | Direction rotates                                        |
| 9   | Open projection view for segment with PINYA ad-hoc + DECORATION | PINYA shows with badge, DECORATION shows as outline      |
| 10  | Fullscreen single-figure projection with decorations            | Correct scale and positioning                            |
| 11  | Bulk import instance with decorations to new instance           | Decorations cloned (no assignments)                      |


---

### Phase 3 — Directions as instance-level additions

**Scope:**

- Backend: Extend zone whitelist to `[PINYA, DECORATION, FIGURE_DIRECTION, XICALLA_DIRECTION]`
- Frontend: "Direccions" category in "+" menu
- Frontend: Direction nodes rendered as arrow/triangle (ARROW shape) indicating orientation
- Frontend: Direction nodes **are assignable** (people stand in direction positions to guide the figure)
- Projection: Direction nodes render with arrow visual + person badge
- Tests: Direction lifecycle end-to-end

**Clarification on direction assignability:** Directions indicate where people stand to guide/orient the figure or xicalla group. They are assignable positions, unlike DECORATION which is purely spatial annotation. Template-sourced directions coexist with ad-hoc directions (e.g. template has "front" direction, user adds ad-hoc "lateral" direction for a specific event).

**Manual Testing Checklist — Phase 3:**


| #   | Test                                                            | Expected                                             |
| --- | --------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Click "+" → Direccions → FIGURE_DIRECTION → place               | Direction arrow node appears, dashed border (ad-hoc) |
| 2   | Rotate direction node                                           | Arrow rotates to indicate new direction              |
| 3   | Click direction node → assign person                            | Assignment created normally                          |
| 4   | Add XICALLA_DIRECTION node                                      | Distinct color, same behavior                        |
| 5   | Instance with template-sourced direction + add ad-hoc direction | Both coexist, different purposes                     |
| 6   | Projection view with direction nodes                            | Direction arrows visible + person badges             |
| 7   | Bulk import instance with ad-hoc directions                     | Directions + assignments cloned                      |
| 8   | Delete assigned direction node                                  | Confirmation dialog, then removed                    |


---

### Phase 4 (Future) — Template editor awareness + UX polish

**Scope (deferred, no implementation plan):**

- Template editor: informational banner explaining instance-level additions lifecycle
- Assignment canvas: undo/redo stack for ad-hoc operations
- Assignment canvas: node duplication (clone existing ad-hoc node)
- Keyboard shortcuts for quick creation (e.g. Ctrl+1..8 for pinya presets)
- "Save as template preset" — promote ad-hoc nodes back to template
- Template preview showing what gets snapshotted

---

## 11. Risks & Mitigations


| Risk                                                    | Impact | Mitigation                                                                         |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Snapshot immutability relaxed → bugs with template sync | Medium | `isAdHoc` flag + explicit validation: template upsert never touches `InstanceNode` |
| Bulk import creates node accumulation                   | Low    | No dedup by design; user can delete unwanted copies                                |
| Performance with many ad-hoc nodes                      | Low    | Unlikely to exceed 10-20; same query, composite index helps                        |
| User confusion: template vs ad-hoc nodes                | Medium | Dashed border + tooltip + info toast on template link                              |
| Lock bypass via timing                                  | Low    | Server-side lock check on every mutation endpoint                                  |
| PATCH flooding during drag                              | Low    | Only patch on `dragend`/`transformend` (one call per gesture)                      |
| Phase 1 DECORATION enum without validation              | Low    | Assignment guard added in Phase 1; zone whitelist blocks creation                  |


---

## 12. Out of Scope

- TRONC ad-hoc nodes during assignment (complex CSS grid interaction, would need TroncView editor mode in assignment)
- BASE ad-hoc nodes during assignment (CCW ordering implications)
- Real-time collaboration on ad-hoc nodes (P7 territory)
- Version history / audit log for ad-hoc operations (Phase 4 candidate)
- Composition instance support for ad-hoc nodes (composition snapshot not supported)
- Migrating existing template directions to instance-only (templates can still have directions)

---

## 13. Implementation Plans

Each phase gets its own implementation plan document:


| Phase   | Plan Document                                   | Status      |
| ------- | ----------------------------------------------- | ----------- |
| Phase 1 | `docs/specs/plans/ad-hoc-nodes-phase-1-plan.md` | Implemented |
| Phase 2 | `docs/specs/plans/ad-hoc-nodes-phase-2-spec.md` | Implemented |
| Phase 3 | `docs/specs/plans/ad-hoc-nodes-phase-3-spec.md` | Implemented |
| Phase 4 | TBD (future)                                    | —           |


Each plan follows the structure: task breakdown, file changes list, acceptance criteria, estimated effort, and references back to this spec.

---

## 14. Definition of Done (per phase)

- [ ] All manual testing checklist items pass
- [ ] Backend unit tests cover new endpoints + edge cases (lock, validation, cascade, auto-snapshot)
- [ ] Frontend unit tests cover new signals + interactions + placement mode
- [ ] No lint errors introduced
- [ ] Migration runs cleanly on fresh DB + existing DB with data
- [ ] Bulk import backwards compatible (instances without ad-hoc nodes import normally)
- [ ] Shared enum change doesn't break other consumers (dashboard, PWA scaffold)
- [ ] API documentation (Swagger decorators) updated