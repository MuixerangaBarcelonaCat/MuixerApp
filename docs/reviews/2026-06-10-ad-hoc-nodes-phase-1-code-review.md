# Code Review — Ad-Hoc Instance Nodes (Phase 1)

> **Date:** 2026-06-10
> **Branch:** `feat/assignar-nodes-nous` (uncommitted working tree)
> **Spec:** [`docs/specs/2026-06-10-ad-hoc-instance-nodes-design.md`](../specs/2026-06-10-ad-hoc-instance-nodes-design.md)
> **Plan:** [`docs/specs/plans/ad-hoc-nodes-phase-1-plan.md`](../specs/plans/ad-hoc-nodes-phase-1-plan.md)
> **Scope reviewed:** 16 modified/new files (API + dashboard + shared + migration)
> **Backend tests:** 76/76 passing (`node-assignment.service.spec.ts`)

---

## Executive summary

The backend slice (T1–T7) is solid: well-guarded endpoints, correct 403/404 semantics, event-lock enforcement, snapshot isolation respected, and good unit test coverage. The frontend is **partially implemented**: placement, creation, and keyboard deletion work, but **move/resize/rotate of ad-hoc nodes is non-functional** (outputs declared but never emitted from the Konva canvas) and ad-hoc nodes have **no visual distinction** — both promised by the help modal shipped in this same change. Two state-consistency bugs and one bulk-import idempotency issue should be fixed before merge.

| Severity | Count |
|----------|-------|
| High | 3 |
| Medium | 5 |
| Low | 5 |

---

## High severity

### H1 — Ad-hoc move/resize/rotate is dead code; no dashed-stroke rendering (T11/T12 incomplete)

`figure-canvas.component.ts` declares the new outputs but **never emits them**:

```130:132:apps/dashboard/src/app/features/pinyes/components/figure-canvas/figure-canvas.component.ts
  readonly canvasClicked = output<{ x: number; y: number }>();
  readonly adHocNodeMoved = output<{ nodeId: string; x: number; y: number }>();
  readonly adHocNodeTransformed = output<{ nodeId: string; x: number; y: number; width: number; height: number; rotation: number }>();
```

The only canvas change is the placement-click handler. There is no code that:

- renders ad-hoc nodes with `dash: [6, 3]` (the only `dash` usages belong to composition slots),
- sets `draggable: true` for ad-hoc nodes in assignment mode,
- attaches a `Transformer` on double-click,
- emits `adHocNodeMoved` / `adHocNodeTransformed`.

Consequences:

- `onAdHocNodeMoved()` and `onAdHocNodeTransformed()` in `AssignmentCanvasComponent` are unreachable.
- The help modal shipped in this change documents *"Moure: arrossega el node"* and *"Redimensionar/rotar: doble clic"* — *features that do not exist*. Users cannot reposition a misplaced node; their only option is delete + recreate.
- Ad-hoc nodes are visually indistinguishable from template nodes (help modal claims "vora discontínua").
- Manual tests #3 (dashed border), #5, #6, #21, #22 of the plan checklist will fail.

**Action:** implement T11 in `renderAssignmentNodes()` (dashed stroke + draggable + transformer + emissions), or descope move/resize from Phase 1 *and* remove the corresponding help-modal claims and dead handlers.

### H2 — `AssignmentStateService.activeTabNodes` goes stale after create/delete/import

`activeTabNodes` is only set inside `loadTabData()`:

```351:353:apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.ts
        if (this.state.activeInstanceId() === instanceId) {
          this.state.activeTabNodes.set(resp.data);
        }
```

But `refreshInstanceNodes()` — the path used after creating an ad-hoc node, deleting one, bulk import, and cordon changes — updates `tabs[].nodes` only and never touches `state.activeTabNodes`.

Repro: create an ad-hoc node → open the reset modal → `state.hasAdHocNodes()` is still `false` → the *"N nodes ad-hoc també s'eliminaran"* warning (the very feature it was built for) does not appear. The inverse is also true after deletions (warning shows a stale count).

