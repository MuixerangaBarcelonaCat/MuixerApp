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
| H6 | ⬜ | `upgradeInstance` not atomic — 3 separate write operations without transaction | `node-assignment.service.ts` |
| H7 | ⬜ | `updateCordons` bypasses assignment lock (`checkEventLock` not called) — policy decision needed | `node-assignment.service.ts` |
| H8 | ⬜ | Reorder partial — omitted segment/instance IDs keep stale `sortOrder`, creates duplicates | `event-segment.service.ts`, `figure-instance.service.ts` |
| H9 | ⬜ | Composition `findOne` missing family nodes (TRONC/BASE) — canvas shows incomplete figures | `composition-template.service.ts` |
| H10 | ⬜ | N+1 in projection endpoint — 2N service calls per instance | `projection.service.ts` |
| H11 | ⬜ | N+1 in `getEventAssignmentSummary` — 1 query per segment | `node-assignment.service.ts` |
| H12 | ⬜ | `assign()` does not verify `person.isActive` — inactive persons can be assigned | `node-assignment.service.ts` |
| H13 | ⬜ | `duplicate()` for FigureTemplate missing rengles ← done (H2) | — |
| H14 | ⬜ | `FigureInstanceService.assignedCount` ← done (H1) | — |

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
| S1 | ⬜ | `FigureNodeItem`, `RenglaItem`, `FigureTemplateListItem`, `FigureTemplateDetailItem` | figure |
| S2 | ⬜ | `FigureFamilyVariantSummary`, `FigureFamilyListItem`, `FigureFamilyDetailItem` | figure |
| S3 | ⬜ | `CompositionSlotItem`, `CompositionTemplateListItem`, `CompositionTemplateDetailItem` | composition |
| S4 | ⬜ | `InstanceRef`, `SegmentWithInstances` | event-segment |
| S5 | ⬜ | `ProjectionInstanceData`, `ProjectionData` | event-segment |
| S6 | ⬜ | `AssignmentDetail`, `InstanceNodeResponse` | node-assignment |
| S7 | ⬜ | `AvailablePersonDto`, `AvailablePersonPositionDto`, `AvailablePersonsQuery` | node-assignment |
| S8 | ⬜ | History/summary types: `FigureHistoryEntry`, `PersonAssignmentEntry`, `EventFigureSummary`, etc. | node-assignment |
| S9 | ⬜ | `ReferenceElementItem` | reference-element |

### Tier B — Request interfaces (optional, after Tier A)

| ID | Status | Description |
|----|--------|-------------|
| S10 | ⬜ | All `Create*Payload` / `Update*Payload` dashboard models → shared interfaces implemented by API DTOs |

### Tier D — Quick wins (no move needed, just fix drift)

| ID | Status | Description | File |
|----|--------|-------------|------|
| D1 | ⬜ | `assignment.model.ts` uses local `AttendanceStatus` union → import from `@muixer/shared` | `apps/dashboard/.../models/assignment.model.ts` |
| D2 | ⬜ | `assignment.model.ts` uses `zone: string` → change to `zone: FigureZone` | same |

---

## Phase 3 — Dead code cleanup

### Frontend dead code (HIGH)

| ID | Status | What | Evidence |
|----|--------|------|----------|
| DC1 | ⬜ | `SegmentCanvasComponent` (554 lines) | Selector never imported outside file; replaced by CSS grid projection |
| DC2 | ⬜ | `ReferenceElementService` (frontend) | No component injects it; only in spec |
| DC3 | ⬜ | `reference-element.model.ts` payload types | Only consumed by dead service / dead component |

### Frontend dead code (MEDIUM)

| ID | Status | What | File |
|----|--------|------|------|
| DC4 | ⬜ | `compositionSlotItemToCanvasSlot()` | `figure-canvas.component.ts` |
| DC5 | ⬜ | `calculatePinyaCentroid()` | `ghost-clone.util.ts` |
| DC6 | ⬜ | `ProjectionService.updateProjectionLayout` (frontend) | `projection.service.ts` |
| DC7 | ⬜ | `NodeAssignmentService.getNextPerformance` (frontend) | `node-assignment.service.ts` (dashboard) |
| DC8 | ⬜ | `FigureInstanceService.update` (frontend) | `figure-instance.service.ts` (dashboard) |
| DC9 | ⬜ | `CanvasStateService` signals: `zoom`, `panOffset`, `selectedNodeId` | `canvas-state.service.ts` |
| DC10 | ⬜ | `FigureCanvasComponent`: `getStageTransform()`, `nodeDoubleClicked` output, `zoomChanged` output | `figure-canvas.component.ts` |

