# Pinyes Module Refactor — Tracking

Full audit of the pinyes module (figure, composition, event-segment, node-assignment, reference-element + dashboard feature).
Audit date: 2026-06-05.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Pending |
| 🔄 | In progress |
| ✅ | Done |
| ❌ | Cancelled / deferred |

---

## Phase 1 — Critical + High bugs (backend)

### CRITICAL

| ID | Status | Description | File(s) |
|----|--------|-------------|---------|
| C1 | ✅ | Snapshot race condition — concurrent first-assignments duplicate `InstanceNode` rows. Fixed: pessimistic write lock + idempotency guard in `snapshotInstance` + `@Unique` constraint on `(figureInstance, sourceNodeId)` | `node-assignment.service.ts`, `instance-node.entity.ts` |
| C2 | ✅ | Composition slot sync not transactional — `delete all` + `createSlots` without transaction causes slot data loss. Fixed: pre-validate template IDs, wrap delete+create in transaction | `composition-template.service.ts` |

### HIGH

| ID | Status | Description | File(s) |
|----|--------|-------------|---------|
| H1 | ✅ | `assignedCount` hardcoded to `0` in `FigureInstanceService.findOneById` | `figure-instance.service.ts` |
| H2 | ✅ | `duplicate()` skips rengles — duplicated variant loses cordon structure | `figure-template.service.ts` |
| H3 | ✅ | History `getCount()` inflated by `leftJoinAndSelect` on collections (`assignments`, `instanceNodes`) | `node-assignment.service.ts` |
| H4 | ✅ | `FigureTemplateService.update` not transactional — partial failure between `save`, `syncNodes`, `syncRengles` leaves inconsistent state | `figure-template.service.ts` |
| H5 | ✅ | Composition slug not validated for uniqueness in `update` / `create` — unhandled 23505 DB error | `composition-template.service.ts` |
| H6 | ✅ | `upgradeInstance` not atomic — Fixed: wrapped node save + position updates + instance FK update in `dataSource.transaction` | `node-assignment.service.ts` |
| H7 | ✅ | `updateCordons` bypasses assignment lock — Fixed: added `checkEventLock(instanceId)` call | `node-assignment.service.ts` |
| H8 | ✅ | Reorder partial — Fixed: validate dto contains ALL existing IDs, reject partial reorders with `BadRequestException` | `event-segment.service.ts`, `figure-instance.service.ts` |
| H9 | ✅ | Composition `findOne` missing family nodes (TRONC/BASE) — Fixed: load family relation, batch-fetch `FigureFamilyNode`s, merge into slot node list | `composition-template.service.ts` |
| H10 | ✅ | N+1 in projection endpoint — Fixed: batch load all `InstanceNode`s and `NodeAssignment`s with `In()`, removed per-instance service calls | `projection.service.ts`, `event-segment.module.ts` |
| H11 | ✅ | N+1 in `getEventAssignmentSummary` — Fixed: single query for all instances via `In(segmentIds)`, group in memory | `node-assignment.service.ts` |
| H12 | ✅ | `assign()` does not verify `person.isActive` — Fixed: added `BadRequestException` guard after person lookup | `node-assignment.service.ts` |
| H13 | ✅ | `duplicate()` for FigureTemplate missing rengles — (fixed in H2) | — |
| H14 | ✅ | `FigureInstanceService.assignedCount` — (fixed in H1) | — |

---

## Phase 2 — Shared types migration

Move response interfaces and request interfaces from `apps/api` modules and `apps/dashboard/features/pinyes/models/` to `libs/shared`.

### Current state
- **Enums already shared**: `FigureZone`, `NodeShape`, `ReferenceElementType`
- **28 DTOs** in API modules (class-validator, stay in API)
- **~28 service response interfaces** (inline in service files) — Tier A candidates
- **~60 dashboard model interfaces** — mirror of API response shapes, drifting

### Tier A — API response interfaces (highest ROI)

| ID | Status | Interface(s) | Module |
|----|--------|-------------|--------|
| S1 | ✅ | `FigureNodeItem`, `RenglaItem`, `FigureTemplateListItem`, `FigureTemplateDetail` | figure |
| S2 | ✅ | `FigureFamilyVariant`, `FigureFamilyListItem`, `FigureFamilyDetail` | figure |
| S3 | ✅ | `CompositionSlotItem`, `CompositionTemplateListItem`, `CompositionTemplateDetail` | composition |
| S4 | ✅ | `InstanceRef`, `SegmentDetail` | event-segment |
| S5 | ✅ | `ProjectionInstance`, `ProjectionSegmentData` | event-segment |
| S6 | ✅ | `AssignmentDetail`, `InstanceNodeItem` | node-assignment |
| S7 | ✅ | `AvailablePerson`, `AvailablePersonPosition` | node-assignment |
| S8 | ✅ | History/summary types: `FigureHistoryEntry`, `PersonAssignmentEntry`, `EventFigureSummary`, etc. | node-assignment |
| S9 | ✅ | `ReferenceElementItem` | reference-element |

### Tier B — Request interfaces (optional, after Tier A)

