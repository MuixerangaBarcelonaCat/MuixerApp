# Unified Segment Workspace — Design & Implementation Plan

**Date:** 2026-07-07
**Status:** Approved design, pending implementation
**Scope:** Frontend only (`apps/dashboard`). No API changes expected.

## 1. Problem

Assignments in segments with several figures require switching between per-figure
tabs, which is impractical — especially for troncs, where assigning everything from
a single window is far more convenient. Distribution lives in a separate view
(`/distribute`), adding another context switch.

## 2. Goal

Replace the per-figure assignment view and the separate distribution view with a
single **Segment Workspace** at the existing route
`/pinyes/events/:eventId/segments/:segmentId/assign`, organized in **5 tabs**:

1. **Pinyes** — all figures of the segment on one canvas (PINYA + BASE nodes), at
   their distributed positions. Node selection + person assignment, same
   interaction model as today (click node → click person, auto-advance). No
   "add node" button here (moved to Nodes extra).
2. **Troncs** — the tronc views of all figures side by side (horizontal flex),
   person panel on the right. Assignable nodes: PINYA (tronc-related), TRONC,
   DIRECTION.
3. **Distribució** — same canvas as the current distribution editor, plus a
   right-hand properties panel (like the composition editor's) to edit the
   selected figure's: position (x, y), label, rotation, number of cordons,
   figure mode (COMPLETA / PEU / REMAT / NETA).
4. **Nodes extra** — add ad-hoc nodes (assignable or decorative) and the "normal
   node" presets that currently live in the pinya view. Figure selector on the
   left (nodes belong to the selected figure); node properties panel on the
   **right**. Canvas shows all figures with non-selected ones dimmed.
5. **Previsualitza** — embeds exactly what the "Projecta" button in the segment list
   shows today (the existing `ProjectionViewComponent` content for the segment).

The **Distribueix** button in the segment manager is removed. The `/distribute`
route and `DistributionEditorComponent` are deleted.

## 3. Key decisions (from design review)

- **New component, not a rewrite in place.** `SegmentWorkspaceComponent` replaces
  `AssignmentCanvasComponent` at the same URL. Logic is decomposed into per-tab
  child components that reuse existing services/utils. The old
  `AssignmentCanvasComponent` and `DistributionEditorComponent` are deleted at the
  end.
- **One canvas, new mode.** `FigureCanvasComponent` gains a mode
  `'segment-assignment'`: multi-slot rendering (as in `composition`/distribution
  usage) **plus** assignment interactions (node selection, assigned-person
  rendering, hover cards). We do NOT render N canvases.
- **Snapshot semantics unchanged.** Non-snapshotted instances render template
  nodes; first assignment to a figure snapshots that figure only. Mixed
  snapshot states coexist on the same canvas.
- **Auto-advance stays within the same figure** (`pickNextAssignableNode` scoped
  per instance).
- **Deep-linking.** Query params: `?tab=<pinyes|troncs|distribucio|nodes|projecta>`
  and optional `?figure=<instanceId>` to preselect a figure.
- **Placement mock replaces the old split-screen fallback.** When a segment has
  no saved distribution (`projectionX === null`), positions come from the
  placement util (below) instead of the old index-based screen splitting
  (`index * AUTO_PLACE_GAP` and any per-figure viewport splitting in the
  assignment canvas). The old splitting logic is removed.
- **No API changes.** Distribution save (`PUT .../instances/distribution` via
  `SegmentDistributionService`), instance updates (label, cordons, figureMode via
  `FigureInstanceService`), assignments, and projection endpoints are reused
  as-is. Projection of figures is unchanged.

## 4. Architecture

### 4.1 New files (all under `apps/dashboard/src/app/features/pinyes/`)

```
components/segment-workspace/
  segment-workspace.component.ts|html        → shell: header, tab bar, routing, load
  tabs/pinyes-tab/pinyes-tab.component.*     → tab 1
  tabs/troncs-tab/troncs-tab.component.*     → tab 2
  tabs/distribution-tab/distribution-tab.component.*        → tab 3
  tabs/distribution-tab/figure-properties-panel.component.* → right panel of tab 3
  tabs/extra-nodes-tab/extra-nodes-tab.component.*          → tab 4
  tabs/projection-tab/projection-tab.component.*            → tab 5 (thin wrapper)
services/segment-workspace-state.service.ts  → shared per-workspace state
utils/figure-placement.util.ts               → placement mock (pure functions)
```

Each new file gets a co-located `.spec.ts` (Vitest), written test-first.

### 4.2 `SegmentWorkspaceStateService` (provided at workspace level)

Signal store holding what today is split between `AssignmentCanvasComponent`
internals and `AssignmentStateService`:

- `segment`, `instances: InstanceTab[]` (id, label, nodes, snapshotted,
  figureMode, numberOfCordons, distribution position, tronc panel position,
  counts), `loading`, `lockStatus`
- Selection: `selectedInstanceId`, plus the existing `AssignmentStateService`
  signals (`selectedNodeId`, `selectedPersonId`, `assignments`,
  `confirmedPersons`, `pendingOperations`) which remain the source of truth for
  assignment state — the new service composes it, does not duplicate it.
- Derived: `slots` (`CompositionSlotWithNodes[]` for the canvas, with
  figure-mode/cordons filtering via `filterNodesByFigureMode` +
  `computeCordoObertOverrides`), `effectivePositions` (saved distribution or
  placement-mock fallback).
- Actions: `load()`, `assign/unassign` (delegating to `NodeAssignmentService`),
  `updateInstanceProps()`, `saveDistribution()`, `addAdHocNode()`.

The per-instance snapshot-on-first-assignment flow moves here (it currently
lives in the assignment canvas component).

### 4.3 `FigureCanvasComponent` — new mode `'segment-assignment'`

- Renders slots like `composition` mode (offsets, angles, labels, tronc panels
  where relevant).
- Enables assignment-mode node interaction (click-select, assigned initials,
  hover info, highlight) across all slots; emits `nodeSelected` with
  `{ slotId, nodeId }` (today assignment mode is single-instance and emits only
  `nodeId` — the event payload is extended, existing modes unaffected).
- No slot dragging (that is Distribució's job), no add-node affordances.
- Dimming support: input `dimmedSlotIds: Set<string>` (used by Nodes extra tab).

### 4.4 Tabs

**Pinyes** — `FigureCanvasComponent` in `segment-assignment` mode showing
PINYA/BASE zones + ad-hoc assignables; `PersonPanelComponent` on the right.
Selecting a node sets `selectedInstanceId` from the slot. Assignment flow,
undo/redo (`UndoRedoService` provided at workspace level so undo history spans
tabs), already-assigned dialog, import-pinya modal, and lock handling are lifted
from the current assignment canvas. No ad-hoc properties panel here (moved to
Nodes extra); double-clicking an ad-hoc node switches to the Nodes extra tab
with that figure/node selected.

**Troncs** — horizontal flex row (`overflow-x: auto`) of `TroncViewComponent`s
in `assignment` mode, one per figure that has a tronc, ordered by segment order,
each titled with the figure label. Shared `PersonPanelComponent` on the right.
Node selection in any tronc updates the shared selection; assignment works
exactly as in today's tronc view mode.

**Distribució** — `FigureCanvasComponent` in existing `composition`-style
distribution usage (slot dragging + rotation + tronc-panel dragging), as in the
current `DistributionEditorComponent`, saving through
`SegmentDistributionService` with the same debounce/status behavior. New
right-hand `FigurePropertiesPanelComponent` bound to the selected slot:

- x / y (numeric inputs, write-through to slot + save)
- label
- rotation (angle)
- number of cordons (same control as the composition editor's panel)
- figure mode select (COMPLETA / PEU / REMAT / NETA — same options/confirm
  behavior as the segment manager where destructive)

Cordons/mode/label changes go through `FigureInstanceService.update()` (existing
endpoint); position/angle through the distribution save.

**Nodes extra** — left: figure selector (list of the segment's figures; sets
`selectedInstanceId`). Center: `FigureCanvasComponent` (`segment-assignment`
mode) with all figures, non-selected dimmed. Right: node palette — the PINYA
presets ("add normal node", moved from the current pinya view), ad-hoc
assignable presets, decoration presets, comodí — plus the
`AdHocNodePropertiesComponent` for the selected ad-hoc node (panel on the
right, per design). New nodes are added to the currently selected figure using
today's ad-hoc node creation flow.

**Previsualitza** — renders the same content as the segment-list "Projecta" button
target: embed `ProjectionViewComponent`'s segment view for this segment (extract
its inner canvas into an embeddable component if needed, or reuse it directly
with router-independent inputs — decided at implementation time, preferring
direct reuse).

### 4.5 Placement mock — `figure-placement.util.ts`

Pure util, unit-tested, no API:

```ts
interface PlacedFigure { instanceId: string; x: number; y: number;
  width: number; height: number; troncPanelX: number | null; troncPanelY: number | null; }

/** Mock: lay out figures left-to-right with a gap, tronc panel above each pinya.
 *  Later replaced by a real space-optimizing algorithm (same signature). */
placeFigures(figures: FigureExtent[]): PlacedFigure[]
placeNewFigure(existing: PlacedFigure[], figure: FigureExtent): PlacedFigure
```

Used in two places:

1. **Load fallback:** when the segment has no saved distribution, the workspace
   computes positions with `placeFigures` (all figures in a horizontal line).
   This replaces the old `index * AUTO_PLACE_GAP` fallback and the old
   per-figure screen-splitting logic, which are deleted.
2. **Adding a figure:** when an instance is added to a distributed segment, its
   position comes from `placeNewFigure` (right of the bounding box of existing
   figures, tronc panel above) and is persisted with the next distribution save.

### 4.6 Routing & cleanup

- `/assign` and `/assign/:instanceId` → `SegmentWorkspaceComponent`
  (`:instanceId` maps to `?figure=` preselection for backward compatibility).
- `?tab=` restores the active tab; default `pinyes`.
- Delete route `/distribute`, `DistributionEditorComponent`, and the
  "Distribueix" button in `segment-manager.component.html` (the "Assigna"
  entry point remains and now covers distribution).
- Delete `AssignmentCanvasComponent` once all behavior is ported (its spec
  assertions are ported to the new components first).

## 5. Implementation phases (TDD throughout)

Every step: write failing spec → watch it fail → minimal code → green → refactor.

**Phase 0 — Placement util.** `figure-placement.util.spec.ts`: horizontal-line
layout, gap, tronc above pinya, `placeNewFigure` appends to the right of the
bounding box. Pure functions, easiest TDD entry.

**Phase 1 — Workspace shell + state service.**
`SegmentWorkspaceStateService` specs (load composes segment + instances +
assignments + distribution; fallback to placement mock when positions are null;
slot derivation with mode/cordons filtering). Shell component specs (tab bar,
`?tab=`/`?figure=` sync, fullscreen layout, lock banner). Route swap to the new
shell (old component still deleted later).

**Phase 2 — `segment-assignment` canvas mode.** Specs on
`FigureCanvasComponent`: multi-slot render with node click emitting
`{ slotId, nodeId }`, assigned-person rendering per slot, dimming input,
no drag in this mode. Existing mode specs stay green.

**Phase 3 — Pinyes tab.** Port assignment flow: select node → select person →
optimistic assign, auto-advance within figure, snapshot-on-first-assignment via
state service, unassign, already-assigned dialog, undo/redo, import pinya.
Most specs adapted from `assignment-canvas.component.spec.ts`.

**Phase 4 — Troncs tab.** One `TroncViewComponent` per figure with tronc
content, horizontal flex, shared person panel, cross-tronc selection and
assignment.

**Phase 5 — Distribució tab.** Port distribution editor behavior (drag, rotate,
tronc panel move, debounced save, clear) + new properties panel (x/y/label/
rotation/cordons/mode; instance update endpoint calls; destructive mode-change
confirm).

**Phase 6 — Nodes extra tab.** Figure selector, dimming, node palette (normal
presets + comodí + decorations), properties panel on the right,
add/edit/delete/copy-paste ad-hoc nodes scoped to the selected figure.

**Phase 7 — Previsualitza tab.** Embed segment projection view; verify identical
output to the segment-list Projecta target.

**Phase 8 — Cleanup.** Delete `AssignmentCanvasComponent`,
`DistributionEditorComponent`, `/distribute` route, Distribueix button, old
split-screen fallback logic. Update `CLAUDE.md` routes section and any docs
referencing `/distribute`. `pnpm run ci:local` green.

## 6. Testing summary

- Unit (Vitest, co-located): placement util, state service, each tab component,
  canvas mode additions, properties panel. Coverage threshold 70% maintained.
- Manual verification checklist at the end: full flow on a segment with ≥2
  figures (assign in pinyes, assign in troncs, move + edit props in
  distribució, add ad-hoc node in nodes extra, check projecta output and the
  standalone projection route unchanged).

## 7. Out of scope

- Real space-optimization algorithm (mock only, stable signature).
- API/backend changes.
- Projection view changes (must remain byte-identical in behavior).
- PWA.

## 8. Risks

- **`FigureCanvasComponent` complexity** (~2k lines, 4 existing modes): the new
  mode must not regress others — mitigated by keeping existing specs green and
  adding mode-specific specs before code.
- **Behavior parity** with the old assignment canvas (undo/redo, locks,
  optimistic ops): mitigated by porting its spec file assertions before deleting
  it.
- **Performance** with many figures on one Konva stage: acceptable for typical
  segment sizes (few figures); revisit if needed.
