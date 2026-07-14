# Cordons Oberts Toggle — Spec

> **Status:** Draft
> **Created:** 2026-07-13
> **Branch prefix:** `feat/cordons-oberts-toggle`

## 1. Executive Summary

Add a "Cordons oberts" checkbox next to the existing number-of-cordons selector, in both the Distribució tab (`SegmentWorkspaceComponent`) and the composition editor. It controls whether `cordo-obert` (open-cord) PINYA nodes are shown/usable for a given figure instance / composition entry.

- **On (default):** current behaviour, except unassigned `cordo-obert` nodes are rendered at full opacity instead of semi-transparent.
- **Off:** `cordo-obert` nodes are hidden entirely for that figure. If any were assigned, disabling requires user confirmation (showing how many assignments will be removed) and removes those assignments on confirm.

The "needed people" counts shown in the event view's segment list (pinya mode) must respect this flag: when disabled, `cordo-obert` nodes must not count toward capacity.

### Why this shape

Per the existing convention in this codebase (`numberOfCordons`), the natural home for this new setting is right next to it:
- Pre-snapshot / composition editor → `CompositionEntry.numberOfCordons` sibling column.
- Post-snapshot / segment instance → `FigureInstance.numberOfCordons` sibling column, updated through the same `PATCH /figure-instances/:instanceId/cordons` endpoint.

This mirrors a previously-removed `allowsCordoObert` rengla-level flag (dropped in `1781500000000-DropCordonsColumns.ts`) but is scoped differently: **per figure instance / composition entry**, not per rengla, since the ask is "on or off for this pinya," not per-cordon-row.

---

## 2. Data Model Changes

### 2.1 New migration

Add nullable boolean column, default `true`, to both tables (mirrors `1781600000000-AddNumberOfCordons.ts`):

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `figure_instances` | `cordonsObertsEnabled` | `boolean` | `true` | Post-snapshot; NULL treated as `true` for legacy rows if migration doesn't backfill |
| `composition_entries` | `cordonsObertsEnabled` | `boolean` | `true` | Pre-snapshot per-slot override |

Set `NOT NULL DEFAULT true` directly (no need for nullable tri-state — unlike `numberOfCordons`, "all cordons visible" doesn't need a NULL sentinel here, every instance either has the toggle on or off).

### 2.2 Entities

- `apps/api/src/modules/event-segment/entities/figure-instance.entity.ts` — add `cordonsObertsEnabled: boolean` column next to `numberOfCordons` (line ~46-48).
- `apps/api/src/modules/composition/entities/composition-entry.entity.ts` — add `cordonsObertsEnabled: boolean` column next to `numberOfCordons` (line ~46-47).

### 2.3 Propagation on composition apply

`FigureInstanceService.applyComposition` (`apps/api/src/modules/event-segment/figure-instance.service.ts:613`) already copies `numberOfCordons` from `CompositionEntry` into the new `FigureInstance`; add `cordonsObertsEnabled` to that same copy.

---

## 3. Determining "figure has any cordo-obert nodes"

The checkbox must only render if the figure has at least one `cordo-obert` node. This needs to be computed wherever the checkbox is shown:

- **Distribució tab:** the instance's nodes are already loaded (template `figure_nodes` pre-snapshot, or `instance_nodes` post-snapshot) by `SegmentWorkspaceStateService` / the canvas data pipeline. Derive a `hasCordoObertNodes` computed signal per instance: `nodes.some(n => n.positionType === 'cordo-obert')`.
- **Composition editor:** similarly derive from the selected `FigureTemplate`'s `figure_nodes` (compositions are always pre-snapshot, so there's no instance-node variant here).

No backend changes needed for this check — it's derived client-side from data already fetched. (Optionally the backend segment/composition DTOs could expose a precomputed `hasCordoObertNodes` boolean per instance/entry to avoid re-deriving from raw node arrays in multiple places — recommended if the node list isn't already available where the checkbox lives, e.g. in a compact segment list row.)

---

## 4. Backend — persistence endpoints

### 4.1 Distribució tab / `FigureInstance`