### Backend dead code (MEDIUM — policy decision needed)

| ID | Status | What | Notes |
|----|--------|------|-------|
| DC11 | ⬜ | `POST /instances/:id/upgrade` backend endpoint | No frontend client; confirm whether to keep for future API |
| DC12 | ⬜ | Reference-element REST CRUD controller | No frontend HTTP client; entity still used internally |
| DC13 | ⬜ | `PUT /segments/:id/instances/projection-layout` | No frontend client after P5.9 grid refactor |

---

## Phase 4 — Frontend quality

### P1 (critical quality)

| ID | Status | Issue | Scope |
|----|--------|-------|-------|
| FQ1 | ⬜ | **No `takeUntilDestroyed()` anywhere** — all 8+ components with `.subscribe()` have no cleanup | Module-wide |
| FQ2 | ⬜ | `figure-canvas.component.ts` (1416 lines) — extract KonvaStageService + mode renderers | `figure-canvas/` |
| FQ3 | ⬜ | N+1 family detail loading in `TemplateListComponent` + `FigurePickerModalComponent` | `template-list/`, `figure-picker-modal/` |
| FQ4 | ⬜ | `template-list.component.html` (728 lines) — extract tab subcomponents | `template-list/` |
| FQ5 | ⬜ | `template-editor.component.ts` (817 lines) + `assignment-canvas.component.ts` (816 lines) — split | — |

### P2 (convention / nice to have)

| ID | Status | Issue | Scope |
|----|--------|-------|-------|
| FQ6 | ⬜ | Migrate 4 `@ViewChild` usages to `viewChild()` | `person-panel`, `figure-canvas`, `composition-editor`, `segment-canvas` |
| FQ7 | ⬜ | Shared drag-panel directive (duplicated in template-editor + assignment-canvas + projection-view) | Extract `FloatingPanelDragDirective` |
| FQ8 | ⬜ | Shared utils: height formatting, attendance badge, `slugify` | Extract to `utils/` |
| FQ9 | ⬜ | `effect()` / `linkedSignal()` underused — migrate `OnInit` + `OnChanges` reactive patterns | Module-wide |
| FQ10 | ⬜ | `CommonModule` import unnecessary in `projection-view` (uses `@if`/`@for` control flow) | `projection-view/` |
| FQ11 | ⬜ | Modal focus trap — add `CdkTrapFocus` to all modals | import-pinya, family-history, figure-picker, cordons-dialog, pinyes-onboarding |
| FQ12 | ⬜ | `family-history-modal` table rows only clickable with mouse — add keyboard support | `family-history-modal/` |

---

## Backend conventions (MEDIUM)

| ID | Status | Issue | File(s) |
|----|--------|-------|---------|
| BC1 | ⬜ | Missing `updatedAt` on `Rengla` entity | `rengla.entity.ts` |
| BC2 | ⬜ | Missing `updatedAt` on `InstanceNode` entity | `instance-node.entity.ts` |
| BC3 | ⬜ | Missing `createdAt`/`updatedAt` on `CompositionSlot` entity | `composition-slot.entity.ts` |
| BC4 | ⬜ | ~10 `any` usages in `node-assignment.service.ts` | `node-assignment.service.ts` |
| BC5 | ⬜ | `AvailablePersonsQuery` is an interface, not a DTO — lacks `@Type()`, `@Transform()` | `available-persons.service.ts` |
| BC6 | ⬜ | Filter DTOs missing `@Max(100)` on `limit` | figure, composition filter DTOs |
| BC7 | ⬜ | `assign()` does not check `person.isActive` | `node-assignment.service.ts` |
| BC8 | ⬜ | Default pagination limit inconsistency (25 in filters, 20 in history) | filter DTOs |

---

## Notes

- **Phase 1 completed**: 2026-06-05
- **Next**: Phase 2 (shared types) or Phase 3 (dead code) — recommend Phase 3 first to reduce surface area before migration
- Each phase should have its own feature branch and PR for reviewability