| ID | Status | Description |
|----|--------|-------------|
| S10 | ⬜ | All `Create*Payload` / `Update*Payload` dashboard models → shared interfaces implemented by API DTOs |

### Tier D — Quick wins (no move needed, just fix drift)

| ID | Status | Description | File |
|----|--------|-------------|------|
| D1 | ✅ | `assignment.model.ts` uses local `AttendanceStatus` union → import from `@muixer/shared` | `apps/dashboard/.../models/assignment.model.ts` |
| D2 | ✅ | `assignment.model.ts` uses `zone: string` → change to `zone: FigureZone` | same |

---

## Phase 3 — Dead code cleanup

### Frontend dead code (HIGH)

| ID | Status | What | Evidence |
|----|--------|------|----------|
| DC1 | ✅ | `SegmentCanvasComponent` (554 lines) | Selector never imported outside file; replaced by CSS grid projection |
| DC2 | ✅ | `ReferenceElementService` (frontend) | No component injects it; only in spec |
| DC3 | ✅ | `reference-element.model.ts` payload types | Only consumed by dead service / dead component |

### Frontend dead code (MEDIUM)

| ID | Status | What | File |
|----|--------|------|------|
| DC4 | ✅ | `compositionSlotItemToCanvasSlot()` | `figure-canvas.component.ts` |
| DC5 | ✅ | `calculatePinyaCentroid()` | `ghost-clone.util.ts` |
| DC6 | ✅ | `ProjectionService.updateProjectionLayout` (frontend) | `projection.service.ts` |
| DC7 | ✅ | `NodeAssignmentService.getNextPerformance` (frontend) | `node-assignment.service.ts` (dashboard) |
| DC8 | ✅ | `FigureInstanceService.update` + `reorder` (frontend) | `figure-instance.service.ts` (dashboard) |
| DC9 | ✅ | `CanvasStateService` signals: `zoom`, `panOffset`, `selectedNodeId` | `canvas-state.service.ts` |
| DC10 | ✅ | `FigureCanvasComponent`: `getStageTransform()`, `nodeDoubleClicked` output, `zoomChanged` output | `figure-canvas.component.ts` |

### Backend dead code (MEDIUM — policy decision needed)

| ID | Status | What | Notes |
|----|--------|------|-------|
| DC11 | ✅ | `POST /instances/:id/upgrade` backend endpoint | Removed: no frontend client; `sourceVariantOrder`/`originNodeId` columns kept |
| DC12 | ✅ | Reference-element REST CRUD controller | Controller + spec deleted; `ReferenceElementService` (backend) + entity kept (used by projection) |
| DC13 | ✅ | `PUT /segments/:id/instances/projection-layout` | Removed: superseded by P5.9 CSS grid; `projectionX/Y/Scale` columns kept |

---

## Phase 4 — Frontend quality

### P1 (critical quality)

| ID | Status | Issue | Scope |
|----|--------|-------|-------|
| FQ1 | ✅ | **No `takeUntilDestroyed()` anywhere** — all 8+ components with `.subscribe()` have no cleanup | Module-wide |
| FQ2 | ⬜ | `figure-canvas.component.ts` (~1600 lines) — extract KonvaStageService + mode renderers (dead extraction removed 2026-06-12; never wired up) | `figure-canvas/` |
| FQ3 | ✅ | N+1 family detail loading in `TemplateListComponent` + `FigurePickerModalComponent` | `template-list/`, `figure-picker-modal/` |
| FQ4 | ✅ | `template-list.component.html` (728 lines) — extract tab subcomponents | `template-list/` |
| FQ5 | ✅ | `template-editor.component.ts` (817 lines) + `assignment-canvas.component.ts` (816 lines) — split | — |

### P2 (convention / nice to have)

| ID | Status | Issue | Scope |
|----|--------|-------|-------|
| FQ6 | ✅ | Migrate 4 `@ViewChild` usages to `viewChild()` | `person-panel`, `figure-canvas`, `composition-editor`, `segment-canvas` |
| FQ7 | ✅ | Shared drag-panel directive (duplicated in template-editor + assignment-canvas + projection-view) | Extract `FloatingPanelDragDirective` |
| FQ8 | ✅ | Shared utils: height formatting, attendance badge, `slugify` | Extract to `utils/` |
| FQ9 | ✅ | `effect()` / `linkedSignal()` underused — migrate `OnInit` + `OnChanges` reactive patterns | Module-wide |
| FQ10 | ✅ | `CommonModule` import unnecessary in `projection-view` (uses `@if`/`@for` control flow) | `projection-view/` |
| FQ11 | ✅ | Modal focus trap — add `CdkTrapFocus` to all modals | import-pinya, family-history, figure-picker, cordons-dialog, pinyes-onboarding |
| FQ12 | ✅ | `family-history-modal` table rows only clickable with mouse — add keyboard support | `family-history-modal/` |

---

## Backend conventions (MEDIUM)

