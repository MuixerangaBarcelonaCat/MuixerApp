# MuixerApp — Frontend (dashboard) Audit

> Deep audit of `apps/dashboard`: bugs, architecture, state management, error handling, UX/interface consistency, accessibility, performance, tests and API-contract drift. This document fully replaces `01-full-repo-audit.md` §5 (its frontend pass was shallow) plus the dashboard-specific findings from that report's §7 Tests. Date: 2026-07-07 · Branch: `fix/audit-01-bugs`. Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🔵 Suggestion.

## Index

1. [Executive summary](#0-executive-summary)
2. [Bugs & correctness](#1-bugs--correctness) — `FE-BUG-N`
3. [Architecture & state management](#2-architecture--state-management) — `FE-ARCH-N` (includes dead code & abandoned refactors as a subcategory)
4. [Error handling & network robustness](#3-error-handling--network-robustness) — `FE-ERR-N`
5. [UX & interface consistency](#4-ux--interface-consistency) — `FE-UX-N`
6. [Accessibility](#5-accessibility) — `FE-A11Y-N`
7. [Performance](#6-performance) — `FE-PERF-N`
8. [API contract drift](#7-api-contract-drift) — `FE-API-N`
9. [Code smells & conventions](#8-code-smells--conventions) — `FE-SM-N`
10. [UI text / language](#9-ui-text--language) — `FE-LANG-N`
11. [Tests](#10-tests) — `FE-TEST-N`
12. [Fix-first ranking](#11-fix-first-ranking)

---

## 0. Executive summary

The dashboard's foundations are genuinely modern and consistent: zoneless Angular, standalone components, signals + `OnPush` everywhere, in-memory access tokens with a shared silent-refresh observable, no `innerHTML`/`bypassSecurityTrust*`, optimistic updates with rollback in the assignment canvas, and a real shared component kit for list pages. Frontend auth guards are also genuinely well tested (`auth.guard.spec`, `role.guard.spec`) — a contrast with several of the pieces sitting right next to them (§10).

The problems live one layer up, and they cluster into four themes:

1. **The list/CRUD layer is copy-pasted, not shared.** Every list page re-implements the same ~300 lines of search-debounce/filter/sort/pagination/column-persistence orchestration with slightly diverging behavior, dead leftovers, and no request cancellation — so several pages can render stale data when responses arrive out of order (provably self-racing in the event list, which double-fetches on every load).
2. **An abandoned refactor is sitting in the tree.** Three fully-written services (~910 lines) that were clearly meant to break up the god components are referenced by nobody, alongside a half-dead `CanvasStateService`, six dead methods in the event list alone, dead signals, a dead API method that would 404 if called, and — until fixed — a full form whose data was silently thrown away on submit (FE-BUG-2 ✅).
3. **Failure paths are an afterthought.** Auth aside, error handling is per-call-site and wildly inconsistent: silent `console.error`, silent nothing, `errorMessage` signals, toasts — and one real logout-on-transient-error bug in the interceptor's retry path (FE-BUG-1 ✅). Long-lived resources (two SSE `EventSource`s) used to leak on navigation (FE-BUG-6 ✅).
4. **Destructive-action and modal UX is unsystematic.** Three different confirmation patterns coexist (inline modal / native `confirm()` / none at all); the shared `app-confirm-dialog` documented in CLAUDE.md does not exist; user deactivation has no confirmation *and no UI path back*; modals discard typed data on backdrop click, and none trap focus.

The best code in the app (the pinya assignment flow, the projection layout math, the person panel's ranked search) is also where a couple of the subtlest bugs are (incomplete undo history FE-BUG-7 ✅, stale projection filter FE-BUG-9).

**Findings by section:**


| Section                                | Code      | 🔴    | 🟠           | 🟡     | 🔵     | Total        |
| -------------------------------------- | --------- | ----- | ------------ | ------ | ------ | ------------ |
| Bugs & correctness                     | `FE-BUG`  | —     | 9 (6 ✅)      | 16     | 3      | 28 (6 ✅)     |
| Architecture & state (incl. dead code) | `FE-ARCH` | —     | 3            | 9      | 4      | 16           |
| Error handling                         | `FE-ERR`  | —     | 1            | 3      | —      | 4            |
| UX & interface consistency             | `FE-UX`   | —     | 2            | 5      | 1      | 8            |
| Accessibility                          | `FE-A11Y` | —     | 1            | 3      | 1      | 5            |
| Performance                            | `FE-PERF` | —     | 1            | 3      | —      | 4            |
| API contract drift                     | `FE-API`  | —     | 1            | 2      | —      | 3            |
| Code smells                            | `FE-SM`   | —     | —            | 5      | 2      | 7            |
| UI text                                | `FE-LANG` | —     | —            | 2      | —      | 2            |
| Tests                                  | `FE-TEST` | —     | 2            | 2      | —      | 4            |
| **Total**                              |           | **—** | **20 (6 ✅)** | **50** | **11** | **81 (6 ✅)** |


*(✅ counts reflect fixes applied so far in this branch; updated as findings are resolved.)*

---

## 1. Bugs & correctness

### 🟠✅ FE-BUG-1 — Interceptor logs the user out when a *retried* request fails for any reason — FIXED

`core/auth/interceptors/auth.interceptor.ts:31-49`. After a 401, the interceptor refreshes and retries the original request. The retry runs inside the same `switchMap` chain, and the inner `catchError` — written for *refresh* failures — catches **retry** failures too:

```ts
return authService.refresh().pipe(
  switchMap(() => next(retryReq)),        // ← a 500/404/network error here…
  catchError((refreshErr) => {
    authService.clearState();             // ← …clears the session
    router.navigate(['/login']);          // ← …and kicks the user to login
    return throwError(() => refreshErr);
  }),
);
```

Sequence: access token expires → any request 401s → refresh **succeeds** → retry hits a transient 500 (or the resource was deleted → 404) → the user's whole session is torn down and they land on `/login`, losing in-progress work (e.g. an open assignment canvas). Only refresh errors should clear state; retry errors should propagate to the caller like any first-attempt error.

**Recommendation:** split the pipeline — `catchError` scoped to `authService.refresh()` only, e.g. `refresh().pipe(catchError(clearAndRedirect), switchMap(() => next(retryReq)))`.

**Fix applied:** `catchError` (clear state + redirect to `/login`) now wraps only `authService.refresh()`, placed *before* the `switchMap` that issues the retry — so it fires solely on refresh failures. Retry failures (500, 404, network error, …) fall through untouched and propagate to the original caller, exactly like a first-attempt error; the session and any in-progress work (e.g. an open assignment canvas) survive. Covered by a new `auth.interceptor.spec.ts` (two cases: retry failure after successful refresh does not clear state/redirect; refresh failure does). Full `nx test dashboard` suite (1267/1267) and `nx lint dashboard` pass.

### 🟠✅ FE-BUG-2 — "Persona nova" collects a full form, then silently discards everything except the alias — FIXED

`persons/components/person-detail/person-detail.component.ts:198-200`:

```ts
const request$ = id
  ? this.personService.update(id, payload)
  : this.personService.createProvisional(raw.alias!);   // ← only alias survives
```

The `/persons/new` route renders the **entire** edit form — Nom and Primer cognom marked required (`*`), phone, birth date, shoulder height, colla info, positions (`person-detail.component.html:160-230`) — the user fills it in, presses "Crea", and every field except `alias` is thrown away (`createProvisional` posts `{ alias }` only). The person then loads with empty name/surname and the typed data is unrecoverable. Either the new-person form should ask only for the alias (matching what the flow actually does), or creation should chain `createProvisional` + `update` with the rest of the payload.

**Fix applied:** the new-person form now matches what the flow actually does. "Persona nova" opens a small `app-person-new-modal` (`persons/components/modals/person-new-modal.component.ts`) with just an alias input and "Crea"/"Cancel·la" buttons; on success it navigates to `/persons/:id` (the newly created person's edit panel). The `/persons/new` route and all `isNew()`-gated creation branches in `PersonDetailComponent` (the ternary above, the "Crea" button label, the conditional Cancel·la button) were removed — `PersonDetailComponent` now only ever edits an existing person, matching the route it's actually reachable from. Covered by a new `person-new-modal.component.spec.ts` (render, disabled-when-empty, cancel, success, error paths). Full `nx test dashboard` suite (1219/1219) and `nx lint dashboard` pass.

### 🟠 FE-BUG-3 — Data-table row-actions menu can act on the wrong row

`shared/components/data/data-table/data-table.component.html:146` resolves the acted-on row **by index at click time**: `items()[openActionsIndex()!]`. The menu can stay open across an items refresh (background reload, optimistic update, sort change — none close it; only Escape, window scroll and outside-click do). If `items()` changes while open, the menu silently targets whatever row now occupies that index — e.g. "Desactivar" lands on a different user. Compounded by `track $index` on the rows loop (line 56), which makes Angular reuse DOM rows positionally. Capture the row object when opening the menu (`openActionsRow = signal<T | null>`), and `track` by a stable id.

### 🟠 FE-BUG-4 — Event list double-fetches on init and races itself

`events/components/event-list/event-list.component.ts:124-132` + `260-278`: `ngOnInit` calls `loadSeasons()` **and** `loadEvents()`; `loadSeasons`' callback selects the active season and calls `loadEvents()` **again**. Every page load issues two `/events` requests with different filters (no season vs. active season), and nothing cancels the first: under latency reordering, the unfiltered response can arrive last and win — the list shows *all* seasons' events while the filter chip claims "Temporada: 2025-26". Load events only after seasons resolve (or pre-select the season synchronously), and switch these loads to a cancellable pattern (see FE-ARCH-4).

### 🟠✅ FE-BUG-5 — Deactivated users: no confirmation, no way back — FIXED

`config/components/user-list.component.ts:355-369` + `user-form-modal.component.ts:115-167`:

1. The row action **Desactivar** deactivates immediately — no confirmation (contrast: deleting a tag or season shows a confirm modal; deleting an event asks via `confirm()`).
2. There is **no UI path to reactivate**: the edit modal never sends `isActive` (the `UpdateUserPayload.isActive` field exists but no control is bound to it), and no "Activar" row action exists. Once deactivated, recovery requires a raw API call.
3. The "Desactivar" menu item still renders for already-inactive users and silently no-ops (`if (!user.isActive) return;`).

**Fix applied:** all three points fixed together.
- The row-actions menu now shows a single status-change action whose label/icon resolve per row — "Desactivar" (UserX) for active users, "Activar" (UserCheck) for inactive ones — instead of a static "Desactivar" that no-oped once already inactive (point 3). This required extending `data-table.component.ts`'s `RowAction<T>` so `label`/`icon` can be a function of the row (in addition to a plain string, kept backward compatible for every other list page) and adding an optional `hidden` predicate.
- Clicking the action no longer mutates immediately: it opens an inline confirmation modal in `user-list.component.html` (same hand-rolled `modal modal-open`/`modal-action`/`modal-backdrop` pattern already used by that file's "Assignar rol" modal — no new shared component, per reviewer feedback that a shared `app-confirm-dialog` wasn't justified for a single call site) naming the user and the consequence, with a loading state and error toast that keeps the dialog open on failure so the user can retry (point 1).
- Confirming now branches: deactivate still calls `userService.deactivate(id)`; activate calls `userService.update(id, { isActive: true })` — the field already existed on `UpdateUserPayload` and the backend (`UpdateUserDto.isActive`, `user.service.ts:338-339`) already supported it, so no API changes were needed (point 2).
- Covered by new tests in `data-table.component.spec.ts` (function-based label/icon resolution, `hidden` filtering per row) and `user-list.component.spec.ts` (dynamic label per state, opening the right confirmation direction, cancel, successful deactivate/activate updating the list and toasting, and the error-keeps-dialog-open path). Full `nx test dashboard` suite (1277/1279, 2 pre-existing skips) and `nx lint dashboard` pass. Not verified against a live login session — the local dev DB holds real legacy-synced member data and no safe throwaway ADMIN credentials were available; verification here is test-only, per the user's own call when asked.

### 🟠✅ FE-BUG-6 — Both sync screens leak their `EventSource` on navigation — FIXED

`persons/components/person-sync/person-sync.component.ts` and `events/components/event-sync/event-sync.component.ts` create an `EventSource` in `startSync()` and close it only on complete/error/cancel. **Neither component implements `OnDestroy`.** Navigating away mid-sync leaves the SSE connection open indefinitely: the browser holds the socket, `onmessage` keeps firing into a destroyed component's signals, and the server-side sync lock (audit-01 SEC-16's `SyncLockService`) stays held by a stream nobody is watching. `event-detail.component.ts` gets this right (`ngOnDestroy` → `closeSyncEventSource()`, line 377) — copy that.

**Fix applied:** both components now implement `OnDestroy` and call their existing (already-idempotent) `closeEventSource()` helper from `ngOnDestroy` — the same one-line pattern `event-detail.component.ts` already used. Covered by new `person-sync.component.spec.ts` and `event-sync.component.spec.ts` (each starts a sync against a mocked `EventSource`, destroys the fixture mid-sync, and asserts `.close()` was called). Full `nx test dashboard` suite (1269/1271, 2 pre-existing skips) and `nx lint dashboard` pass.

### 🟠✅ FE-BUG-7 — Assignment-canvas undo history is incomplete for moves and swaps — FIXED

`pinyes/components/assignment-canvas/assignment-canvas.component.ts`:

- **Move** (select assigned node → click empty node, 922-924 → `triggerUnassignThenAssign`): executes `unassign(old)` + `assign(new)`, but only the *assign* half pushes an `UndoableAction` (1088-1102). Pressing Ctrl+Z after a move **unassigns the person entirely** instead of returning them to their previous node — the user's mental "undo my move" silently drops someone from the pinya.
- **Swap** (`triggerSwap`, 1188-1224): pushes **no** undo action at all. Ctrl+Z after a swap skips it and undoes an older action — the history is out of sync with what the user did.
- Same gap for the cross-figure reassign dialog flow (`triggerReassignToNode`, 789-818).

Model moves/swaps as single composite `UndoableAction`s (undo = the inverse move/swap).

**Note:** `assignment-canvas.component.ts` no longer exists — the click-twice-to-move/swap gesture was replaced by drag-and-drop in `pinyes-tab.component.ts` and `troncs-tab.component.ts` (`SegmentWorkspaceComponent`'s Pinyes/Troncs tabs). The same modeling gap carried over into the rewrite (`triggerUnassignThenAssign` still only pushed an `ASSIGN` action; `triggerSwap`/`triggerCrossSwap` still pushed none) — fixed there instead.

**Additional discovery while fixing:** `UndoRedoService.undo()`/`.redo()` were never called anywhere in the app — no `Ctrl+Z` handler and no undo/redo button existed in the segment workspace (unlike `template-editor`, which has its own separate, working undo system). The composite-action fix below would have been unreachable without also wiring up a trigger, so that was fixed in the same pass.

**Fix applied:**

- `triggerAssign` in both tabs now accepts an optional `moveFrom: { instanceId, nodeId }`. When set (drag-drop move, or the cross-figure reassign-dialog confirm — `reassignDialog` now carries `oldNodeId`), the pushed action is a single composite `MOVE`: `undo` unassigns from the target and re-assigns to `moveFrom`; `execute` (redo) reverses that. Ids returned by each `assign`/`unassign` call are tracked in closures shared between `execute`/`undo`, the same pattern already used for the pre-existing `ASSIGN`/`UNASSIGN` actions.
- `triggerSwap` (same-figure) now pushes a `SWAP` action. The backend's swap endpoint preserves both assignment ids and only swaps the person on each (verified in `node-assignment.service.ts`'s `swap()`), so the action is its own inverse: `execute` and `undo` both just re-run the same swap call.
- `triggerCrossSwap` (cross-figure, no swap endpoint — unassign+reassign both sides) now pushes a composite `SWAP` action that tracks the current occupant id of each node across repeated undo/redo cycles, since unassign+assign mints a new id every time.
- While wiring up the first real callers of `.undo()`/`.redo()`, discovered and fixed a further gap: none of the existing actions (including the pre-existing plain `ASSIGN`/`UNASSIGN`) updated `AssignmentStateService.assignments` from within `execute`/`undo` — only the *initial* optimistic action did. Undoing would have silently mutated the backend without the canvas reflecting it. All action builders (`buildAssignAction`, `buildUnassignAction`, `buildMoveAction`, the swap closures) now update `state.assignments` themselves.
- Added `performUndo()`/`performRedo()` to both tab components, guarded by `canUndo()`/`canRedo()`/`isBusy()`/`ws.isLocked()`; wired to `Ctrl+Z` / `Ctrl+Shift+Z` (guarded the same way as existing shortcuts — ignored while typing in an input) and to new undo/redo buttons overlaid top-right of each tab's canvas.
- Covered by new specs in both `pinyes-tab.component.spec.ts` and `troncs-tab.component.spec.ts`: move undo/redo, same-figure swap undo/redo, cross-figure swap undo/redo, reassign-dialog-confirm undo (pinyes-tab only), plain assign/unassign undo/redo (state now stays in sync), keyboard shortcuts, and the locked/empty-history guards — using the real `UndoRedoService` (not mocked) so the tests exercise the actual undo/redo stack. Full `nx test dashboard` suite (1246/1246) and `nx lint dashboard` pass.

### 🟡 FE-BUG-8 — `UndoRedoService.run()`: eager `isBusy`, cold observable, lost actions

`pinyes/services/undo-redo.service.ts:94-117` (sharpens FE-ARCH-10's note on the two undo/redo implementations): `undo()` pops the stack *before* running; `run()` sets `isBusy = true` immediately but returns a **cold** observable that only executes on subscription. Any call site that treats `undo()`/`redo()` as fire-and-forget (or a future refactor that drops `.subscribe()`) loses the action from both stacks *and* leaves `isBusy` stuck `true`, disabling the undo/redo UI until `clear()` runs on tab switch. Make `run()` execute eagerly (subscribe internally, return a result observable via `shareReplay(1)`), or at least set `isBusy` only upon subscription.

### 🟡 FE-BUG-9 — Projection prev/next navigation: stale `instanceId` filter and broken back/forward

`pinyes/components/projection-view/projection-view.component.ts`. The component reads params once from `route.snapshot` (366-370) — this is FE-ARCH-11's general pattern, concretely broken here. Arrow-key navigation (`navigateSegment`, ~476) compensates manually — `router.navigate(...)` **plus** hand-rolled `this.segmentId = targetId; this.loadSegment()` — but:

1. `this.instanceId` is **not** cleared: entering from the single-figure route (`/project/:instanceId`) and pressing →/← loads the next segment but keeps filtering by an instance id that belongs to the *previous* segment (`filteredInstances`, line 87) → **blank projection** on a URL that should show all figures.
2. Browser **back/forward** after arrow navigation changes the URL but re-runs nothing (same route config → component reused, `ngOnInit` doesn't fire, no `route.params` subscription) → URL and rendered segment desync.
3. `goBack()`/Escape navigates to `/events/:eventId`, ignoring the `returnUrl` query param that `segment-manager.component.ts:559-563` explicitly passes to this route — dead parameter, inconsistent back behavior vs. the assignment canvas (which honors it).

Subscribe to `route.paramMap` (or use `withComponentInputBinding`) and drop the manual patching.

### 🟡 FE-BUG-10 — Rapid autosave on a brand-new template can create duplicates

`pinyes/components/template-editor/template-editor.component.ts:919-957`. While `templateId` is null, every autosave tick calls `create()`. The 2 s debounce collapses bursts, but nothing guards against a create still being **in flight** when the next save fires (slow network + continuous editing): the second tick still sees `templateId() === null` and creates a **second template**. The backend makes it worse by silently renaming duplicates (`"Nom 2"`, audit-01 SM-14) instead of 409ing, so the user ends up with two half-copies and the editor bound to whichever create resolved last. Guard with an in-flight flag (or queue saves through `exhaustMap`).

### 🟡 FE-BUG-11 — One payload builder, three different "empty field" semantics

`person-detail.component.ts:178-196` mixes three conventions in the same object literal:

- `birthDate: raw.birthDate || undefined` → empty string becomes *undefined* → PATCH omits it → **a birth date can never be cleared from the UI**;
- `shirtDate: raw.shirtDate || null` → empty string becomes *null* → clears correctly;
- `phone: raw.phone ?? undefined` → empty string is sent **as `''`** and stored.

Same form, three behaviors; users can clear a shirt date but not a birth date, and "cleared" phones are actually empty strings. Pick one convention (`'' → null`) for all nullable fields.

### 🟡 FE-BUG-12 — Login collapses every failure into "wrong credentials"

`auth/login/login.component.ts:40-46`: the error callback ignores the response entirely. A 429 from the auth throttle, a 5xx, a network outage, and the role-restriction 401 (MEMBER on dashboard, backend BUG-5 fix — whose message is specific) all render as *"Correu electrònic o contrasenya incorrectes."* — actively misleading for at least two of those cases (and it invites retry-hammering exactly when the user is being throttled). Branch on `err.status` (0/network, 401 credentials vs. 401 role message, 429, 5xx).

### 🟡 FE-BUG-13 — `clearFilters` desyncs the Cens/Provisionals/Tots tabs in the person list

`persons/components/person-list.component.ts:151-158`: `clearFilters()` resets `activeFilters` to `{}` (removing `isProvisional: false`) but leaves `provisionalTab` at whatever it was — the **Cens** tab stays visually active while the list now shows *everyone*, provisionals included. Reset the tab signal (or re-derive the filter from the tab) in `clearFilters`.

### 🟡 FE-BUG-14 — `EventService.syncFromLegacy()` calls a route that doesn't exist as written

`events/services/event.service.ts:46-48` POSTs to `/sync/events`; the backend's only `/sync/events` is a **GET (SSE)** route (`sync.controller.ts:39-40`). Any call would 404. It's currently called by nobody (the sync screens build `EventSource`s directly) — a dead method whose doc-comment ("via POST, no SSE") documents an API that never existed. Delete it (or implement the non-SSE trigger it promises).

### 🟡 FE-BUG-15 — Person-detail history pagination renders an impossible page size

`person-detail.component.ts:84` sets `historyLimit = 20`, but `PaginationComponent.limitOptions` is hardcoded `[25, 50, 100]` (`pagination.component.ts:76`). The `<select>` has no matching option, so it displays the first option ("25") while the actual page size is 20 — the "Per pàgina" control lies until the user touches it. Make `limitOptions` an input, or use a supported default.

### Misc corrections (grouped)

- 🟡 **FE-BUG-16 — `user-form-modal` and MEMBER users:** `roleLabels` lacks `MEMBER` (`user-form-modal.component.ts:54-57`). Editing a MEMBER (reachable by toggling the Membre role filter) shows a role radio group where *nothing* is selected (MEMBER isn't an option), and the read-only branch (`html:106`) renders an empty string for the role.
- 🟡 **FE-BUG-17 — `event-detail` sync error text:** `syncEventSource.onerror` (`event-detail.component.ts:358-364`) reports *"No tens permisos d'administrador"* whenever `readyState === CLOSED` — but CLOSED also results from plain network failures and server errors. Misdiagnosis presented as fact.
- 🟡 **FE-BUG-18 — `person-link-user-modal.component.ts:56`:** `this.results.set(res.data ?? res)` — the `?? res` arm would assign the whole envelope object as the results array; dead-wrong fallback, delete it.
- 🟡 **FE-BUG-19 — Broken link on the global-sync page:** `sync/global-sync.component.ts` links `routerLink="/persons/sync"` — but the persons route is `sync-start` (`persons.routes.ts:12`). `/persons/sync` falls through to the `:id` route, so the button opens `PersonDetailComponent` with `id="sync"`, which errors into the "person not found" state. (The other two cards, `/rehearsals/sync` and `/performances/sync`, are correct.) Nothing ever caught it because the `/sync` page itself is unreachable from any navigation surface — see FE-UX-6.
- 🔵 **FE-BUG-20 — `isEventPast` date parsing by string concatenation** (`event-list.component.ts:243-247`, duplicated as `isPast` in `event-detail.component.ts:103-108`): `new Date(\`${dateStr}T${timeStr}:00)`silently yields`Invalid Date`if the API ever returns a full ISO timestamp for`date`. Works today ('YYYY-MM-DD'), fragile tomorrow — and the logic is duplicated instead of living in` date.util.ts`.

### 🟡 FE-BUG-21 — Interceptor scopes by substring and attaches the token to *any* URL

`auth.interceptor.ts:20`: `req.url.includes('/auth/')` — substring matching to skip auth endpoints, and the Bearer header is added to **every other request regardless of host**. Today all calls go to `environment.apiUrl`, but the first integration with an external HTTP API will silently leak access tokens. Scope both checks to `req.url.startsWith(environment.apiUrl)`.

### 🟠 FE-BUG-22 — Rotation handle breaks on touch devices and can leak window listeners

`figure-canvas.component.ts:1148-1188` (`makeRotationHandle`): the handle listens on `'mousedown touchstart'`, immediately sets `slotGroup.draggable(false)`, then registers **only** `window mousemove/mouseup` listeners. On a touch device (`touchstart`) no touch-move/touch-end handlers exist, so `onUp` never fires: the rotation never happens **and the slot stays permanently un-draggable**. The projection/distribution views are exactly the screens most likely to run on a tablet. Additionally, if the component is destroyed mid-rotation, the `window` listeners are never removed (cleanup only happens in `onUp`).

### 🟡 FE-BUG-23 — `effect()` dependency omission: badges rendered from untracked signals

The assignment-mode render effect (`figure-canvas.component.ts:303-321`) tracks `nodes/assignments/attendanceMap/…` but `renderAssignmentNodes` also reads `this.personDetailsMap()` and `this.isPast()` **inside `untracked()*`*. `personDetailsMap` arrives asynchronously (built from the confirmed-persons load): if persons resolve after the assignments render, the observation badges / notes emojis / hover data are missing until some *other* tracked signal happens to change. Add them to the tracked reads (`isPast` is set once from the URL, so it's only `personDetailsMap` that bites).

### 🔵 FE-BUG-24 — Optimistic ids built from `Date.now()` collide on fast double actions

`assignment-canvas.component.ts:1044,1063`: `temp-${Date.now()}` and `op-${Date.now()}` as temporary ids for optimistic assignments/pending ops. `crypto.randomUUID()` is right there (an unused `shared/utils/uuid.util.ts` even exists).

### 🔵 FE-BUG-25 — `getContrastColor` assumes 6-digit hex

`shared/utils/color.util.ts:10`: a named color or `rgb()` value yields `NaN` luminance → always resolves to white text.

### 🟠✅ FE-BUG-26 — Template editor: pending autosave is discarded on most exits — FIXED

`template-editor.component.ts`: edits schedule a **2-second debounced autosave** (`scheduleAutosave`). The flush-before-leave logic exists only in `goBack()` (cancel timer → `save(() => navigate)`). Every other exit path — browser back, sidebar navigation, deep link, logout — goes through `ngOnDestroy`, which just `clearTimeout`s the pending save: **the last ~2 s of edits are silently lost**. There is also no `canDeactivate` guard and no `beforeunload` listener for tab-close while a save is pending or in flight. Flush in `ngOnDestroy` too (or a `CanDeactivate` guard + `beforeunload` when `saveStatus() !== 'idle'`).

**Fix applied:** added a generic `unsavedChangesGuard` (`core/guards/unsaved-changes.guard.ts`) — a functional `CanDeactivateFn` that delegates to a `canDeactivate(): Observable<boolean> | boolean` method on the leaving component, so any future editor can opt in the same way. `TemplateEditorComponent` implements it: if an autosave timer is pending, it's cleared and `save()` runs immediately, resolving the guard's `Observable<boolean>` to `true` once the request completes (success or error — consistent with the pre-existing `goBack()` behavior of not trapping the user on a save failure); with no pending timer it returns `true` synchronously. This covers **every** router-driven exit (browser back, sidebar nav, deep link away, programmatic redirects like logout) uniformly, so `goBack()` no longer needs its own ad-hoc flush and now just navigates. A `window:beforeunload` listener (`onBeforeUnload`) additionally warns the browser (`preventDefault` + `returnValue`) on tab close / hard reload while a save is pending — the one exit path a router guard can't intercept. The guard is wired onto both `templates/new` and `templates/:id/edit` in `pinyes.routes.ts`. Covered by new specs in `template-editor.component.spec.ts` (no-pending-changes passthrough, immediate flush + resolution, no double-flush, `beforeunload` prevented/not-prevented, simplified `goBack`) and `unsaved-changes.guard.spec.ts` (boolean and Observable delegation). Full `nx test dashboard` suite (1227/1227) and `nx lint dashboard` pass.

### 🟡 FE-BUG-27 — Pagination `@for` uses a duplicated track key

`pagination.component.ts:41,92-98`: `pageNumbers()` inserts the ellipsis sentinel `-1` **twice** (before and after the current window, e.g. page 5 of 10 → `[1, -1, 4, 5, 6, -1, 10]`), but the template iterates with `track p`. Duplicate track keys make Angular throw **NG0955** and fall back to degraded list reconciliation on exactly the pages where both ellipses show. Use `track $index` here (or unique sentinels).

### 🟡 FE-BUG-28 — Person search: debounce without cancellation → stale results race

`person-search-input.component.ts:37-59`: the 300 ms `setTimeout` debounce dedupes typing bursts, but once two requests are actually in flight (keystrokes >300 ms apart on a slow network) nothing cancels the first — an out-of-order response overwrites the newer results. The idiomatic fix (`Subject` + `debounceTime` + `switchMap`) removes both the manual timer and the race. Also `searchText` is a plain mutable field in an otherwise signal-based zoneless component — it works (event-driven CD) but breaks the house style. Additionally, `loading` is set *before* the debounce timer starts, so the spinner runs during the 300 ms wait even before a request exists.

---

## 2. Architecture & state management

### 🟠 FE-ARCH-1 — The list-page controller is copy-pasted five times

`person-list`, `user-list`, `event-list`, `template-list`, `composition-grid-tab` each hand-roll the same orchestration: a mutable `searchInput` field + `setTimeout` debounce, `page/limit/sortBy/sortOrder/filters` signals, `loadX()` re-fetch, chips computed, `localStorage` column persistence, `goToPage`/`onLimitChange` guards. It's ~250-300 lines per page of near-identical code that has **already diverged** (dead methods in some, `hasFilterChips` logic differing, event-list persisting columns per event-type while others don't, differing empty-state handling — see FE-ERR-1). Every new list page will copy the bugs of whichever page it was cloned from. Extract a `ListController`/composable (signals-based: `withListState({ load, defaultFilters })`) or a base class — this is the single highest-leverage frontend refactor, and it makes FE-ARCH-4 (cancellation) fixable in one place.

### 🟠 FE-ARCH-2 — Modal infrastructure doesn't exist; every modal reinvents it

CLAUDE.md instructs composing pages with `app-confirm-dialog` — **that component does not exist anywhere in the tree** (doc drift, and the missing piece explains the mess): confirmations are inline hand-rolled DaisyUI modals (tags, seasons, grant-role, user deactivation/reactivation since FE-BUG-5 ✅, figure-list-tab, cordons…) or native `window.confirm()` (`event-detail.component.ts:199`, `segment-manager.component.ts:194`, `person-detail.component.ts:223`) — still no single shared component, so each one re-implements open/close/backdrop/Escape slightly differently. Form modals (`user-form-modal`, `tag-form-modal`, `event-form-modal`, `season-form-modal`…) each re-implement open/close/backdrop/Escape with different behavior (most don't handle Escape at all; all close-and-discard on backdrop click — see FE-UX-4; none trap focus — see FE-A11Y-2). One shared `ModalComponent` + `ConfirmDialogComponent` (or the native `<dialog>.showModal()` API) would fix the whole class.

### 🟡 FE-ARCH-3 — Root singletons for per-route canvas state

`AssignmentStateService` is `providedIn: 'root'` but holds per-canvas state, relying on components calling `reset()` at the right moments; any exit path that skips `reset()` (error navigation, deep-link) leaks the previous segment's selections into the next. The same pattern affects `CanvasStateService`, shared by three different editors (template, composition, distribution — all three inject it). Grid settings persisting across editors may be a feature, but `template-editor` resets it only in the *new template* branch (`ngOnInit`, line 214), so opening an existing template inherits whatever grid/snap state the previous editor left. Provide these at the route level (`providers: [...]` on the route config) and delete the manual `reset()` protocol.

### 🟡 FE-ARCH-4 — No request cancellation or sequencing anywhere

Zero `switchMap`-style pipelines exist for user-driven loads: every filter/page/sort change fires an independent `subscribe`, and the **last response to arrive wins**, not the last request sent. Concretely reachable: fast filter toggling on any list page, `person-panel.loadPersons` (height/xicalla/tag filters), attendance tab loads, and the self-race in FE-BUG-4. The fix pairs naturally with FE-ARCH-1 (a shared list controller built on `Subject` + `debounceTime` + `switchMap` kills the hand-rolled `setTimeout` debounces too).

### 🟡 FE-ARCH-5 — `getAdultsCount` and past-event logic live in component files

`event-detail.component.ts:20` imports `getAdultsCount` **from `event-list.component*`* — a domain helper exported from a component file, coupling two routed components. The past-event cutoff (`date + startTime vs now`) is duplicated in `event-list.isEventPast`, `event-detail.isPast`, and the group separator. `shared/utils/date.util.ts` exists precisely for this.

### 🟡 FE-ARCH-6 — Sync screens are near-identical twins

`person-sync.component.ts` (154 lines) and `event-sync.component.ts` (160 lines) duplicate the whole SSE-runner state machine (state signal, events log, progress computed, EventSource wiring, cancel/reset/goBack, color mapping) with the FE-ERR-3/FE-ARCH-12 (SSE parse-safety, full reload) and FE-BUG-6 (EventSource leak) bugs duplicated in both. A shared `SyncRunnerService`/component parameterized by endpoint would fix parse-safety, cleanup and reload behavior once.

### 🔵 FE-ARCH-7 — `LayoutService` fullscreen contract is honor-system

`core/services/layout.service.ts` — a root boolean that every fullscreen consumer must remember to unset in `ngOnDestroy` (the comment admits it). Four components do this dance today. A route-data-driven layout (or a `DestroyRef`-registered helper: `layout.enterFullscreen(destroyRef)`) removes the class of "app chrome disappeared and never came back" bugs.

### 🟡 FE-ARCH-8 — God components in the pinyes feature

`figure-canvas.component.ts` (2 070 lines), `assignment-canvas.component.ts` (1 979 lines + 789-line template), `template-editor.component.ts` (1 073 lines). Some state is already extracted (`AssignmentStateService`, `template-editor-state.service`), but the components still mix Konva scene management, drag logic, API orchestration and UI state — and the extraction services that were evidently written to break this up are dead code, never wired in (FE-ARCH-13). This is where every future bug in the flagship feature will hide.

### 🟡 FE-ARCH-9 — Nested-subscribe pyramids and hand-rolled Observable wrappers

In `assignment-canvas.component.ts`: sequential flows are built by nesting `.subscribe()` inside `next:` (e.g. `refreshInstanceNodes` l. 1119→1136), and undo/redo actions re-wrap calls as `new Observable((sub) => { obs.subscribe({...}) })` — the pattern repeats 6× (l. 857, 1093, 1249, 1698, 1767, 1816). The wrapper drops unsubscription propagation and is equivalent to `obs.pipe(map(() => void 0))`. `switchMap`/`concatMap` would also give cancellation on rapid tab switching, which today relies on ad-hoc `activeInstanceId() === instanceId` guards.

### 🔵 FE-ARCH-10 — Two parallel undo/redo implementations in the same feature

The assignment canvas uses the command-based `UndoRedoService` (execute/undo observables), while the template editor ships its own snapshot-based stack (`undoStack: signal<TemplateSnapshot[]>`, `template-editor.component.ts:140-152`). Two mental models, two sets of edge cases, one feature. The `UndoRedoService.run()` cold-observable footgun this note originally flagged is tracked separately as FE-BUG-8.

### 🟡 FE-ARCH-11 — Route params read once via `snapshot`

`assignment-canvas.component.ts:349-356` (and other routed components) read `route.snapshot.params` in `ngOnInit` and never subscribe to param changes. If the router ever navigates between two segments on the same route, the component instance is reused and keeps rendering the **old** segment. FE-BUG-9 (projection prev/next) is this pattern's predicted failure, now concrete. Subscribe to `route.params`/use `input()` route bindings (`withComponentInputBinding`) instead.

### 🔵 FE-ARCH-12 — Sync completion forces a full-page reload instead of refetching

`person-sync.component.ts:126` and `event-sync.component.ts:133` both call `window.location.reload()` to refresh data after a sync completes — a full SPA reload that loses all client state (scroll position, other open tabs' worth of in-memory signals, the access token round-trips through the silent-refresh flow again) to achieve what a plain re-fetch of the affected list would do more cheaply.

### Dead code & abandoned refactors

### 🟠 FE-ARCH-13 — ~910 lines of extracted services that nothing uses

Three fully-written services are referenced by **no component, no spec, nobody**:


| File                                                                            | Lines | Purpose (per its own code)       |
| ------------------------------------------------------------------------------- | ----- | -------------------------------- |
| `pinyes/components/template-editor/services/template-editor-state.service.ts`   | 430   | Template-editor state extraction |
| `pinyes/components/assignment-canvas/services/assignment-operations.service.ts` | 266   | Assignment operations extraction |
| `pinyes/components/assignment-canvas/services/assignment-tab.service.ts`        | 214   | Tab management extraction        |


This is the FE-ARCH-8 god-component refactor, started and abandoned mid-flight. Dead code this large is actively harmful: it shows up in searches, suggests an architecture that isn't real, and silently drifts from the live logic it duplicates. Either finish the extraction (wire the components to them) or delete all three.

### 🟡 FE-ARCH-14 — `CanvasStateService` is half dead

`pinyes/services/canvas-state.service.ts`: of its six signals, only `gridEnabled`, `gridSpacing`, `snapToGrid` are ever read. `zoom`, `panOffset`, `selectedNodeId` have **no consumers** (the Konva stage keeps its own transform; each component keeps its own selection) — and `reset()` resets *only those three unused fields*, i.e. it's a no-op in practice while looking load-bearing (`template-editor.component.ts:214`, `distribution-editor.component.ts:56` dutifully call it).

### 🟡 FE-ARCH-15 — Dead methods and leftovers across the list pages

- `event-list.component.ts` carries **six** methods with zero template/TS references: `formatAttendance` (381), `getConfirmedCount` (367), `getDeclinedCount` (371), `sortStateForColumn` (362), `onSortColumn` (346), `isColumnVisible` (233) — leftovers from the pre-`app-data-table` markup.
- `onSortColumn` is *also* dead-duplicated in `person-list.component.ts:317-330` and `user-list.component.ts:274-287` (the table emits `sortChange` → `onSortChangeFromTable`; the cycle logic additionally lives inside `DataTableComponent.onSort` — the same 12 lines exist 4×, 3 of them dead).
- `person-list.component.ts:358`: `protected readonly EventType = EventType;` — unused import exposure.
- `person-detail.component.ts:67` `deletingPerson` signal + the commented-out delete button (`person-detail.component.html:54-60`) — dead pair.
- `login.component.ts:26-27`: `environment.production ? '' : ''` — both branches identical; scrubbed dev-credentials leftover.
- `segment-manager.component.ts:381-383` `isComposition()` hardcodes `false`; `applyModeChange`'s `onDone` param (449) is never passed.
- `template-editor`: `templateDescription` is loaded and included in every save payload, but **no UI edits it** — grep for it in the template returns nothing.

### 🔵 FE-ARCH-16 — Debug `console.log`s in the projection layout hot path

`pinyes/utils/projection-layout.util.ts:401,432,433` dump the full metrics array and both candidate packings on **every** projection layout computation (i.e. every resize event of the projection screen). Remove; if the diagnostics are useful, gate them behind a debug flag.

---

## 3. Error handling & network robustness

### 🟠 FE-ERR-1 — Failure UX is per-call-site roulette

There is no global HTTP error surface for non-401s, and the per-site conventions have drifted into four incompatible patterns:

1. **Silent `console.error`:** `person-list.loadPersons` (255-258), `user-list.loadUsers` (469-473), `person-list.loadPositions` — a failed list load stops the skeleton and shows *"No hi ha dades per mostrar"* as if the census were empty. A user cannot distinguish "empty" from "broken".
2. **Silent nothing:** `assignment-canvas.loadConfirmedPersons` (522-541, capacity numbers stay wrong), `getLockStatus` (361, lock silently not applied → every mutation later fails with backend 403s), `event-detail`'s `getLockStatus`, `event-list.loadSeasons`, `person-panel.loadRegistries` + `tagService.getAll` (249), `person-detail` history (319).
3. `**errorMessage` signal in-modal** (event/attendance modals) vs. **toast** (tags, users, segments) vs. **both** (`event-detail.deleteEvent`).
4. **forkJoin all-or-nothing:** `segment-manager.onInstancesConfirmed` (293-316) — if 1 of N instance creates fails, the N−1 that **succeeded on the server** never appear in the UI (no reload in the error path) until a manual refresh.

**Recommendation:** one `handleError(context)` helper + a global interceptor toast for unhandled non-401s; make list-load failures render an error state (with retry) distinct from the empty state.

### 🟡 FE-ERR-2 — Error toasts auto-dismiss in 4 s, same as success

`toast.service.ts:28`: every toast — including errors — is removed after a fixed 4 000 ms. An error the user glances away from is gone (and there's no dedup: N failed rows = N stacked identical toasts). Convention: successes auto-dismiss, errors persist until dismissed (or ≥8 s), duplicates collapse.

### 🟡 FE-ERR-3 — SSE handlers assume well-formed JSON and specific failure causes

`person-sync.component.ts:67` and `event-detail.component.ts:345` both `JSON.parse(event.data)` with no try/catch inside `onmessage` — one malformed/truncated event throws inside the handler and the sync UI freezes in "running" forever. Plus the misleading CLOSED→"no permissions" diagnosis (FE-BUG-17).

### 🟡 FE-ERR-4 — `AuthService.isAtLeastTechnical` non-null assertion

`auth.service.ts:29-31`: `[TECHNICAL, ADMIN].includes(this.userRole()!)` — works today (`includes(null!)` is just false) but the `!` hides the null case instead of handling it; one refactor away from a real bug. `this.userRole() !== null && [...].includes(...)` costs nothing. (Same file: `logout()` navigates via the *caller* in `user-chip` but `logoutAll()` navigates internally — pick one.)

---

## 4. UX & interface consistency

### 🟠 FE-UX-1 — Deep links die at the login screen (no `returnUrl`)

`auth.guard.ts` / `role.guard.ts` redirect to `/login` without capturing the attempted URL, and `login.component.ts:41` always navigates to `/`. Every shared deep link (an event, a person, a projection screen — exactly the URLs this app passes around before assajos) lands the user on the dashboard home after login, forcing manual re-navigation. Standard fix: `router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })` + honor it after login.

### 🟠 FE-UX-2 — Lock state is cosmetic in the segment manager

`segment-manager.component.ts` receives `isLocked` but uses it **only** to tint the assignment-link icon (`segment-manager.component.html:219-226`). With the event locked (audit-01 SEC-17 now enforced server-side), the UI still happily offers: create segment, rename, delete segment, drag-reorder, add figures, apply composition, change figure mode, delete instance — every one now fails with a backend 403 toast *after* the user tried it. The assignment canvas gets this right (buttons/handlers gated on `isLocked()`). Gate the mutating controls (or overlay a lock banner) in the segment manager too.

### 🟡 FE-UX-3 — Two empty states render at once on list pages

`user-list.component.html:93-112` (and person-list, event-list are structured the same): when a filtered list is empty, `app-data-table` renders its own built-in *"No hi ha dades per mostrar"* row **and** the page renders `app-empty-state` ("No s'han trobat usuaris…") right below — two stacked empty messages. Either give `DataTableComponent` an `emptyMessage`/template input and drop the external card, or hide the table when empty (as the shared-component pattern presumably intended). This is one of the failure modes FE-ERR-1's inconsistency produces.

### 🟡 FE-UX-4 — Backdrop click discards form data with no warning

All form modals close-and-discard on any backdrop click (`user-form-modal.component.html:129`, `tag-form-modal`, `event-form-modal`, `attendance-edit-modal`, invitation/link modals). Mis-clicking outside a half-filled "Crea usuari" form silently destroys it. Options: ignore backdrop clicks on *dirty* forms, or confirm discard. (The `(keydown.enter)="onCancel()"` on backdrops is also odd — Enter on a focused backdrop discards the form.)

### 🟡 FE-UX-5 — Group separator misplaces itself under non-date sorts

`event-list` passes a "Events passats" `groupSeparator` whose predicate is date-based, but the table can be sorted by title/location (`data-table.component.ts:90-99` renders the separator before the *first* past item in whatever the current order is). Under a title sort, the separator appears at an arbitrary row and "past" items scatter both above and below it. Suppress the separator unless sorted by date (or sort-aware grouping).

### 🟡 FE-UX-6 — Row actions that lie, and pickers that truncate

- `event-list.component.ts:453-464`: row menu offers **"Veure detall"** and **"Gestionar pinyes"** — both navigate to the identical place (`navigateToEvent`). The second should deep-link to the segments section or not exist.
- `figure-picker-modal` (100-116), `composition-editor` (111), `figure-list-tab` (63): template/composition pickers fetch `{ limit: 200 }` with no pagination or search-more affordance — the 201st figure silently never appears anywhere it can be picked.
- Sidebar tab for `/pinyes` is labeled **"Plantilles"** (`tab-nav.component.ts:23`) though the module is templates *and* compositions *and* the whole assignment/projection world — while `/sync` (global sync page, `sync.routes.ts`) is reachable from **no** navigation surface at all (only by typing the URL, and even the one internal link to it is broken — FE-BUG-19).

### 🔵 FE-UX-7 — Person↔user linking modal gives no signal which persons qualify

`person-link-user-modal.component.ts:71-78`: you search persons, pick one, press "Enllaça" — and only then learn *"La persona seleccionada no té un usuari associat"*. The search results don't indicate which candidates have linked users (the data is right there in `managedBy`). Filter or badge the results.

### 🟡 FE-UX-8 — Non-TECHNICAL/ADMIN login loops back to the login page with no message

`app.routes.ts:11` guards the entire app with `rolesGuard(TECHNICAL, ADMIN)`; `rolesGuard` redirects failures to `/login`; `LoginComponent` navigates to `/` on success. A MEMBER user logging into the dashboard therefore authenticates successfully and lands back on the login form with no explanation. The backend now rejects MEMBER+DASHBOARD at login (BUG-5), but the frontend still renders that 401 as *"Correu electrònic o contrasenya incorrectes."* (FE-BUG-12), which is factually wrong for this case; and `rolesGuard` still redirects an **authenticated** user to `/login` (`role.guard.ts:22`) rather than a "no access" state.

---

## 5. Accessibility

### 🟠 FE-A11Y-1 — Column sorting is mouse-only

`data-table.component.html:6-24`: sorting is a `(click)` on the `<th>` — no button, no `tabindex`, no keyboard handler, no `aria-sort`, no `scope="col"`. Keyboard and screen-reader users cannot sort any table in the app. Wrap the header content in a real `<button>` and set `aria-sort`.

### 🟡 FE-A11Y-2 — Modals are not dialogs

No modal in the app traps focus, restores focus on close, or (mostly) responds to Escape. `user-form-modal` uses a literal `<dialog>` element but never calls `showModal()` (it's `class="modal modal-open"` CSS-only), so none of the native dialog semantics apply. Tab happily walks into the background page behind the backdrop. One shared modal wrapper using `<dialog>.showModal()` fixes focus trap + Escape + `aria-modal` in one move (pairs with FE-ARCH-2).

### 🟡 FE-A11Y-3 — Row-action menu has `role="menu"` but no menu behavior

`data-table.component.html:130-155`: `role="menu"`/`role="menuitem"` promise arrow-key navigation and focus management; none exists (no focus moved on open, no ArrowUp/Down, Escape handled only via a global listener). Either implement the keyboard contract or drop the roles (a plain list of buttons is more honest).

### 🟡 FE-A11Y-4 — Inline `onerror` handlers (CSP-hostile) and toast timing

- `header.component.html:8` and `login.component.html:11`: `onerror="this.style.display='none'"` — inline JS event attributes in Angular templates; they bypass Angular entirely and break under any CSP without `unsafe-inline`/`unsafe-hashes`. Use `(error)="..."`.
- Toasts are `aria-live="polite"` with 4 s auto-dismiss (FE-ERR-2) — errors should be `assertive` and persistent to be perceivable at all by AT users.
- The grant-role radio group (`user-list.component.html:147-161`) renders radios without a shared `name` — arrow-key group navigation doesn't work; each radio is an island.

### 🔵 FE-A11Y-5 — Assignment canvas hijacks Tab globally

`assignment-canvas.component.ts:409-413`: `Tab` is globally hijacked (`preventDefault` on every keydown) to mean "next empty node" — keyboard users can never reach the toolbar buttons. Consider scoping it to when the canvas has focus.

---

## 6. Performance

### 🟠 FE-PERF-1 — Every node selection refetches the person list

`person-panel.component.ts:251-265`: the node-selection effect calls `onXicallaChange(zone === TRONC)` on **every** node select, and `onXicallaChange` unconditionally calls `loadPersons()` — even when the checkbox value didn't change. The core assignment loop (assign → auto-advance to next node → select) therefore fires per assignment: the assign POST, `refreshPersonList` (→ `loadPersons` **and** `loadRegistries` — the full unfiltered roster), *plus* this selection-triggered `loadPersons`. 3-4 requests per assignment, ~99 % of them redundant. Skip the reload when the xicalla flag didn't change, and debounce selection-driven reloads.

### 🟡 FE-PERF-2 — Canvas rendering strategy: full scene rebuild on every state change

Every tracked signal change (`selectedNodeId`, `assignments`, `attendanceMap`, `highlightedNodeIds`…) triggers `pinyaLayer.destroyChildren()` + reconstruction of **all** Konva groups (`renderNodes`/`renderAssignmentNodes`, `figure-canvas.component.ts:757,1221,1516`). Clicking a node rebuilds the whole scene; `emitStageTransform()` (483-485) additionally calls `renderGrid()` — which destroys and recreates every grid line — **on every mousemove during panning**. Fine at ~100 nodes on desktop, but it's O(n) object churn per interaction and will be the first thing to hurt on weaker hardware (projection screens, tablets). Konva supports targeted updates (`findOne(#id)` + attr changes) — worth it at least for selection highlight and the pan-time grid. Additionally, `emoji-picker-element` (a full emoji dataset/web component) is imported at module top-level of `emoji-picker.component.ts:13`, so it loads with the person-detail chunk even for users who never open the picker — `import()` it on first open.

### 🟡 FE-PERF-3 — `attendanceLimit` of 100 with client-side page math

`event-detail.component.ts:78` loads attendance 100 at a time into a hand-rolled pager while the shared `PaginationComponent` exists; combined with `getSummaryForDisplay` allocating a new 8-object array per CD cycle (it's called from the template) these are small, but the pattern of computing display arrays in methods rather than `computed()` (`getSummaryForDisplay`, `getStatusBadgeClass`, various `format*` called per row per CD) is endemic to event-detail — the one screen measured at 5.9 % test coverage (FE-TEST-2) is also the one with the most per-CD work in methods.

### 🟡 FE-PERF-4 — Debounce timers never cancelled on destroy

The `setTimeout`-based search debounces in `user-list`, `person-list`, `event-list`, `template-list`, `composition-grid-tab`, `person-link-user-modal` (only `person-search-input` and `event-detail` clear theirs) fire after component destruction: a pending timer runs `loadX()`, issuing an HTTP request whose response updates signals of a destroyed component. Harmless today, but it's a leak-shaped pattern that the FE-ARCH-1 refactor should erase.

---

## 7. API contract drift

### 🟠 FE-API-1 — Two pagination envelopes; four duplicated `PaginatedResponse` definitions

The backend returns `{ data, meta: { total, page, limit } }` for `/persons`, `/events`, `/seasons`, templates/compositions — but `**/users` returns `{ data, total }`** (`user.controller.ts:56-59` passes the service result through unwrapped). The dashboard faithfully mirrors the inconsistency with *two shapes* of `PaginatedResponse` defined in *four places* (`persons/models/person.model.ts:41` and `events/models/event.model.ts:79` with `meta`; `config/models/user.model.ts:22` without; plus bespoke `PaginatedFigureTemplates`/`PaginatedCompositions`). CLAUDE.md documents the `meta` envelope as *the* convention — `/users` is the backend outlier to fix, after which the frontend can keep exactly one `PaginatedResponse<T>` in `shared/models`.

### 🟡 FE-API-2 — Positions vs. Tags: one rename, half-applied

The backend renamed positions → tags (`/tags`), and the frontend straddles it: `PersonService.getPositions()` calls `/tags` (`person.service.ts:32-34`), `person.model.Position` is a `Tag` in disguise, `tag-form-modal`'s input is literally named `position` (`tag-form-modal.component.ts:48`), `person-panel` filters by `selectedPositionId` sent as `positionId`. Every future reader pays a tax mapping the two vocabularies. Finish the rename on the frontend.

### 🟡 FE-API-3 — Sentinel-value API: `height=±1000` as a sort directive

`person-panel.component.ts:310-317`: "sort by tallest/shortest" is encoded by sending `height = SHOULDER_HEIGHT_BASELINE_CM ± 1000` and letting the backend's proximity ordering do the rest. It works, but the API contract is invisible — nothing in `available-persons` documents that ±1000 means "sort mode", and a future backend range-validation on `height` breaks the feature silently. An explicit `sortBy=height&sortOrder=…` param says what it means.

---

## 8. Code smells & conventions

- 🟡 **FE-SM-1** — `UpdatePersonDto` (frontend, `person.model.ts:76-98`) includes `id`, `createdAt`, `updatedAt` — server-managed fields in an update payload type; harmless only because call sites use `Partial<>` and skip them.
- 🟡 **FE-SM-2** — Enum values as string literals: `availability: ['AVAILABLE']`, `onboardingStatus: ['IN_PROGRESS']` (`person-detail.component.ts:102-103`), `attendanceStatus: 'ANIRE'` fallback (`person-panel.component.ts:170`) — `@muixer/shared` enums exist for exactly this.
- 🟡 **FE-SM-3** — `SyncEvent` interface duplicated verbatim in `persons/models/person.model.ts:67` and `events/models/event.model.ts:88`.
- 🟡 **FE-SM-4** — Two frontend slugify implementations: `pinyes/utils/slugify.util.ts` and the inline regex chain in `tag-form-modal.onNameInput` (120-130) — subtly different (the modal's keeps no `-` collapse for leading/trailing in the same way). Mirrors the backend's own duplicated slugify (audit-01 ARCH-9).
- 🟡 **FE-SM-5** — `onSaveError` (`template-editor.component.ts:965-990`) sniffs Catalan substrings of backend error messages (`msgLower.includes('instànci')`) to classify errors — a contract on human-readable text that breaks on the next copy edit. Error codes belong in the response.
- 🔵 **FE-SM-6** — `tag-form-modal`'s input named `position`; `PersonSearchResult`, `RowAction<T = any>`; scattered `Record<string, any>` (`person-panel.component.ts:307`) — typing shortcuts in otherwise strictly-typed code.
- 🔵 **FE-SM-7** — Date formatting: `toLocaleDateString('ca-ES', …)` re-specified ad hoc in `user-list` (65-68), `event-list` (237-241), `event-detail` (386-405), while `shared/utils/date.util.ts` exists — three different date renderings for the same domain (with/without weekday, 2-digit variants).

---

## 9. UI text / language

The project ships its own style guide (`.agents/skills/language-rules/SKILL.md`: Valencian variant, "vós" treatment, Softcatalà conventions). Measured against it:

### 🟡 FE-LANG-1 — Plain errors: typos and non-Valencian forms

- `**person-list.component.ts:31`: column label `'Alies'*`* — missing accent; everywhere else in the app it's `Àlies` (person-detail, person panel). Visible on the census screen, the app's most-used table.
- `ad-hoc-nodes-help-modal.component.html:17` *"la **seva** vora discontínua"* and `segment-manager.component.ts:194` *"totes les **seves** figures"* — guide mandates Valencian possessives (`seua`/`seues`).
- `global-sync.component.ts` *"quan MuixerApp **sigui** l'aplicació principal"* — should be `siga`.

### 🟡 FE-LANG-2 — Systematic deviations from the project's own style guide

Each of these is a *pattern*, not a one-off — worth fixing with a sweep + a lint rule of habit rather than piecemeal:

1. **Demonstratives:** 30 occurrences of `aquest/aquesta/aquestes` across UI strings; the guide mandates the Valencian simple system (`este/esta/estes`).
2. **"Tu" addressed to the user** (guide: app→user is *vós*): *"Segur que **vols** eliminar…"* (`event-detail.component.ts:199`, `segment-manager.component.ts:194`), *"No **tens** permisos…"* (`event-detail.component.ts:327,361`), *"…**necessites** confirmar…"* (`person-detail.component.ts:224`), *"**Recorda** sincronitzar…"* (`global-sync.component.ts`). Guide form: *"Esteu segur que voleu eliminar…?"*, *"No teniu permisos"*.
3. **Bare gerund for in-progress states** (guide: `S'està…`): `"Carregant..."`/`"Carregant persona..."`/`"Iniciant sessió..."`/`"Connectant..."` in ~10 places (`login.component.html:68`, `person-detail.component.html:91`, `assignment-canvas.component.html:281`, template-list/figure-list/composition-grid spinners, `figure-canvas.component.ts:848`, `event-detail` sync) — while *other* screens do it correctly (*"S'estan carregant les figures..."*, `figure-picker-modal`). Same for `pagination.component.ts:12` *"**Mostrant** X–Y de Z"* (→ *"Es mostren…"*).
4. `**desar` vs `alçar`:** the guide (and most of the app — *"Alça"*, *"S'està alçant..."*) standardizes on `alçar`, but `save-as-template-dialog` is entirely `desar` (*"**Desar** com a **template**"* — double violation, `template` → `plantilla`), plus `template-editor-help-modal` (*"Confirmar i desar"* — also infinitive where the guide wants imperative for user→app commands: *"Confirma i alça"*) and `person-detail.component.ts:212` (*"Error en desar els canvis"*).
5. **Error-message formula:** ~40 toasts follow *"Error en infinitiu…"* (and two use a bare gerund: *"Error **carregant** les figures."*, `figure-list-tab.component.ts:69`; *"Error **carregant** les dades de projecció"*, `projection-view.component.ts:532`). The guide's canonical form for could-not errors is *"No s'ha pogut infinitiu…"* / *"S'ha produït un error…"*. Pick the guide's form once and apply it everywhere (pairs naturally with the FE-ERR-1 `handleError` helper).

---

## 10. Tests

**Measured 2026-07-07** (`nx test dashboard --coverage`, all green): **53 spec files**, summary **53.2 % statements / 57.2 % branches / 48.6 % functions / 57.3 % lines**. Enforced thresholds are 40/35/40/40 (`vitest.config.mts`) vs. CLAUDE.md's claimed 70 %.

**What's genuinely good:** spec quality in the pinyes feature is high — `assignment-canvas.component.spec.ts` (1 350 lines) and `tronc-view.component.spec.ts` (1 163 lines) use proper TestBed setups with typed stub child components via `overrideComponent`, exercising real behavior. `figure-canvas.component.ts` reaches **98.9 %** without a spec of its own because the editor/composition/distribution specs render the **real Konva canvas** as a child. Auth guards are genuinely well tested (`auth.guard.spec`, `role.guard.spec`) — a contrast with what sits right next to them below.

### 🟠 FE-TEST-1 — Coverage only counts files that specs happen to import

`vitest.config.mts` does not enable `coverage.all`, so the report covers **147 files — only those imported by some spec**. Files no test touches are invisible: `home.component.ts`, `global-sync.component.ts` (whose broken link, FE-BUG-19, a rendering smoke test would have caught), `auth.interceptor.ts`, the three dead services (FE-ARCH-13)… none appear in the denominator. The real all-files statement coverage is meaningfully below the reported 53 %, and the 40 % gate is softer than it looks. Enable `coverage.all: true` (with the existing excludes) so untested files count as 0 %.

### 🟠 FE-TEST-2 — The riskiest code is still the least tested

Dashboard coverage is bimodal: next to the 90 %+ pinyes core sit near-zero areas, mapped here onto the bugs they sit on:


| File                                                                                                           | Stmts              | Sits on                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.interceptor.ts`                                                                                          | **no spec at all** | the 401-refresh-retry flow, including FE-BUG-1's logout bug                                                                                               |
| `user-form-modal.component.ts`                                                                                 | 4.5 %              | role assignment UI, FE-BUG-5/FE-BUG-16 (MEMBER role)                                                                                                      |
| `event-detail.component.ts`                                                                                    | 5.9 %              | biggest screen in events, SSE handling, FE-ERR-3 (its spec cleverly tests only pure helpers via `Object.create(prototype)`, never the component behavior) |
| `attendance-edit-modal.component.ts`                                                                           | 5.4 %              | attendance corrections                                                                                                                                    |
| `already-assigned-dialog.component.ts`                                                                         | 5.7 %              | assignment-conflict UI                                                                                                                                    |
| `save-as-template-dialog.component.ts`                                                                         | 2.5 %              | template versioning writes                                                                                                                                |
| `person-search-input.component.ts`                                                                             | 8.6 %              | FE-BUG-28 race                                                                                                                                            |
| `template-editor.component.ts`                                                                                 | 28.9 %             | FE-BUG-26 autosave loss, FE-BUG-10 duplicate-create                                                                                                       |
| `projection-view.component.ts`                                                                                 | 40.9 %             | FE-BUG-9 stale-filter/back-forward bug                                                                                                                    |
| `projection-layout.util.ts`                                                                                    | 27.1 %             | 523 lines of pure math — the ideal unit-test target                                                                                                       |
| `ApiService`                                                                                                   | no spec            | the base class every HTTP call in the app goes through                                                                                                    |
| shared kit: `data-table` 51 % / `pagination` 44 % (page-nav logic untouched) / `toast` 47 % / `user-chip` 23 % |                    | every list page (FE-BUG-3, FE-BUG-27 live here)                                                                                                           |


`date.util.ts`, `uuid.util.ts`, `slugify.util.ts` and `fit-to-bounds.util.ts` remain at **0 %**. Pure functions with zero test cost — start there.

### 🟡 FE-TEST-3 — Big templates measure ≈0 % even where the class is well-tested

`assignment-canvas.component.html` (560 statements), `template-editor.component.html` (583), `event-detail.component.html` (397), `projection-view.component.html` (152) all report 0 %: template branches (`@if`/`@for`, bindings) are effectively unmeasured, so template regressions (like FE-UX-3's double empty state) are invisible to the suite — worth checking whether the `@angular/build:unit-test` coverage mapping is attributing template code correctly.

### 🟡 FE-TEST-4 — e2e scaffolding still dead

Playwright's `dashboard-e2e` project exists but is excluded from CI and `ci:local` (`.github/workflows/ci.yml:74`, `package.json:32`) — dead scaffolding until wired up. Combined with the backend's own lack of integration tests against a real Postgres (audit-01 TEST-2), this is a gap squared: zero end-to-end coverage means nothing exercises login → list → canvas against a real API. The FE-BUG-4 race, FE-UX-1 deep-link loss and the FE-LANG-1 broken link are exactly e2e-shaped bugs.

---

## 11. Fix-first ranking

Ranked across all findings by (user damage × likelihood), not by section:


| #   | Finding                                                                                                                                                                               | Why first                                                           | Where                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | 🟠✅ [FE-BUG-1](#-fe-bug-1--interceptor-logs-the-user-out-when-a-retried-request-fails-for-any-reason--fixed) Interceptor logs users out on any post-refresh retry failure — **FIXED** | Session + unsaved work lost on a transient 500; app-wide            | `auth.interceptor.ts`                                |
| 2   | 🟠✅ [FE-BUG-26](#-fe-bug-26--template-editor-pending-autosave-is-discarded-on-most-exits--fixed) Template editor drops pending autosave on most exits — **FIXED**                     | Silent data loss in the flagship editor                             | `template-editor.component.ts`                       |
| 3   | 🟠✅ [FE-BUG-2](#-fe-bug-2--persona-nova-collects-a-full-form-then-silently-discards-everything-except-the-alias--fixed) "Persona nova" discards every field but the alias — **FIXED** | Silent data loss on a primary flow, guaranteed on every use         | `person-detail.component.ts`                         |
| 4   | 🟠✅ [FE-BUG-7](#-fe-bug-7--assignment-canvas-undo-history-is-incomplete-for-moves-and-swaps--fixed) Undo after a move drops the person; swaps unrecorded — **FIXED**                  | Corrupts the mental model of the most-used tool during assajos      | `pinyes-tab.component.ts`, `troncs-tab.component.ts` |
| 5   | 🟠✅ [FE-BUG-6](#-fe-bug-6--both-sync-screens-leak-their-eventsource-on-navigation--fixed) SSE `EventSource` leaks on navigation (×2 screens) — **FIXED**                              | Holds the server-side sync lock with nobody watching                | `person-sync` / `event-sync`                         |
| 6   | 🟠 [FE-BUG-22](#-fe-bug-22--rotation-handle-breaks-on-touch-devices-and-can-leak-window-listeners) Rotation handle dead on touch + listener leak                                      | Projection/distribution run on tablets                              | `figure-canvas.component.ts:1148`                    |
| 7   | 🟠✅ [FE-BUG-5](#-fe-bug-5--deactivated-users-no-confirmation-no-way-back--fixed) User deactivation: no confirm, no way back — **FIXED**                                               | One misclick in the row menu = account recoverable only via raw API | `user-list` / `user-form-modal`                      |
| 8   | 🟠 [FE-BUG-4](#-fe-bug-4--event-list-double-fetches-on-init-and-races-itself) Event list double-fetch race                                                                            | Wrong data displayed under normal latency, every page load          | `event-list.component.ts`                            |
| 9   | 🟠 [FE-BUG-3](#-fe-bug-3--data-table-row-actions-menu-can-act-on-the-wrong-row) Row-actions menu can act on the wrong row                                                             | Destructive actions (deactivate!) mis-targeted                      | `data-table.component.html`                          |
| 10  | 🟠 [FE-UX-2](#-fe-ux-2--lock-state-is-cosmetic-in-the-segment-manager) Segment manager ignores the event lock                                                                         | Locked-event mutations offered, then fail confusingly               | `segment-manager`                                    |
| 11  | 🟠 [FE-ARCH-13](#-fe-arch-13--910-lines-of-extracted-services-that-nothing-uses) Delete or finish the ~910 lines of dead services                                                     | Unblocks the honest version of `FE-ARCH-8`; zero risk               | `pinyes/**/services`                                 |
| 12  | 🟠 [FE-ARCH-1](#-fe-arch-1--the-list-page-controller-is-copy-pasted-five-times) Extract the shared list controller                                                                    | One fix-point for `FE-ARCH-4` races, `FE-PERF-4` timers, dead code  | all list pages                                       |
| 13  | 🟠 [FE-API-1](#-fe-api-1--two-pagination-envelopes-four-duplicated-paginatedresponse-definitions) Unify the `/users` envelope + one `PaginatedResponse`                               | Contract drift compounding with every new consumer                  | backend `user.controller` + `shared/models`          |
| 14  | 🟠 [FE-UX-1](#-fe-ux-1--deep-links-die-at-the-login-screen-no-returnurl) `returnUrl` on login redirect                                                                                | Every shared deep link degrades to the home page                    | guards + login                                       |
| 15  | 🟠 [FE-A11Y-1](#-fe-a11y-1--column-sorting-is-mouse-only) Keyboard-accessible sorting                                                                                                 | Whole-app a11y gap in the shared table                              | `data-table`                                         |
| 16  | 🟠 [FE-PERF-1](#-fe-perf-1--every-node-selection-refetches-the-person-list) Person list refetch per node selection                                                                    | 3-4 requests per assignment during live assajos                     | `person-panel.component.ts`                          |
| 17  | 🟠 [FE-TEST-1](#-fe-test-1--coverage-only-counts-files-that-specs-happen-to-import) `coverage.all` + interceptor/modal specs                                                          | Makes every other gap visible and gateable                          | `vitest.config.mts`                                  |


A note on leverage: items 12 (list controller, `FE-ARCH-1`) and item 11's neighbor `FE-ARCH-2` (the modal/confirm component) are the two refactors that retire whole *classes* of findings — between them they subsume `FE-BUG-27`, `FE-BUG-3`, `FE-ARCH-4`, `FE-ERR-1` (partly), `FE-UX-3`, `FE-UX-4`, `FE-UX-5`, `FE-A11Y-2`, `FE-A11Y-3` and `FE-PERF-4`. If only two structural investments happen this quarter, those are the two.