Extend existing endpoint rather than adding a new one:

```
PATCH /figure-instances/:instanceId/cordons
```

- `UpdateInstanceCordonsDto` (`apps/api/src/modules/node-assignment/dto/update-instance-cordons.dto.ts`) — add optional `cordonsObertsEnabled?: boolean`.
- `NodeAssignmentService.updateCordons` (`apps/api/src/modules/node-assignment/node-assignment.service.ts:1030-1054`):
  - Keep existing `checkEventLock` guard.
  - If `dto.cordonsObertsEnabled !== undefined`, set `instance.cordonsObertsEnabled = dto.cordonsObertsEnabled`.
  - After saving, if it was just turned `false` (transition `true → false`), call a new `removeCordoObertAssignments(instanceId)` (see 4.3). Do this regardless of `numberOfCordons`, independent of the existing `removeAssignmentsBeyondCordons` call.
  - Return the removed-assignment count in the response so the frontend can show a confirmation summary retroactively if needed — but see §6, confirmation should happen **before** the call, by having the frontend query first (see 4.2).

### 4.2 New read endpoint for confirmation count

To let the frontend show "X assignments will be removed" *before* committing, add a lightweight count check. Options:
- (a) Frontend already has the assignments loaded in state (`AssignmentStateService.assignments`) and the instance nodes with `positionType === 'cordo-obert'` — it can compute the count purely client-side by filtering current assignment state, no new endpoint needed. **Preferred** — this mirrors how `distribucio-tab.component.ts:194-213` (`countAssignmentsBeyondCordons`) already does this client-side for the numberOfCordons case.
- (b) If assignment state isn't reliably in sync client-side, add `GET /figure-instances/:instanceId/cordons/impact?cordonsObertsEnabled=false` returning `{ affectedCount: number }`.

Go with (a) for consistency with the existing pattern; only fall back to (b) if the client-side assignment list proves unreliable during implementation.

### 4.3 Bulk removal method

New private method in `NodeAssignmentService`, analogous to `removeAssignmentsBeyondCordons` (`node-assignment.service.ts:1030-1085`) but with **inverted** filter — target only `cordo-obert` nodes instead of excluding them:

```ts
private async removeCordoObertAssignments(instanceId: string): Promise<number> {
  const nodes = await this.instanceNodeRepository.find({
    where: { figureInstance: { id: instanceId } },
  });
  const cordoObertNodeIds = nodes
    .filter(n => n.positionType === 'cordo-obert')
    .map(n => n.id);
  if (cordoObertNodeIds.length === 0) return 0;

  const assignments = await this.assignmentRepository.find({
    where: { figureInstance: { id: instanceId }, instanceNode: { id: In(cordoObertNodeIds) } },
    relations: ['instanceNode'],
  });
  if (assignments.length === 0) return 0;

  await this.assignmentRepository.remove(assignments);
  return assignments.length;
}
```

Note: if the instance isn't snapshotted yet (`instance.snapshotted === false`), there are no `InstanceNode`/assignment rows to remove — `updateCordons` already operates post-snapshot implicitly since assignment endpoints trigger snapshotting on first assign; toggling cordons-oberts off with zero assignments on an unsnapshotted instance is a no-op removal (fine, matches `removeAssignmentsBeyondCordons`'s existing behaviour for `numberOfCordons`).

### 4.4 Composition editor / `CompositionEntry`

`CompositionEntry` has no assignments (compositions are templates of instances, not instances themselves), so toggling `cordonsObertsEnabled` there is a plain field update with no removal side-effects — extend whatever DTO/endpoint `updateNumberOfCordons` already uses (`composition-editor.component.ts:217-219` → composition update DTO) with the new field, patched the same way `numberOfCordons` is.

---

## 5. Backend — "needed people" capacity calculation

Two places currently compute PINYA capacity without excluding `cordo-obert` nodes:

1. `EventSegmentService.loadPinyaCapacities` (`apps/api/src/modules/event-segment/event-segment.service.ts:254-292`) — segment list, pinya mode. Query currently:
   ```sql
   WHERE fn.zone IN ('PINYA')
   AND (fi."numberOfCordons" IS NULL OR r."sortOrder" IS NULL OR r."sortOrder" <= fi."numberOfCordons")
   ```
   Add: `AND (fi."cordonsObertsEnabled" = true OR fn."positionType" != 'cordo-obert')` — i.e. exclude `cordo-obert` nodes when the flag is off, count them when on (this also matches "on" behaviour becoming visually non-transparent but otherwise unchanged).

2. `FigureInstanceService.findOneById` (`apps/api/src/modules/event-segment/figure-instance.service.ts:471-554`, capacity logic ~500-519) — single-instance fetch, same `zone IN ('PINYA', 'BASE')` pattern. Apply the same `cordonsObertsEnabled` condition to the PINYA branch (BASE nodes are unaffected — `cordo-obert` never applies to BASE).

Both queries branch on `snapshotted` to hit `figure_nodes`/`figure_templates` vs `instance_nodes`/`instance_nodes.figureInstance` — the new condition needs to reference `fi."cordonsObertsEnabled"` (the `FigureInstance` alias already joined in both branches) and `positionType` from whichever node table alias is active in that branch.

---

## 6. Frontend

### 6.1 Shared checkbox UI

Add the checkbox to `FigurePropertiesPanelComponent` (`apps/dashboard/src/app/features/pinyes/components/figure-properties-panel/`) next to the existing cordons stepper, since both the Distribució tab and composition editor already reuse this component for the stepper — the natural place to add the paired control:

- New `input<boolean>()` — `cordonsObertsEnabled`
- New `input<boolean>()` — `hasCordoObertNodes` (controls visibility; component hides the checkbox entirely when `false`)
- New `output<{ id: string; value: boolean }>()` — `cordonsObertsEnabledChanged`
- Checkbox label per language convention (Catalan UI text): "Cordons oberts"

### 6.2 Distribució tab

`distribucio-tab.component.ts`:
- Add `onCordonsObertsEnabledChanged(id, value)` mirroring `onNumberOfCordonsChanged` (line 166):
  - If `value === false`: compute affected assignment count client-side (filter `AssignmentStateService.assignments` for this instance where the target `InstanceNode.positionType === 'cordo-obert'`).
    - If count > 0: show confirm dialog (reuse `app-confirm-dialog`) — "Es desactivaran N assignacions de cordons oberts. Vols continuar?" (exact copy per `language-rules` skill — Catalan, concise, matching existing confirm-dialog phrasing conventions in this component for the numberOfCordons case).
    - On confirm (or if count === 0): call `applyCordonsObertsChange(id, false)`.
    - On cancel: revert checkbox UI state (no-op).
  - If `value === true`: no confirmation needed, call directly.
- `applyCordonsObertsChange` calls `NodeAssignmentService.updateCordons(id, { cordonsObertsEnabled: value })`, then reloads distribution state (same reload path as `applyCordonsChange`, line 186).
- Template (`distribucio-tab.component.html`): pass `[hasCordoObertNodes]` and `[cordonsObertsEnabled]` bindings, listen for `(cordonsObertsEnabledChanged)`.
- Change `[cordoObertOpacity]="0.5"` (line 18) to a bound expression: `instance.cordonsObertsEnabled ? 1 : 0.5` — wait, re-read requirement: when **on**, no longer show semi-transparent (full opacity `1`); the "off" state hides the nodes entirely rather than dimming them, so opacity is moot there. So: `[cordoObertOpacity]="1"` unconditionally once this ships (the opacity dimming behaviour is fully retired for the "on" case, and "off" is handled by filtering nodes out of the render list, not by opacity — see 6.4).

### 6.3 Composition editor

`composition-editor.component.ts`:
- Add `updateCordonsObertsEnabled(id, value)` mirroring `updateNumberOfCordons` (line 217-219) — local signal update + `performSave()`.
- `buildEntriesPayload()` (line 297-310): include `cordonsObertsEnabled: e.cordonsObertsEnabled ?? true`.
- No confirmation dialog needed here (no assignments exist at composition level).
- Template (`composition-editor.component.html`): same panel bindings as 6.2; opacity line 103 gets the same `[cordoObertOpacity]="1"` treatment.