| ID | Status | Issue | File(s) |
|----|--------|-------|---------|
| BC1 | ✅ | Missing `updatedAt` on `Rengla` entity | `rengla.entity.ts` |
| BC2 | ✅ | Missing `updatedAt` on `InstanceNode` entity | `instance-node.entity.ts` |
| BC3 | ✅ | Missing `createdAt`/`updatedAt` on `CompositionSlot` entity | `composition-slot.entity.ts` |
| BC4 | ✅ | ~10 `any` usages in `node-assignment.service.ts` | `node-assignment.service.ts` |
| BC5 | ✅ | `AvailablePersonsQuery` is an interface, not a DTO — lacks `@Type()`, `@Transform()` | `available-persons.service.ts` |
| BC6 | ✅ | Filter DTOs missing `@Max(100)` on `limit` | figure, composition filter DTOs |
| BC7 | ✅ | `assign()` does not check `person.isActive` | `node-assignment.service.ts` |
| BC8 | ✅ | Default pagination limit inconsistency (25 in filters, 20 in history) | filter DTOs |

---

## Notes

- **Phase 1 completed**: 2026-06-05 (C1-C2 + H1-H14 all done)
- **Phase 2 completed**: 2026-06-05 — Tier A (S1-S9) + quick wins (D1-D2) done. 6 new interface files in `libs/shared/src/interfaces/pinyes/`. All backend services import from `@muixer/shared`, all frontend models re-export via `export type`. Tests: API 517/517, Dashboard 479/479.
- **Phase 3 completed**: 2026-06-05 — DC1-DC13 all done. Deleted: `segment-canvas/`, `reference-element.{service,model}` (frontend), reference-element controller (backend), `UpdateProjectionLayoutDto`. Removed: `upgradeInstance()`, 6 dead methods/functions, 3 dead signals, 3 dead `FigureCanvasComponent` members, all cascade types + specs. Tests: API 502/502, Dashboard 465/467 (2 skipped). `nx build api` ✅; `nx build dashboard` fails pre-existing (unrelated to Phase 3).
- **Backend conventions completed**: 2026-06-05 — BC1-BC8 all done. Added `updatedAt` to `Rengla`/`InstanceNode`, `createdAt`+`updatedAt` to `CompositionSlot`. Eliminated 8 `as any` casts (IsNull(), remove unnecessary casts). Converted `AvailablePersonsQuery` interface to `AvailablePersonsQueryDto` class with `@Type`/`@Transform`. Added `@Max(100)` + DTO-level defaults to 3 filter DTOs. Standardized history pagination default to 25. Tests: API 502/502.
- **Phase 4 completed**: 2026-06-05 — FQ1, FQ3-FQ12 done. FQ2 deferred: extracted `KonvaStageService` + 4 mode renderers were never wired to `FigureCanvasComponent` and were removed 2026-06-12 as dead code. Key deliverables: `takeUntilDestroyed` on 48 subscriptions across 10 components (FQ1); N+1 eliminated via `includeVariants` API param + client-side family grouping (FQ3); `template-list` split into `FamilyListTab`, `FigureGridTab`, `CompositionGridTab` tab components (FQ4); `TemplateEditorStateService` + `AssignmentTabService` + `AssignmentOperationsService` extracted, components reduced to ~200 lines each (FQ5); 3 `@ViewChild` → `viewChild()` (FQ6); `FloatingPanelDragDirective` extracted (FQ7); `slugify`, `height-display`, `attendance-display` utils extracted (FQ8); 3 `ngOnChanges`/`ngOnInit` → `effect()`, 2 `signal()` → `linkedSignal()` (FQ9); `CommonModule` removed (FQ10); `CdkTrapFocus` on 11 modal surfaces (FQ11); keyboard navigation on history table rows (FQ12). Tests: Dashboard 465/467 (2 pre-existing skips).
- **Phase 5 (R3) completed**: 2026-06-12 — Simplificació de Rengles i editor de templates. Auto-nom/slug únics en crear, obligació de nom abans d'afegir nodes, creació de rengles sense formulari (nom i `allowsCordoObert` automàtics), eliminació de `startPosition`, rengles només esborrables (no editables), ghost clone sense `renglaId`, desassignació automàtica en reduir cordons. Migració `1781300000000-SimplifyRengles`.
- **Next**: P5.3.1 (UX Segments), Q1 (E2E), or P6 PWA mobile
- Each phase should have its own feature branch and PR for reviewability

---

## Phase 5 — Rengles & template editor simplification (R3)

| ID | Status | Description |
|----|--------|-------------|
| R3.1 | ✅ | Enforce figure name before first node (modal prompt) |
| R3.2 | ✅ | Auto-generate unique slug and name on create; slug read-only in UI |
| R3.3 | ✅ | Simplified rengla creation — select nodes + Finalitzar, no mini-dialog |
| R3.4 | ✅ | Auto-compute `allowsCordoObert` from last node type |
| R3.5 | ✅ | Remove `startPosition`; `ringLevel` = `renglaPosition` |
| R3.6 | ✅ | Ghost clone does not copy rengla fields |
| R3.7 | ✅ | Rengles delete-only after creation |
| R3.8 | ✅ | Unassign people from hidden nodes when cordons reduced |
| R3.9 | ✅ | DB migration `1781300000000-SimplifyRengles` |
