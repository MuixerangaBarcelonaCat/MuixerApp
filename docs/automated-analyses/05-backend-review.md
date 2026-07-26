# MuixerApp — Backend Review (second pass)

> Follow-up backend audit after the fixes from [01-full-repo-audit.md](01-full-repo-audit.md) landed. Scope: `apps/api` only (the dashboard has its own documents, 02/04). Every service, controller, entity, DTO, strategy and config file was read in full; suspicious cases were verified against the current code, the dashboard's actual API usage, and — where behavior depends on Postgres semantics — against a real database. Findings continue audit 01's numbering (`BUG-`/`SM-`/…) in the same namespace, since both documents cover the same backend. Date: 2026-07-14 · Branch: `fix/audit-bugs-2` · Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🔵 Suggestion

## Index

1. [Executive summary](#0-executive-summary)
2. [Findings](#1-findings)
3. [Verified non-issues](#2-verified-non-issues)

---

## 0. Executive summary

The backend is in noticeably better shape than at the time of audit 01: the auth stack, the assignment conflict rules, the snapshot race and the sync's destructive paths are all fixed and covered by tests. This pass found **no regression in the previously-fixed findings themselves**, but it did find **one high-severity bug that is a direct side effect of the BUG-9/BUG-19 redesign** (the "sync never touches `isActive`" rule), plus a cluster of medium bugs concentrated in the paths that *copy or duplicate* domain objects (template duplicate, instance copy, save-from-instance, composition entry sync) — these paths were mostly untouched by audit 01 and share a pattern: they copy the fields someone thought of and silently drop the rest.

| Severity | Count | Codes |
| -------- | ----- | ----- |
| 🔴 High | 1 | BUG-23 |
| 🟠 Medium | 8 | BUG-24 … BUG-31 |
| 🟡 Low | 5 | BUG-32 … BUG-36 |
| 🔵 Suggestion | 2 | SM-16, SM-17 |

**Fix first:** BUG-23 (sync duplicates persons and can mis-attribute attendance — it triggers from a perfectly normal workflow), then BUG-24 (save-from-instance overwrite silently deletes template nodes), then BUG-26 (composition update can wipe all entries).

---

## 1. Findings

### 🔴 BUG-23 — Person sync multiplies duplicate persons per `legacyId` and can mis-attribute attendance

`person-sync.strategy.ts:386-399` (`upsertPerson`), `person.entity.ts:74-75`, `attendance-sync.strategy.ts:300-312` (`buildLegacyIdMap`).

The BUG-9/BUG-19 fix made the sync treat a manually-deactivated person as if their `legacyId` were new: it creates a **fresh, active person with the same `legacyId`** ("the deactivated person is left completely untouched"). `persons.legacyId` deliberately has **no unique constraint**, so after that first sync there are two rows with the same `legacyId`. From then on:

1. **The duplicates multiply.** `upsertPerson` looks the person up with `findOne({ where: { legacyId } })` — no `ORDER BY`, no `isActive` filter. With two rows present, Postgres returns an arbitrary one. If it returns the *inactive* row (planner-dependent, entirely possible), the strategy routes to `createPerson` again and creates a **third** person with the same `legacyId` — and so on, one potential new duplicate per sync run. Each duplicate also burns another alias (`deriveUniqueAlias` appends `_2`, `_3`, …), so the census fills with `Maria`, `Maria_2`, `Maria_3` all pointing at the same human.
2. **Attendance can land on the wrong person.** `AttendanceSyncStrategy.buildLegacyIdMap` does `map.set(person.legacyId, person)` over an unordered `personRepository.find()` — with duplicates, whichever row happens to come last wins. Attendance for the whole colla's events can be silently upserted onto the *deactivated* row (invisible in the default census view) instead of the active duplicate.

**Trigger:** entirely normal workflow — a tècnic deactivates someone in MuixerApp while that person is still in the legacy census, then anyone runs `/sync/persons` or `/sync/all` twice.

**Recommendation:** make the lookup deterministic and single-target. Options, roughly in order of preference:

- Scope the upsert lookup to `findOne({ where: { legacyId, isActive: true } })` — sync only ever "owns" the active row; if none exists, create one. This alone stops the multiplication (run 2 always finds the active duplicate) and is a two-line fix.
- Have `buildLegacyIdMap` prefer active persons (`filter`/order by `isActive DESC, createdAt DESC`) so attendance always attaches to the live row.
- Consider a partial unique index `ON persons (legacyId) WHERE "isActive" = true` to make the invariant ("at most one active person per legacyId") structural, mirroring the BUG-17 approach.

### 🟠 BUG-24 — `saveFromInstance('overwrite')` deletes the template's DECORATION/direction nodes and regenerates every `FigureNode.id`

`figure-template.service.ts:284-327` (`saveFromInstance`), `:404-424` (`instanceNodeToCreateDto`), `:551-598` (`syncNodes`).

Two independent defects in the overwrite path:

1. **Data loss.** The instance's nodes are filtered to `SAVEABLE_ZONES = [PINYA, BASE, TRONC]` before being handed to `syncNodes` — but `syncNodes` deletes every existing template node that isn't in the incoming list. Since the incoming list never contains DECORATION, FIGURE_DIRECTION or XICALLA_DIRECTION nodes, **every overwrite save permanently deletes the template's decoration and direction nodes** (which, per the domain model, live in `figure_nodes` alongside everything else). Saving a pinya layout back to its template destroys unrelated parts of that template.
2. **ID churn.** `instanceNodeToCreateDto` carries no `id` (and drops `originNodeId` too), so `syncNodes` classifies *all* incoming nodes as new: the entire node set is deleted and re-created with fresh UUIDs. This violates the documented invariant "**`FigureNode.id` is stable across saves (upsert by ID)**". Consequences ripple outward: every *other* snapshotted instance of the template has `InstanceNode.sourceNodeId` pointing at the now-deleted ids, so `assign()`'s sourceNodeId fallback, `bulkImport`'s `targetBySourceNodeId` matching, and `getDistribution`'s assignment-to-node mapping (see BUG-32) all silently stop matching for those instances; `originNodeId` lineage is erased.

**Recommendation:** (1) restrict `syncNodes`'s delete set to the saveable zones when called from `saveFromInstance` (or merge the incoming list with the untouched non-saveable template nodes); (2) map `id: n.sourceNodeId ?? undefined` and `originNodeId: n.originNodeId` in `instanceNodeToCreateDto`, so nodes that came from the template keep their identity and only genuinely new (ad-hoc) nodes get fresh ids.

### 🟠 BUG-25 — `duplicate()` copies nodes but not rengles → dangling `renglaId`s and broken cordons on the copy

`figure-template.service.ts:245-274`.

`duplicate()` loads the original with `relations: ['nodes']` only, and `nodeToCreateDto` copies each node's `renglaId`/`renglaPosition` verbatim. Rengles themselves are never copied. The duplicated template therefore has:

- `rengles: []` in its detail response, while its nodes still carry `renglaId`s **owned by the original template**. The template editor loads `tmpl.rengles ?? []` (`template-editor.component.ts:1032`), so the rengla panel is empty while the nodes are still grouped by invisible foreign rengles.
- `totalCordons = 0` for every instance of the duplicate (`loadTotalCordons` counts `rengles WHERE templateId = duplicate`), so the cordons-limiting UI (`numberOfCordons`) is dead for duplicated templates even though their nodes have `renglaPosition` values.
- A permanent leak: deleting the rengla in the *original* template's editor nulls `renglaId` only `WHERE templateId = :originalId` (`syncRengles`, `figure-template.service.ts:643-649`), so the duplicate's nodes keep the dangling reference forever.

Contrast with `saveFromInstance`'s `new_version` path (`:357-380`), which copies rengles with fresh UUIDs and remaps `renglaId` — that's the correct pattern. **Recommendation:** do the same in `duplicate()` (load `relations: ['nodes', 'rengles']`, copy rengles with new ids, remap node `renglaId`s). Consider a follow-up data fix for already-duplicated templates.

### 🟠 BUG-26 — `CompositionService.syncEntries`: delete-then-recreate without a transaction → entry wipe on any failure

`composition.service.ts:183-209`.

`syncEntries` first executes `entryRepository.delete({ composition: { id } })`, then loops over the incoming DTOs resolving each `figureTemplateId` with `findOne` — throwing `NotFoundException` if any is missing — and only saves the new entries at the end. The delete is not in a transaction with the inserts, so:

- `PUT /compositions/:id` with one stale/invalid `figureTemplateId` (e.g. the template was deleted in another tab) **permanently deletes every existing entry** of the composition and returns 404 — the user's composition is now empty.
- Any transient DB error mid-loop leaves the same wiped state. `create()` and `duplicate()` share the path (lower stakes — the composition is new — but `duplicate()` can still produce a half-copied composition).

This is the same class as audit 01's SM-11/BUG-13 (multi-step writes without a transaction), in a file those fixes didn't touch. **Recommendation:** wrap `syncEntries` in `dataSource.transaction(...)`, and resolve all templates *before* deleting anything (one `findBy({ id: In(...) })` + count check, like `PersonService.findPositionsOrThrow`).

### 🟠 BUG-27 — `updateUser` re-linking a person leaves the old person's `managedBy` pointing at the user

`user.service.ts:342-369`.

`User.person` (`users.person_id`) and `Person.managedBy` are two independent FK columns that every link path keeps in lockstep — except one. When `PATCH /users/:id` changes `personId` from person A to person B, the code sets `user.person = B` and `B.managedBy = user`, but **never clears `A.managedBy`** (the `personId === null` branch does clear it, the reassignment branch doesn't). Afterwards:

- Person A still shows the user as their manager (person detail, `PersonResponseDto.managedBy`, and the profile email resolution from BUG-7 all read `managedBy`).
- Person A can never be linked to another user: the guard `person.managedBy && person.managedBy.id !== userId` in both `createUser` and `updateUser` rejects with "Person is already linked to another user", and `createWithInvite` rejects with "Person is already managed by an user". The only escape is manually editing person A (`PATCH /persons/:id` with `managedById: null`) — if the operator knows to do that.

**Recommendation:** in the reassignment branch, when `user.person` exists and differs from the new person, null out the old person's `managedBy` in the same operation (and ideally wrap the whole personId branch in a transaction — it's 2–3 dependent writes).

### 🟠 BUG-28 — Expired invites permanently strand accounts: no resend path exists

`user.service.ts:162-179` (`sendInvite`), `user.controller.ts` (no route), dashboard `person.service.ts:48` (only caller of `create-with-invite`).

`sendInvite` sets a 72-hour `inviteExpiresAt`. If the member doesn't accept in time:

- `acceptInvite` correctly rejects the token (401).
- `POST /users/create-with-invite` for the same person now returns 409 ("A user with this email already exists").
- `UserService.sendInvite` — which would regenerate the token and works fine for exactly this case (`isActive` is still false) — is **not exposed by any controller route**, and the dashboard has no resend action.

Net effect: an invite that expires (or an invite email that never arrives — the mailer is still the SEC-6 stub) leaves the account permanently un-activatable through the product. The only workaround is deleting rows in SQL. **Recommendation:** add `POST /users/:id/resend-invite` (ADMIN/TECHNICAL) that calls the existing `sendInvite`, and surface it in the user list for users with `isActive: false` + credentials-less accounts.

### 🟠 BUG-29 — Two divergent `attendanceSummary` formulas: any manual attendance edit zeroes `lateCancel`

`attendance.service.ts:193-225` vs `attendance-sync.strategy.ts:337-367`.

The sync's `recalculateSummary` computes `lateCancel` (NO_VAIG responses within 6h of event start) and the dashboard displays it ("Baixes tardanes" row in `event-detail.component.ts:442`, shown for past events). `AttendanceService.recalculateSummary` — which runs on **every** manual attendance create/update/delete — hardcodes `lateCancel: 0`. One manual correction to a past event's attendance list silently erases the late-cancel statistic for that event until the next sync.

Secondary divergence in the same pair: the manual path acquires the pessimistic event-row lock added in ARCH-8, the sync path doesn't (it does a plain read + `update`). Sync-vs-manual concurrency can therefore still produce the stale-overwrite the lock was added to prevent (low likelihood, but the lock's guarantee is incomplete as long as one writer bypasses it).

This is the same "one concept, two formulas" class as BUG-12. **Recommendation:** extract a single summary computation (taking an `EntityManager` + the event, computing `lateCancel` from `getEventStartMs`) used by both call sites, with the lock inside.

### 🟠 BUG-30 — Copying a figure instance drops `figureMode`, `numberOfCordons` and `cordonsObertsEnabled`

`figure-instance.service.ts:193-227` (`copy`).

The user-facing "Copiar figura al segment" action (`segment-manager.component.ts:391-415`) calls this endpoint. `copy()` creates the new instance from `segment`, `figureTemplate`, `label` and a computed `sortOrder` — nothing else. A REMAT figure limited to 3 cordons with cordons oberts disabled is copied as a default COMPLETA instance with every cordon enabled. Compare `applyComposition` (`:582-604`), which carries `figureMode`/`numberOfCordons`/`cordonsObertsEnabled` (and the projection fields) from composition entries — the copy path predates those fields and was never extended. Not copying *assignments* is plausibly intentional (there's bulk import for that); not copying the figure's configuration is not. **Recommendation:** copy the three mode/cordons fields (and decide explicitly about the projection/tronc-panel fields — the target segment has its own distribution, so leaving those null is defensible; say so in a comment).

### 🟠 BUG-31 — Email matching is case-sensitive and inconsistently normalized across auth, user CRUD and sync

`person-sync.strategy.ts:228-234` (lowercases), `user.service.ts` `createUser`/`createWithInvite`/`updateUser` and `auth.service.ts:50-54` `validateUser` (all exact-match, no normalization), `user.entity.ts:20-21` (case-sensitive unique).

The legacy sync normalizes emails to lowercase before looking up/creating users; every manual path stores and compares emails exactly as typed. Two concrete failure modes:

1. An admin invites `Maria@Gmail.com` (stored mixed-case). The next person sync sees `maria@gmail.com` in the legacy census, finds no user (exact match), and creates a **second user row** for the same mailbox — the case-sensitive unique constraint doesn't stop it. `updatePerson` then re-points the person's `managedBy` to the new credential-less stub (the "legacy email always wins" rule from BUG-21), silently orphaning the invited account.
2. A user created with a mixed-case email can only log in by reproducing the exact casing — `validateUser` compares verbatim.

**Recommendation:** normalize to lowercase at the DTO boundary (a `@Transform(({ value }) => value?.toLowerCase())` on every email field: login, create-user, create-with-invite, update-user, setup) and add a one-off migration lowercasing existing rows (with a manual-resolution check for case-variant duplicates). The sync side is already correct.

### 🟡 BUG-32 — Segment distribution reads live template nodes for snapshotted instances

`figure-instance.service.ts:348-438` (`getDistribution`).

The distribution endpoint builds its canvas from `figureTemplate.nodes` unconditionally and maps assignments onto them via `inode."sourceNodeId" AS "figureNodeId"`. For snapshotted instances this violates the documented lifecycle ("post-snapshot — canvas reads InstanceNodes; template changes do NOT affect the instance"):

- Template edits made *after* the snapshot (moved/renamed/deleted nodes) change what the distribution view shows for historical instances, while the assignment workspace and projection views (which correctly read `InstanceNode`s) show the frozen layout — the two views disagree.
- Ad-hoc instance nodes have `sourceNodeId = null`, so their assignments come back with `figureNodeId: null` and their aliases silently never render in the distribution canvas.
- Combined with BUG-24, a single overwrite-save of the template blanks *every* assignment overlay in the distribution view for all previously-snapshotted instances.

**Recommendation:** for snapshotted instances, source the node list from `instance_nodes` (mapping ids consistently); keep the template path only for pre-snapshot instances — the same dual-source logic `getInstanceNodes` already implements.

### 🟡 BUG-33 — `setupUser` links `user.person` but never `person.managedBy`

`auth.service.ts:218-235`. Every other link path (`createUser`, `createWithInvite`, `updateUser`, person sync) sets both sides of the user↔person pair; the bootstrap path only sets `users.person_id`. The bootstrap admin's person consequently has no `managedBy`: their profile's `person.email` is `null` (the exact symptom BUG-7 fixed elsewhere), the person list shows them unmanaged, and linking that person to a *different* user later is not blocked by the `managedBy` guards (inconsistent with the intended invariant). One-line fix inside the existing transaction.

### 🟡 BUG-34 — `positionId` query param not validated as UUID → 500 instead of 400

`available-persons-query.dto.ts` declares `positionId` with `@IsString()` (unlike every other id in the codebase, which uses `@IsUUID`/`ParseUUIDPipe`). A malformed value reaches `sub_position.id = :positionId` and Postgres rejects it with `invalid input syntax for type uuid` — an unhandled 500 on `GET /events/:eventId/segments/:segmentId/available-persons?positionId=x`. Same class as BUG-3/BUG-8's sortBy issues. Change to `@IsUUID('4')`.

### 🟡 BUG-35 — `updateCordons`: save + assignment deletions run as three separate non-atomic steps

`node-assignment.service.ts:1110-1142`. The instance save, `removeAssignmentsBeyondCordons` and `removeCordoObertAssignments` each run independently. A failure after the save leaves the cordons reduced while assignments beyond the new limit still exist — precisely the "hidden assignment silently lingers and reappears when cordons are raised again" state the deletion helpers document themselves as preventing. Minor additional waste: the beyond-cordons scan runs on every call where `numberOfCordons` is non-null, even when the request only toggled `cordonsObertsEnabled`. Wrap the three writes in one `dataSource.transaction` (the helpers already fit the pattern used by BUG-13's fix) and scope the scan to when `numberOfCordons` actually changed.

### 🟡 BUG-36 — `bulkImport` is not resumable for ad-hoc assignments

`node-assignment.service.ts:1048-1102`. The ad-hoc idempotency guard (`existingOriginIds.has(sourceAdHoc.id) → continue`) skips both the node clone **and** the assignment clone. If a previous import run cloned the node but died (or failed) before assigning the person, a retry skips the entry entirely — the person is never assigned, with no conflict reported. This contradicts the "naturally resumable, retried entries come back as harmless conflicts" property ARCH-8's investigation relied on, which holds for template nodes but not ad-hoc ones. Fix: when the clone already exists, still attempt the assignment against the existing clone (the `assign()` conflict checks make it idempotent).

### 🔵 SM-16 — `User.person` declares a nonexistent inverse side

`user.entity.ts`: `@OneToOne('Person', 'user')` — `Person` has no `user` property (the reverse concept is `managedBy`, a different relation). TypeORM tolerates it today because only the owning side is ever traversed, but the metadata is a lie waiting for the first `person.user` traversal or schema tooling pass. Either drop the inverse-side argument (`@OneToOne('Person')`) or add the real inverse property.

### 🔵 SM-17 — `%`/`_` are not escaped in user-supplied LIKE patterns

All list searches (`person.service.ts:60-65`, `user.service.ts:95-105`, `event.service.ts:75-80`, `figure-template.service.ts:111-115`, `available-persons.service.ts:88-99`, `composition.service.ts:85-87`) interpolate the raw search string into `%…%` patterns; `suggestVersionName` does the same for template names. Parameterization makes this safe from injection, but a search containing `%` or `_` matches unintended rows (and a name like `100%` in `suggestVersionName` over-matches). Escape the three LIKE metacharacters in one shared helper if it ever bothers anyone — cosmetic at this scale.

---

## 2. Verified non-issues

Things that looked suspicious during the pass and were explicitly checked rather than reported:

- **Deleting an instance/segment/event with assignments (FK cascade vs RESTRICT).** `node_assignments.instanceNodeId` is `ON DELETE RESTRICT` while both `…figureInstanceId` FKs cascade, which is order-dependent on paper. Tested empirically against the dev Postgres (insert full chain, `DELETE FROM figure_instances`, rollback): the delete succeeds — Postgres resolves the multi-path cascade correctly. No bug.
- **Refresh-cookie `secure` flag requires `NODE_ENV=production`** (`auth.controller.ts:58-70`): looked like it could defeat SEC-18's `COOKIE_SECURE=true` procedure in pre, but `DEPLOY_PRE.md` pins pre to `NODE_ENV=production`, so the flag combination works as documented.
- **`getTroncView` only returns snapshotted instances** — intentional per its docstring and its consumer (segment-manager summary), which treats missing instances as "no tronc data yet".
- **Season `date` columns and `.toString().slice(0, 10)`** (`season.service.ts:111-112`): safe — `type: 'date'` columns come back from the pg driver as `YYYY-MM-DD` strings, so the slice is an identity operation, not a mangled `Date#toString`.
- **`GET /compositions/:id` returns entries unordered** — the composition editor sorts by `sortOrder` client-side (`composition-editor.component.ts:325`), and `applyComposition` orders server-side; no observable misbehavior.
- **Duplicate `isSyncing` flags inside sync strategies** — redundant with `SyncLockService` but harmless (belt-and-suspenders, correctly reset in `finally`).
- **`getCount()` after `skip`/`take`** (`composition.service.ts:89`): TypeORM's `getCount` ignores pagination clauses; totals are correct.