### 6.4 Hiding cordo-obert nodes when disabled

`FigureCanvasComponent` (`apps/dashboard/src/app/features/pinyes/components/figure-canvas/figure-canvas.component.ts`) currently renders all nodes and only varies opacity (line ~1002). For the "off" behaviour (hide entirely, not just dim), filter `cordo-obert` nodes out of the render list before they reach Konva, rather than adding another opacity branch:
- Add an `input<boolean>()` — `cordonsObertsEnabled` (default `true`) to `FigureCanvasComponent`.
- In the node-list computation feeding the Konva layer, skip nodes where `positionType === 'cordo-obert' && !cordonsObertsEnabled()`.
- Remove the `cordoObertOpacity` conditional dimming for the "on" case (per 6.2/6.3, callers now always pass full opacity for unassigned cordo-obert nodes) — evaluate whether `cordoObertOpacity` input can be deleted entirely once both call sites stop varying it, or kept for potential future use elsewhere (`ProjectionViewComponent`/`cordo-obert.util.ts` positioning logic should be checked for any remaining consumers before removal).
- `ProjectionViewComponent` (`apps/dashboard/src/app/features/pinyes/components/projection-view/projection-view.component.ts:492-503`, `repositionCordoObertNodes`) must also skip repositioning/rendering `cordo-obert` nodes when the instance's `cordonsObertsEnabled` is `false`, for consistency during actual projection.

### 6.5 Segment list ("pinya mode") needed-people display

`segment.model.ts` and segment-manager components already consume `pinyaCapacity`/`assignedCount` computed server-side (§5) — once the backend query excludes disabled cordo-obert nodes, no frontend calculation changes are needed here; verify the DTOs already round-trip `cordonsObertsEnabled` if the frontend needs to display/reason about it directly (likely not required — the capacity number is enough).

---

## 7. Migration / rollout notes

- Existing instances/entries get `cordonsObertsEnabled = true` by default (matches "off by default" NOT being the ask — spec says default **on**).
- No backfill logic needed beyond the column default, since `true` reproduces current behaviour (all cordo-obert nodes visible/assignable) minus the opacity dimming cosmetic change.
- No data loss risk on rollout: nothing is deleted until a user explicitly toggles the checkbox off and confirms.

---

## 8. Testing checklist

**Backend (Jest, co-located `.spec.ts`):**
- `NodeAssignmentService.updateCordons` — toggling `cordonsObertsEnabled` off removes only `cordo-obert` assignments, leaves others untouched (mirror existing `removeAssignmentsBeyondCordons` spec at `node-assignment.service.spec.ts:1942-1984`).
- Toggling off with zero cordo-obert assignments is a no-op (no error, count 0).
- Toggling on/off respects `checkEventLock`.
- `EventSegmentService.loadPinyaCapacities` — capacity excludes cordo-obert nodes when disabled, includes them when enabled, for both snapshotted and non-snapshotted instances.
- `FigureInstanceService.findOneById` — same capacity check, single-instance path.
- `FigureInstanceService.applyComposition` — copies `cordonsObertsEnabled` from `CompositionEntry` to new `FigureInstance`.

**Frontend (Vitest):**
- `distribucio-tab.component.spec.ts` — checkbox hidden when figure has no cordo-obert nodes; confirm dialog appears only when disabling with existing assignments; confirm dialog shows correct count; cancel leaves state untouched.
- `composition-editor.component.spec.ts` — checkbox persists via `performSave()`, no confirm dialog.
- `figure-canvas.component.spec.ts` — cordo-obert nodes excluded from render when `cordonsObertsEnabled=false`; full opacity when `true`.

**Manual verification (per project convention — start dev server, exercise the golden path):**
- Toggle on/off in Distribució tab with and without existing cordo-obert assignments.
- Toggle in composition editor, apply composition to a segment, confirm instance inherits the flag.
- Confirm segment list "needed people" count changes when toggling off in a segment with assigned cordo-obert positions.