**Action:** set `state.activeTabNodes` inside `refreshInstanceNodes()`, or better, derive `adHocNodes` from the existing `activeNodes()` computed and drop the duplicated signal entirely (two sources of truth for the same data is the root cause here).

### H3 — `bulkImport` clones ad-hoc nodes unconditionally → duplicates on re-import

```904:929:apps/api/src/modules/node-assignment/node-assignment.service.ts
    for (const sourceAdHoc of sourceAdHocNodes) {
      const cloned = this.instanceNodeRepository.create({
        // ... clone geometry ...
        isAdHoc: true,
        createdById: null,
      });
      const savedClone = await this.instanceNodeRepository.save(cloned);
```

Template-node assignments are protected by occupancy/conflict checks, but the ad-hoc clone step has **no idempotency guard**. Running the same import twice (a realistic flow: import, hit conflicts, fix attendance, import again) duplicates every ad-hoc node in the target. Nothing prevents N copies stacking at identical coordinates.

**Action:** skip cloning when the target already contains an ad-hoc node with the same `label` + `positionType` + coordinates (or track provenance, e.g. reuse `originNodeId` to point at the source ad-hoc node id and dedupe on it — the column is already there and set to `null`).

---

## Medium severity

### M1 — API accepts empty `label` (create and update)

`CreateAdHocNodeDto.label` is `@IsString() @MaxLength(100)` — `""` passes validation. Same for `UpdateAdHocNodeDto`. The plan's own test matrix requires *"Create comodin with empty label → 400"*. The frontend defaults to `'Comodí'`, but the API contract is unprotected (Swagger consumers, future PWA).

**Action:** add `@IsNotEmpty()` (create) and `@MinLength(1)` after trim (consider a `@Transform(({value}) => value?.trim())`).

### M2 — Silent `catch {}` when cloning ad-hoc assignments in `bulkImport`

```936:944:apps/api/src/modules/node-assignment/node-assignment.service.ts
        try {
          await this.assign(instanceId, {
            nodeId: savedClone.id,
            personId,
            compositionSlotId: undefined,
          });
        } catch {
          // Person may be unavailable in this segment; skip silently
        }
```

The template-node path records every skipped person in `conflicts[]`; the ad-hoc path swallows *all* errors (including genuine DB failures) with no trace. The user sees *"S'han clonat N nodes ad-hoc"* and has no idea assignments were dropped.

**Action:** push a `conflicts` entry (`reason: 'Could not clone ad-hoc assignment'`) like the main loop does, and only swallow `ConflictException`.

### M3 — `createAdHocNode`: auto-snapshot + insert not atomic; `sortOrder` race

The plan (T5.3) specifies snapshot + create *"in same transaction"*. The implementation runs `snapshotInstance()` (own transaction), then a separate `MAX(sortOrder)` query, then `save()`. Two concurrent creates can compute the same `sortOrder`, and a failure between snapshot and insert leaves the instance snapshotted with no node (recoverable, but inconsistent with the documented design).

**Action:** wrap in a single `dataSource.transaction()`, computing `MAX(sortOrder)` with the transaction manager.

### M4 — `resetSnapshot` counts computed outside the delete transaction

`assignmentCount` and `adHocCount` are read before the transaction starts; concurrent writes make the reported numbers wrong. Pre-existing pattern for `removedAssignments`, but this change doubles down on it. Use `manager.delete(...)` results (`affected`) inside the transaction instead.

### M5 — Frontend tests (T16) missing; dead `PendingOp` types

- No specs added for `AssignmentStateService` placement signals, FAB visibility, delete-with-confirmation flow, or reset warning — all required by the plan's DoD.
- `PendingOp.type` was extended with `'create-adhoc' | 'delete-adhoc' | 'update-adhoc'` but no code creates these ops; the optimistic-with-rollback flow from T12 was not implemented (delete is pessimistic, move is optimistic without a pending op). Either implement or revert the type extension.

---

## Low severity

