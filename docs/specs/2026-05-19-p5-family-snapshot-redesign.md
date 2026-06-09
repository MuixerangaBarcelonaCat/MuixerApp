# P5 Redesign — Figure Families, Snapshot Instances & Concentric Growth

> **Date:** 2026-05-19
> **Status:** Draft — pending approval
> **Supersedes:** Portions of `2026-05-07-p5-figures-module-overview-design.md` (node sync, instance model)
> **Related:** `2026-05-12-p5-4-node-assignment-design.md` (assignment flow — largely preserved)

---

## Table of Contents

1. [Context & Problem Statement](#1-context--problem-statement)
2. [How the Pinyes Module Works Today](#2-how-the-pinyes-module-works-today)
3. [Actors & Objectives](#3-actors--objectives)
4. [Domain Model (Target State)](#4-domain-model-target-state)
5. [Business Rules — Gherkin Scenarios](#5-business-rules--gherkin-scenarios)
6. [Edge Cases & Expected Errors](#6-edge-cases--expected-errors)
7. [Domain Invariants](#7-domain-invariants)
8. [UX Requirements](#8-ux-requirements)
9. [Code & Data Cleanup](#9-code--data-cleanup)
10. [Implementation Phases](#10-implementation-phases)
11. [Out of Scope](#11-out-of-scope)

---

## 1. Context & Problem Statement

### Problem 1 — Template Locked by Assignments

The current `syncNodes()` implementation deletes ALL nodes and recreates them on every template save. If any node has active assignments, the entire update fails with a 409. The frontend misidentifies this 409 as a slug conflict, showing the wrong error message.

**Root cause:** `NodeAssignment.figureNode` is a live FK to `FigureNode` (template-owned). Deleting template nodes would orphan assignments, so the system blocks the whole operation.

### Problem 2 — Unstable Node IDs

When no assignments exist, every autosave regenerates all node UUIDs (delete-all + recreate). This makes `FigureNode.id` meaningless as a stable identifier — breaking import-from-past-events, future analytics, and any external reference.

### Problem 3 — No Concentric Growth Model

Figures grow by adding concentric rings ("cordons") of pinya positions. Today there is no concept of cordons, ring levels, figure families, or variants. Every figure size must be built from scratch as a completely independent template.

### Chosen Approach — Family + Snapshot Lazy

- **Figure Families** group templates that represent the same figure at different sizes.
- **Variants** are full templates within a family, each designed for a specific cordon count.
- **Variant derivation** creates a new variant by copying an existing one, tracking node lineage via `originNodeId`.
- **Instance snapshot** is lazy: instances reference their source template until the first assignment, at which point nodes are copied to `InstanceNode` rows owned by the instance.
- **Upgrade** adds nodes from the next variant in the family without touching existing assignments.

---

## 2. How the Pinyes Module Works Today

### 2.1 Templates

A **FigureTemplate** is a reusable blueprint for a single figure (e.g., Pilar de 4, Morera). It contains:
- Metadata: `name`, `slug`, `description`, `hasPinya`, `direction`
- A list of **FigureNode** rows: each represents one physical position in the figure
- Nodes belong to zones: `PINYA`, `TRONC`, `BASE`, `FIGURE_DIRECTION`, `XICALLA_DIRECTION`
- Pinya nodes have a `positionType` (agulla, laterals, mans, vents, cordo-obert, crossa, contrafort, tap)
- Tronc nodes have `z` levels (1 = segons, 2 = terços, etc.)
- All nodes carry visual properties: `x`, `y`, `width`, `height`, `rotation`, `color`, `shape`

The **Template Editor** (`TemplateEditorComponent`) provides:
- A Konva canvas for positioning pinya + base nodes (drag, resize, rotate)
- A tronc widget for adding floors and positions by level
- A toolbar with pinya position types (click to add)
- A properties panel for editing selected node details
- Autosave with 2-second debounce

### 2.2 Compositions

A **CompositionTemplate** groups multiple figure templates into an arrangement (e.g., "Altar" = 2 figures side by side). It uses **CompositionSlot** rows with `offsetX`/`offsetY` to position each figure template.

### 2.3 Events, Segments & Instances

An **Event** has one or more **EventSegment** rows (temporal blocks). Each segment contains **FigureInstance** rows — one per figure to be performed. A `FigureInstance` points to either a `FigureTemplate` (standalone) or a `CompositionTemplate`.

### 2.4 Assignment

The **Assignment Canvas** (`AssignmentCanvasComponent`) lets the cap de pinyes assign people to positions within a figure instance:
- Pick-and-place: click node → click person (or vice versa)
- Swap: click two assigned nodes
- Unassign: click assigned node → popover → unassign
- Import from past events via bulk import
- **Person Panel** filters by attendance (ANIRE/PENDENT/NO_VAIG), height, xicalla status

**NodeAssignment** links a `FigureInstance` + `FigureNode` + `Person` (+ optional `CompositionSlot`).

### 2.5 Current Architecture Problems

| Problem | Impact |
|---------|--------|
| `syncNodes` = delete-all + recreate | Node IDs change every save; assignments block all edits |
| Assignments point to template nodes | Template and instances are coupled; editing template breaks assignments |
| No family/variant concept | Same figure at different sizes = independent templates with no relationship |
| No cordon/ring model | Adding cordons requires manual creation of a new template from scratch |
| Frontend 409 handling | All 409 errors shown as "slug conflict" regardless of actual cause |
| Composition assignment UI | Backend ready but frontend not wired |

---

## 3. Actors & Objectives

| Actor | Objective |
|-------|----------|
| **Cap de Pinyes** | Design figure templates grouped by family with variants for different cordon counts |
| **Cap de Pinyes** | Edit templates freely — metadata and structure — regardless of existing instances |
| **Cap de Pinyes** | Assign people to figure instances within event segments |
| **Cap de Pinyes** | Add a cordon to an instance during assignment without losing existing assignments |
| **Cap de Pinyes** | Understand families, variants, and cordons through clear UI with explanatory modals/tooltips |
| **System** | Guarantee referential integrity: no orphan assignments, no inconsistent nodes |
| **System** | Snapshot instance nodes automatically on first assignment |
| **System** | Maintain stable node IDs within templates across saves (upsert, not delete+recreate) |

---

## 4. Domain Model (Target State)

### 4.1 New Entities

#### `FigureFamily`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | varchar UNIQUE | e.g., "Pilar de 4" |
| `slug` | varchar UNIQUE | e.g., "pilar-de-4" |
| `description` | text NULL | |
| `metadata` | jsonb | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### `InstanceNode`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `figureInstance` | FK → FigureInstance | NOT NULL, CASCADE |
| `sourceNodeId` | UUID NULL | Reference to the original `FigureNode.id` at snapshot time (informational, not FK) |
| `label` | varchar | |
| `zone` | enum FigureZone | |
| `positionType` | varchar NULL | |
| `x` | float | |
| `y` | float | |
| `z` | int | |
| `width` | float | |
| `height` | float | |
| `rotation` | float | |
| `color` | varchar NULL | |
| `shape` | enum NodeShape | |
| `sortOrder` | int | |
| `climbPath` | varchar NULL | |
| `ringLevel` | int NULL | Copied from source node |
| `originNodeId` | UUID NULL | Root ancestor node ID (copied from source FigureNode's canonical origin). Enables efficient matching during upgrade. |
| `metadata` | jsonb | |
| `createdAt` | timestamp | |

### 4.2 Modified Entities

#### `FigureTemplate` — added columns
| Column | Type | Notes |
|--------|------|-------|
| `family` | FK → FigureFamily | NULL only for legacy data during migration. New templates created after migration MUST have a family assigned. The API enforces this: `POST /figure-templates` requires `familyId`. |
| `variantOrder` | int DEFAULT 1 | Position within family (1 = smallest variant) |

#### `FigureNode` — added columns
| Column | Type | Notes |
|--------|------|-------|
| `ringLevel` | int NULL | Which cordon this node belongs to (1 = first ring, 2 = second, etc.). NULL for non-pinya nodes (tronc, base, direction) |
| `originNodeId` | UUID NULL | When created via variant derivation, points to the source node in the parent variant. Not a FK — informational lineage |

#### `FigureInstance` — added columns
| Column | Type | Notes |
|--------|------|-------|
| `snapshotted` | boolean DEFAULT false | True once nodes have been copied to `InstanceNode` |
| `sourceVariantOrder` | int NULL | The `variantOrder` at snapshot time (for upgrade diff) |

#### `NodeAssignment` — changed FK
| Column | Change |
|--------|--------|
| `figureNode` | **Removed** — replaced by `instanceNode` |
| `instanceNode` | FK → InstanceNode, NOT NULL, RESTRICT |

### 4.3 Entity Relationship Summary

```
FigureFamily 1──*  FigureTemplate 1──* FigureNode
                                  │
                   FigureInstance ─┤ (FK to template, lazy snapshot)
                        │         │
                        1──* InstanceNode (snapshot copies)
                                  │
                        NodeAssignment ──→ InstanceNode + Person
```

### 4.4 Shared Library Additions (`libs/shared`)

New enum values or types if needed:
- No new `FigureZone` values required
- `ringLevel` is an integer, not an enum
- Consider exporting `GROWABLE_POSITION_TYPES = ['laterals', 'mans', 'vents', 'tap']` as a reference constant

---

## 5. Business Rules — Gherkin Scenarios

### 5.1 — Figure Families

```gherkin
Feature: Figure Families

  Scenario: Create a figure family
    Given the Cap de Pinyes is on the figure management screen
    When they create a new family with name "Pilar de 4"
    Then a FigureFamily is created with slug "pilar-de-4"
    And it has no variants yet
    And an explanatory tooltip shows what a family represents

  Scenario: List families with their variants
    Given families "Pilar de 4" (3 variants) and "Morera" (2 variants) exist
    When the Cap de Pinyes views the figure list
    Then families are shown as groups
    And each group shows its variants ordered by variantOrder
    And each variant shows its node count and cordon count

  Scenario: Delete an empty family
    Given family "Test" has no variants
    When the Cap de Pinyes deletes it
    Then the family is removed

  Scenario: Cannot delete a family with variants
    Given family "Pilar de 4" has 2 variants
    When the Cap de Pinyes tries to delete the family
    Then the system rejects: "No es pot esborrar: la família té variants associades."
```

### 5.2 — Variants & Derivation

```gherkin
Feature: Template Variants within a Family

  Scenario: Create the first variant of a family
    Given family "Pilar de 4" exists with no variants
    When the Cap de Pinyes creates a new template within the family
    And adds 12 pinya nodes with ringLevel = 1
    Then a FigureTemplate "Pilar de 4 — 1C" is linked to the family
    And variantOrder = 1

  Scenario: Derive a variant from an existing one
    Given "Pilar de 4 — 1C" exists with 12 nodes
    When the Cap de Pinyes creates a new variant from it
    Then a new FigureTemplate is created in the same family with variantOrder = 2
    And all 12 original nodes are copied
    And each copied node has originNodeId pointing to its source in "1C"
    And the Cap de Pinyes can now add new nodes with ringLevel = 2

  Scenario: Conditional nodes appear at specific ring levels
    Given the Cap de Pinyes is editing "Pilar de 4 — 3C"
    When they add a "tap" node with ringLevel = 3
    Then this node exists only in variant 3C and any variants derived from it

  Scenario: Cordó Obert is independent of ring count
    Given "Pilar de 4 — 2C" has a "cordo-obert" node with ringLevel = NULL
    Then this node can exist regardless of the number of cordons
    And its position is designed manually by the Cap de Pinyes for each variant

  Scenario: originNodeId lineage across multiple derivations
    Given "1C" has node A (id: "aaa")
    And "2C" was derived from "1C", creating node A' (originNodeId: "aaa")
    And "3C" is derived from "2C"
    Then "3C" has node A'' with originNodeId = "aaa" (traces back to original)
    And NOT originNodeId = A'.id (always points to the root ancestor)
```

### 5.3 — Template Editing (Stable Node IDs)

```gherkin
Feature: Template Editing with Stable Node IDs

  Scenario: Edit and save a template — nodes persist IDs
    Given "Pilar de 4 — 2C" has node N1 (id: "abc-123") at position (100, 200)
    When the Cap de Pinyes moves N1 to (150, 250) and saves
    Then N1 retains id "abc-123" with updated coordinates
    And no new UUID is generated

  Scenario: Add a new node to existing template
    Given "Pilar de 4 — 2C" has 20 nodes
    When the Cap de Pinyes adds a new node and saves
    Then 20 existing nodes keep their IDs
    And 1 new node gets a new UUID
    And total nodes = 21

  Scenario: Remove a node from template (no instances)
    Given "Pilar de 4 — 2C" has node N5 and no FigureInstances
    When the Cap de Pinyes deletes N5 and saves
    Then N5 is removed from the database
    And remaining nodes keep their IDs

  Scenario: Remove a node from template (with unsnapshotted instances)
    Given "Pilar de 4 — 2C" has instance I1 (snapshotted = false)
    When the Cap de Pinyes deletes node N5 and saves
    Then N5 is removed (instance has no snapshot yet, so no dependency)

  Scenario: Template is freely editable regardless of snapshotted instances
    Given "Pilar de 4 — 2C" has instance I1 with snapshotted = true and 5 assignments
    When the Cap de Pinyes modifies the template (add/remove/move nodes)
    Then changes are saved successfully
    Because I1's InstanceNodes are independent copies
```

### 5.4 — Instance Lifecycle (Lazy Snapshot)

```gherkin
Feature: Instance Snapshot on First Assignment

  Scenario: Create instance from template (pre-snapshot)
    Given "Pilar de 4 — 2C" is placed in event segment S1
    Then a FigureInstance is created with:
      | figureTemplate    | "Pilar de 4 — 2C"   |
      | snapshotted       | false                |
      | sourceVariantOrder| null                 |
    And no InstanceNode rows exist for this instance

  Scenario: Loading an unsnapshotted instance shows live template nodes
    Given instance I1 references "Pilar de 4 — 2C" (snapshotted = false)
    And the template currently has 20 nodes
    When the assignment canvas loads I1
    Then it fetches the template and shows 20 nodes
    And these are live template nodes (not copies)

  Scenario: First assignment triggers snapshot
    Given instance I1 references "Pilar de 4 — 2C" (snapshotted = false)
    And the template has 20 nodes
    When the Cap de Pinyes assigns Person P1 to a node position
    Then the system:
      1. Creates 20 InstanceNode rows copying all template nodes
      2. Sets I1.snapshotted = true
      3. Sets I1.sourceVariantOrder = template's variantOrder
      4. Creates the NodeAssignment linking P1 → corresponding InstanceNode
    And future template edits do NOT affect I1

  Scenario: Subsequent assignments use existing snapshot
    Given instance I1 is snapshotted with 20 InstanceNodes
    When the Cap de Pinyes assigns Person P2 to another node
    Then no new snapshot is taken
    And the assignment points to an existing InstanceNode

  Scenario: Delete unsnapshotted instance
    Given instance I1 (snapshotted = false) exists in segment S1
    When the Cap de Pinyes removes I1
    Then I1 is deleted (no InstanceNodes to cascade)

  Scenario: Delete snapshotted instance
    Given instance I1 (snapshotted = true) has 20 InstanceNodes and 5 assignments
    When the Cap de Pinyes removes I1
    Then I1, its 20 InstanceNodes, and 5 assignments are all CASCADE-deleted
```

### 5.5 — Instance Upgrade (Add Cordon)

```gherkin
Feature: Upgrade Instance to Larger Variant

  Scenario: Upgrade a snapshotted instance to the next variant
    Given instance I1 is snapshotted from "Pilar de 4 — 2C" (variantOrder = 2, 20 nodes)
    And "Pilar de 4 — 3C" exists (variantOrder = 3, 28 nodes)
    And 8 of the 3C nodes have no originNodeId match in 2C (they are ring-3-exclusive)
    When the Cap de Pinyes triggers "Afegir cordó" on I1
    Then:
      1. System finds next variant: "3C" (variantOrder = 3)
      2. For each 3C node, computes canonical ID: originNodeId ?? self.id
      3. For each existing InstanceNode, computes canonical ID: originNodeId ?? sourceNodeId
      4. Matches by canonical ID — shared nodes are already in the instance
      5. Adds 8 new InstanceNodes for unmatched 3C nodes
      6. Existing 20 InstanceNodes and their assignments are untouched
      7. I1.sourceVariantOrder is updated to 3
      8. I1.figureTemplate is updated to reference "3C"

  Scenario: Upgrade preserves node geometry from target variant
    Given instance I1 upgrades from 2C to 3C
    Then new InstanceNodes inherit x, y, width, height, rotation, color from the 3C template nodes
    And they appear correctly positioned on the canvas

  Scenario: Upgrade is not possible — no larger variant exists
    Given instance I1 from "Pilar de 4 — 4C" (largest variant)
    When the Cap de Pinyes triggers "Afegir cordó"
    Then the system shows: "No hi ha una variant amb més cordons disponible per a aquesta família."
    And the button is disabled if no next variant exists

  Scenario: Upgrade an unsnapshotted instance
    Given instance I1 references "Pilar de 4 — 2C" (snapshotted = false)
    When the Cap de Pinyes triggers "Afegir cordó"
    Then the system first snapshots from "2C" (20 InstanceNodes)
    Then adds the 8 new nodes from "3C"
    And I1 is now snapshotted = true with 28 InstanceNodes

  Scenario: Double upgrade (2C → 3C → 4C)
    Given instance I1 was upgraded from 2C to 3C (28 InstanceNodes)
    And "Pilar de 4 — 4C" exists (variantOrder = 4, 36 nodes)
    When the Cap de Pinyes triggers "Afegir cordó" again
    Then 8 additional InstanceNodes are added from 4C-exclusive nodes
    And total = 36 InstanceNodes
```

### 5.6 — Assignment Rules (Preserved)

```gherkin
Feature: Node Assignment Invariants

  Scenario: One person per node per instance
    Given instance I1 has InstanceNode IN1 assigned to Person P1
    When someone tries to assign Person P2 to IN1
    Then the system rejects: "Aquesta posició ja està ocupada."

  Scenario: One person per segment (across instances)
    Given segment S1 has instances I1 and I2
    And Person P1 is assigned in I1
    When someone tries to assign P1 in I2
    Then the system rejects: "Aquesta persona ja està assignada a una altra figura del segment."

  Scenario: Swap two assigned persons
    Given I1 has IN1→P1 and IN2→P2
    When the Cap de Pinyes swaps IN1 and IN2
    Then IN1→P2 and IN2→P1

  Scenario: Unassign a person
    Given I1 has IN1→P1
    When the Cap de Pinyes unassigns IN1
    Then IN1 is empty and P1 is available

  Scenario: Bulk import remaps via sourceNodeId
    Given source instance S_I1 (from "2C") has assignment: InstanceNode(sourceNodeId="abc")→P1
    And target instance T_I1 (from "2C", freshly snapshotted) has InstanceNode(sourceNodeId="abc")
    When bulk import is executed
    Then P1 is assigned to T_I1's InstanceNode that has sourceNodeId="abc"
```

---

## 6. Edge Cases & Expected Errors

| Case | Expected Behavior | Error Message (Catalan) |
|------|-------------------|------------------------|
| Slug conflict on template | 409 | "L'identificador ja l'utilitza una altra figura. Canvia'l." |
| Slug conflict on family | 409 | "L'identificador ja l'utilitza una altra família. Canvia'l." |
| Delete template with instances (snapshotted or not) | 409 | "No es pot esborrar: hi ha instàncies que fan servir aquest template." |
| Delete template without instances but with composition slots | 409 | "No es pot esborrar: s'utilitza en composicions." |
| Delete family with variants | 409 | "No es pot esborrar: la família té variants associades." |
| Add cordon — no larger variant | Blocked | "No hi ha una variant amb més cordons disponible per a aquesta família." |
| Add cordon — instance already at max variant | Blocked | "Ja estàs a la variant més gran de la família." |
| Downgrade instance (remove cordon) with assignments on removed nodes | Blocked | "No es pot reduir: hi ha persones assignades a posicions del cordó N." |
| ringLevel gap in template (e.g., 1, 3 without 2) | Validation error on save | "Els nivells de cordó han de ser consecutius." |
| Assign person who declined event | Filtered in panel; if forced: 422 | "Aquesta persona no assisteix a l'event." |
| Two concurrent saves on same template | Last-write-wins (updatedAt column already present) | — |
| Template edit 409 for assignments (LEGACY — should no longer occur) | N/A after migration | N/A — the old `syncNodes` assignment guard is removed entirely |
| Derive variant from a template not in a family | Blocked | "Per crear variants, el template ha de pertànyer a una família." |
| Upgrade when origin nodes can't be matched | Add only matchable new nodes; warn about orphans | "S'han afegit X posicions noves. Y posicions no s'han pogut mapejar." |

---

## 7. Domain Invariants

1. **Snapshot immutability** — Once `snapshotted = true`, the instance's `InstanceNode` rows are NEVER modified by template changes. Only explicit upgrade adds new nodes.

2. **Assignment → InstanceNode only** — `NodeAssignment` points ALWAYS to `InstanceNode`, never to `FigureNode`. The old `figureNode` FK on `NodeAssignment` is removed.

3. **originNodeId lineage** — Within a family, derived nodes always trace `originNodeId` back to the **root ancestor** node (the node in the first variant that originated the position). Not to the immediate parent variant's node.

4. **Family ordering** — Variants within a family have strictly increasing `variantOrder`. Upgrade always moves to `variantOrder + 1`.

5. **ringLevel consistency** — All nodes in a template with `ringLevel = N` imply the existence of at least one node with each `ringLevel` 1..N-1 in the same template. No gaps.

6. **Cordó Obert independence** — Nodes of `positionType = 'cordo-obert'` may have `ringLevel = NULL`. Their presence is independent of the cordon count.

7. **One snapshot per instance** — The snapshot happens exactly once (first assignment). Cannot be "re-synced" to the template. Only upgrade adds nodes.

8. **Node ID stability** — Within a template, `FigureNode.id` is stable across saves. The backend performs upsert (update existing, create new, delete removed), never delete-all + recreate.

9. **XOR template/composition** — A `FigureInstance` has exactly one of `figureTemplate` or `compositionTemplate` set. Never both, never neither.

10. **One person per segment** — A person cannot appear in more than one `FigureInstance` within the same `EventSegment`.

---

## 8. UX Requirements

### 8.1 Family Management UI

- The template list screen is restructured: **families are the primary grouping**. Each family row expands to show its variants.
- **"Nova Família"** button with a modal: name, slug (auto-generated from name), optional description.
- **Tooltip on "Família":** "Una família agrupa les variants d'una mateixa figura. Per exemple, 'Pilar de 4' pot tenir variants amb 1, 2 o 3 cordons."
- Templates without a family (legacy data) appear in an "Altres" section at the bottom.

### 8.2 Variant Creation UI

- From a family row: **"Nova Variant"** button.
  - If no variants exist: opens the template editor with the family pre-linked.
  - If variants exist: modal asking "Derivar de quina variant?" with a dropdown of existing variants. On confirm, creates the derived template and opens the editor.
- **Tooltip on "Variant":** "Cada variant representa la mateixa figura amb un nombre diferent de cordons. Es pot derivar d'una variant existent per heretar les posicions."

### 8.3 Template Editor Additions

- **Ring level indicator:** Each pinya node shows a subtle badge with its `ringLevel` (e.g., "C1", "C2").
- **Ring level selector:** When adding or editing a pinya node, a selector for `ringLevel` (optional for cordo-obert).
- **Toolbar grouping:** Pinya positions can be filtered/grouped by ring level.
- **Tooltip on ringLevel:** "El nivell de cordó indica a quin anell concèntric pertany aquesta posició. Serveix per saber quines posicions s'afegeixen quan la figura creix."

### 8.4 Assignment Canvas Additions

- **"Afegir cordó" button** — visible when:
  - The instance belongs to a family with a next variant available
  - Shows the number of positions that would be added
- **Confirmation modal:** "Vols afegir un cordó? S'afegiran N posicions noves de la variant 'X'. Les assignacions actuals es mantindran."
- **Visual distinction:** Newly added nodes (from upgrade) highlighted with a subtle animation or border for 5 seconds after adding.
- **Tooltip on "Afegir cordó":** "Afegeix les posicions del següent cordó basant-se en la variant superior de la família. No afecta les assignacions existents."

### 8.5 Explanatory Onboarding

- First time a user accesses the pinyes module, a brief walkthrough modal explains:
  1. What families and variants are
  2. How cordons work
  3. How assignment and snapshots work (in non-technical terms)
- This modal can be dismissed and re-opened from a "?" help icon.

---

## 9. Code & Data Cleanup

### 9.1 Database Reset

Given the project is in development (no production data), a **clean migration** is recommended:
- Drop all existing `node_assignments`, `figure_instances`, `instance_nodes` (new), `figure_nodes`, `figure_templates`, `composition_slots`, `composition_templates` data.
- Apply schema changes via TypeORM migration.
- Re-seed with updated seed data that uses the new family/variant structure.

### 9.2 Backend Code to Remove

| File/Method | Reason |
|-------------|--------|
| `syncNodes()` delete-all + recreate logic | Replaced by upsert strategy |
| `NodeAssignment.figureNode` FK | Replaced by `instanceNode` FK |
| `countByNode()` in `NodeAssignmentService` | No longer needed (assignments don't block template edits) |
| Assignment guard check in `syncNodes()` | No longer needed |
| `handleDbError()` in template service | Keep but refine for family/variant slug conflicts |

### 9.3 Frontend Code to Remove/Refactor

| File/Area | Change |
|-----------|--------|
| `onSaveError()` in template editor | Fix 409 handling: distinguish slug conflict from other 409s (the assignment-blocked 409 no longer exists) |
| `assignment-canvas.component.ts` — template node fetch | Load InstanceNodes (for snapshotted) or template nodes (for unsnapshotted) |
| `bulkImport` logic | Remap via `sourceNodeId` on InstanceNodes instead of direct FigureNode IDs |
| Template list component | Restructure to show families with expandable variants |
| `figure-template.model.ts` | Add family, variantOrder, ringLevel fields |
| `assignment.model.ts` | `AssignmentNodeDetail` points to InstanceNode, add `sourceNodeId` |

### 9.4 Shared Library Changes

| File | Change |
|------|--------|
| `libs/shared/src/index.ts` | Export any new shared constants (e.g., `GROWABLE_POSITION_TYPES`) |
| No new enums needed | `ringLevel` is numeric, `positionType` remains a string |

---

## 10. Implementation Phases

The redesign is divided into **4 sequential phases**, each independently testable and deployable.

### Phase A — Data Foundation (Backend)
**Goal:** New entities, migration, stable node IDs. No frontend changes.

| Task | Details |
|------|---------|
| A.1 | Create `FigureFamily` entity + CRUD service + controller |
| A.2 | Add `family`, `variantOrder` columns to `FigureTemplate` |
| A.3 | Add `ringLevel`, `originNodeId` columns to `FigureNode` |
| A.4 | Create `InstanceNode` entity |
| A.5 | Add `snapshotted`, `sourceVariantOrder` columns to `FigureInstance` |
| A.6 | Migrate `NodeAssignment.figureNode` → `NodeAssignment.instanceNode` |
| A.7 | Replace `syncNodes()` with upsert strategy (match by ID, update/create/delete) |
| A.8 | Write TypeORM migration + seed script with family-structured data |
| A.9 | Unit tests for all new/modified services |

**Definition of Done:** All entities exist, migration runs clean, `syncNodes` is upsert-based, node IDs are stable across saves.

### Phase B — Snapshot & Upgrade (Backend)
**Goal:** Instance snapshot lifecycle + upgrade mechanism. No frontend changes yet.

| Task | Details |
|------|---------|
| B.1 | Implement snapshot logic: on first `assign()`, copy template nodes → InstanceNodes |
| B.2 | Modify `assign()` to target InstanceNodes instead of FigureNodes |
| B.3 | Implement `upgradeInstance()` — find next variant, diff, add new InstanceNodes |
| B.4 | Implement `GET /figure-instances/:id/nodes` — returns InstanceNodes if snapshotted, template nodes if not |
| B.5 | Modify `bulkImport()` to remap via `sourceNodeId` |
| B.6 | Modify `getHistory()` to work with InstanceNodes |
| B.7 | Modify `unassign()` and swap to work with InstanceNodes |
| B.8 | Remove legacy `countByNode()` and assignment guard from `syncNodes` |
| B.9 | Integration tests for full snapshot + upgrade + assignment lifecycle |

**Definition of Done:** Snapshot triggers on first assignment, upgrade adds nodes from next variant, all assignment operations use InstanceNodes, old assignment-blocking code removed.

### Phase C — Frontend Families & Templates
**Goal:** UI for families, variants, template editing improvements.

| Task | Details |
|------|---------|
| C.1 | Family CRUD service + models in dashboard |
| C.2 | Restructure template list: families as groups, variants as rows |
| C.3 | "Nova Família" modal with name, slug, description |
| C.4 | "Nova Variant" flow: derive-from selector, pre-link family |
| C.5 | Template editor: ringLevel selector for pinya nodes, badge display |
| C.6 | Fix `onSaveError()` — proper 409 differentiation |
| C.7 | Tooltips and explanatory text for families, variants, cordons |
| C.8 | Update `figure-template.model.ts` with new fields |
| C.9 | Tests for new components and services |

**Definition of Done:** Families visible in UI with CRUD, variants derivable, ring levels editable, tooltips present, error handling correct.

### Phase D — Frontend Assignment Upgrade
**Goal:** Assignment canvas uses InstanceNodes + upgrade capability.

| Task | Details |
|------|---------|
| D.1 | Assignment canvas loads InstanceNodes (snapshotted) or template nodes (unsnapshotted) |
| D.2 | "Afegir cordó" button + confirmation modal |
| D.3 | Visual feedback for newly added nodes after upgrade |
| D.4 | Update bulk import UI to handle sourceNodeId remapping |
| D.5 | Update assignment models (`AssignmentDetail`, `PendingOp`) for InstanceNode |
| D.6 | Onboarding walkthrough modal for pinyes module |
| D.7 | Integration tests for full assignment + upgrade flow |

**Definition of Done:** Assignment works with InstanceNodes, upgrade adds cordon from UI, bulk import works with new model, onboarding modal present.

### Phase Order & Dependencies

```
Phase A ──→ Phase B ──→ Phase C ──→ Phase D
(backend     (backend     (frontend    (frontend
 entities)    logic)       families)    assignment)
```

Phases C and D both depend on B, but C does not depend on D. They could be parallelized if two developers are available, but sequential execution is recommended for a single developer to avoid merge conflicts in shared models.

---

## 11. Out of Scope

- **Composition instance assignment UI** — existing gap, separate spec needed
- **Projection fullscreen (P5.5)** — separate feature
- **Per-person figure history API (P5.5)** — separate feature
- **Downgrade instance (remove cordon)** — future enhancement, blocked if assignments exist on removed ring
- **Automatic cordon layout algorithm** — positions are always designed manually in templates
- **Multi-tenant family sharing** — future, each colla will have its own families
- **Version history for templates** — not versioning; families and variants cover the use case