### L1 — Migration: `ALTER TYPE ... ADD VALUE` inside the default migration transaction

PG16 allows it in a transaction block (values are not used in the same migration, so this works), but the plan explicitly called for `transaction: false`. Also `down()` cannot remove enum values — the migration is effectively irreversible for the enum part. Worth a comment in the migration file so the next reader doesn't have to rediscover this.

### L2 — Enum type divergence: `figure_nodes` won't get the new values

`RemoveFigureFamily1780982679300` recreated `figure_nodes` with its **own** types (`figure_nodes_zone_enum`, `figure_nodes_shape_enum`). This migration only extends `figure_zone_enum`/`node_shape_enum` (used by `instance_nodes` and `figure_templates`). Fine for Phase 1 (ad-hoc lives on `instance_nodes`), but Phase 2+ template-editor support for `DECORATION`/`ARROW`/`CIRCLE` will fail at the DB level. Track it in the Phase 2 plan.

### L3 — No bounds on `x`/`y`/`width`/`height`/`rotation`

A client can create a node at `x: 1e12` or `width: 99999` — valid per DTO, invisible on canvas, unrecoverable via UI (see H1). Consider sane `@Min`/`@Max` ranges.

### L4 — Placement click ignored over existing nodes

The placement branch only runs when `e.target === this.stage`. In placement mode, clicking on/near an existing node silently falls through to selection. A dense pinya leaves little empty stage to click. Consider checking `isPlacementMode()` before the target check.

### L5 — `createdById` exposed in every node response

`InstanceNodeResponse.createdById` is returned to all dashboard consumers but unused by the frontend. Harmless behind `TECHNICAL/ADMIN` roles, but if it stays, plan to render it (audit tooltip) — otherwise drop it from the response and keep it DB-only.

---

## What's done well

- **Security/validation:** endpoints inherit class-level `@Roles(TECHNICAL, ADMIN)`; `ParseUUIDPipe` on params; strict DTO whitelists (`@IsIn` on zone/positionType/shape, hex-color regex); `checkEventLock()` on all three mutations; Catalan user-facing error messages, English code.
- **Domain correctness:** 403 (template node) vs 404 (missing) distinction; `assertNotComposition` guard; DECORATION assign guard already in place for Phase 2; delete is transactional (unassign + delete); snapshot isolation preserved (`sourceNodeId: null` for ad-hoc).
- **Migration/entity hygiene:** correct enum type names for `instance_nodes`; FK with `ON DELETE SET NULL`; partial-friendly composite index; entity `@Index` matches the migration.
- **Backend tests:** 11 new cases covering CRUD, auto-snapshot, lock, composition guard, DECORATION guard, reset count, clone count, response mapping — all passing.

## Suggested additional backend tests

| Case | Why |
|------|-----|
| `bulkImport` twice from same source | Pins H3 once fixed (no duplicates) |
| Clone-assignment failure surfaces in `conflicts` | Pins M2 once fixed |
| Empty / whitespace-only `label` → 400 | Pins M1 (needs ValidationPipe-level test or e2e) |
| Concurrent `createAdHocNode` → distinct `sortOrder` | Pins M3 (or document accepted risk) |

---

## Definition of Done status

| DoD item | Status |
|----------|--------|
| 24 manual tests pass | ❌ #3, #5, #6, #21, #22 blocked by H1; #12 blocked by H2 |
| Backend unit tests (CRUD + edge cases) | ✅ 76/76 |
| Frontend unit tests | ❌ none added (M5) |
| No lint errors | ⚠️ not verified in this review |
| Migration clean on fresh + existing DB | ✅ by inspection (L1 caveat) |
| Bulk import backwards compatible | ✅ (with H3 idempotency caveat) |
| Shared enum change safe for consumers | ✅ dashboard; ⚠️ `figure_nodes` DB enums diverge (L2) |
| Swagger on new endpoints | ✅ `@ApiOperation` on all three |

**Verdict:** backend is merge-ready after M1–M3; frontend needs T11 (or an explicit descope) plus the H2 fix before this can ship.
