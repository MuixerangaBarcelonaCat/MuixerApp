# Quadre de troncs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only, near-fullscreen modal, opened from the Troncs tab of the segment workspace, that shows the event's people grouped by tag columns, sorted by height, coloured by rehearsal + next-performance attendance, with participation dots.

**Architecture:** Reuse `GET /events/:eventId/participation` (already returns height, attendance, next-performance status, tags with slug, placements per segment) behind a new opt-in query flag that adds the "not at rehearsal but coming to the performance" people. All grouping/sorting/colouring is a pure dashboard util; column choice lives in a root service backed by `localStorage`; the modal is a thin OnPush component over both.

**Tech Stack:** NestJS 11 + raw SQL (TypeORM DataSource) · Jest + testcontainers · Angular 21 standalone/OnPush/signals · Vitest · `@muixer/ui` (`lib-modal`, `lib-button`, `lib-checkbox`, `lib-badge`) · Lucide.

**Spec:** `docs/superpowers/specs/2026-11-12-quadre-troncs-design.md`

## Global Constraints

- UI text in Catalan (valencià register) — read `.agents/skills/language-rules/` before writing any copy. Code in English.
- Read `.agents/skills/test-driven-development/` before writing code (CLAUDE.md).
- Design system: tokens only, never raw hex or new arbitrary Tailwind values in app code; static class maps, never template-literal classes; `@muixer/ui` components over raw DaisyUI.
- Standalone + OnPush + signals; `input()`/`output()`, no `@Input`/`@Output`.
- Read-only: clicking a person does nothing.
- "Coming to rehearsal" = event `attendanceStatus` ∈ {`ANIRE`, `ASSISTIT`}.
- Only active persons (`isActive === true`) appear.
- Default columns by tag `slug`, in order: `mans`, `baix`, `segona`, `alcadora`, `terca`, `persona-nova`, `xicalla`; plus a fixed last column «Altres».
- Dots: 0 → `''`, 1 → `●`, 2 → `●●`, 3 → `●●●`, ≥4 → `●●●+`.
- Figure count = distinct `instanceId` across all segments' placements, ignoring placements with `positionType === DIRECCIO_PINYA_POSITION_TYPE` (`@muixer/shared`).
- Do not change what the existing Participació tab receives (it calls the endpoint without the flag).
- No Co-Authored-By trailer in commits.

## Review Focus

1. Event is a performance, or a rehearsal with no next performance in its season (`nextPerformanceStatus === null` for everyone): no colours, no star, no performance-only rows, no «+N actuació». Test in Task 3.
2. A person carries several visible tags: appears in each column, counted once in the global total. Test in Task 3.
3. Stored column ids that no longer exist / corrupt JSON / `localStorage` throwing: silently fall back to defaults. Test in Task 4.
4. Assigned person who answered `NO_VAIG` and is also `ANIRE` to the performance: warning state wins over dimmed, not counted in any total. Test in Task 3.
5. Person with no `shoulderHeight`: sorted to the end of their group, then by alias. Test in Task 3.

---

### Task 1: API — opt-in performance-only attendees

**Files:**
- Modify: `apps/api/src/modules/node-assignment/event-participation.service.ts` (`getEventParticipation`, `loadMatrix`)
- Modify: `apps/api/src/modules/node-assignment/node-assignment.controller.ts:252` (`getEventParticipation`)
- Test: `apps/api/src/modules/node-assignment/event-participation.integration.spec.ts`, `apps/api/src/modules/node-assignment/event-participation.service.spec.ts`, `node-assignment.controller.spec.ts`

**Interfaces:**
- Produces: `GET /events/:eventId/participation?includeNextPerformance=true` — same `EventParticipationOverview` shape; when the event is an `ASSAIG` with a resolvable next performance, `persons` also contains people whose attendance at that performance is `ANIRE`, whatever their status at this event. Without the flag, output is byte-identical to today.
- Produces: `EventParticipationService.getEventParticipation(eventId: string, options?: { includeNextPerformance?: boolean }): Promise<EventParticipationOverview>`

- [ ] **Step 1: Write failing integration tests** in `event-participation.integration.spec.ts`:
  - `it('adds performance-only attendees when includeNextPerformance is set')` — rehearsal R + later ACTUACIO A in same season; person P has `NO_VAIG` (or no row) at R and `ANIRE` at A. Expect `persons.map(p => p.id)` to contain P with `attendanceStatus` ≠ ANIRE/ASSISTIT and `nextPerformanceStatus === 'ANIRE'`.
  - `it('leaves the population unchanged without the flag')` — same fixture, no option: P absent.
  - `it('ignores the flag for a performance or a rehearsal with no next performance')` — P absent.
  - Extend the existing N+1 guard test to call with the flag: still exactly 4 queries with participants.
  - `it('runs 3 queries for an empty rehearsal with the flag')` — the next-performance resolve now runs even with nobody to describe.
  - The existing «skips the tag query when the event has no participants» (2 queries) and N+1 guard (4) tests must keep passing untouched.
- [ ] **Step 2: Run** `nx run api:test-integration --testFile=apps/api/src/modules/node-assignment/event-participation.integration.spec.ts` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** The no-flag path keeps today's order exactly (resolve after the matrix, only when `personIds.length > 0`); its only change is passing `$4 = null`. Only when `options.includeNextPerformance` and the event is `ASSAIG`, resolve the next performance *before* `loadMatrix` (reuse `resolveNextPerformance`), pass its id as `$4` and add a third `UNION` branch to the `participants` CTE: `SELECT a."personId" FROM attendances a WHERE a."eventId" = $4::uuid AND a.status::text = 'ANIRE'`. Pass `null` for `$4` otherwise (the branch then matches nothing). Reuse the already-resolved next performance for Q4 instead of resolving twice. Controller: `@Query('includeNextPerformance', new ParseBoolPipe({ optional: true })) includeNextPerformance?: boolean`, add `@ApiQuery({ name: 'includeNextPerformance', required: false, type: Boolean })`, pass through as `getEventParticipation(eventId, { includeNextPerformance })`. Update the controller spec's `toHaveBeenCalledWith(EVENT_ID)` to that exact call.
- [ ] **Step 4: Run** the integration file and `nx test api --testFile=apps/api/src/modules/node-assignment/event-participation.service.spec.ts` and the controller spec — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): include next-performance attendees in participation on request`

---

### Task 2: `lib-modal` full size

**Files:**
- Modify: `libs/ui/src/lib/components/modal/modal.component.ts:5-14,44`
- Test: `libs/ui/src/lib/components/modal/modal.component.spec.ts`

**Interfaces:**
- Produces: `ModalSize` gains `'full'`. A `full` modal box is `w-11/12 max-w-none` and `h-[90vh] max-h-[90vh]` (the other sizes keep `max-h-[85vh]`).

- [ ] **Step 1: Failing test** `it('renders the full size as a near-fullscreen box')` — set `size = 'full'`, open, assert the `.modal-box` has classes `w-11/12`, `max-w-none`, `max-h-[90vh]` and not `max-h-[85vh]`.
- [ ] **Step 2: Run** `nx test ui --testFile=libs/ui/src/lib/components/modal/modal.component.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — move the height class into the size map (static strings). For `full`, the body wrapper in `modal.component.html` must also get `min-w-0` so wide content scrolls horizontally inside it instead of widening the box (the consumer adds its own `overflow-x-auto`).
- [ ] **Step 4: Run** — Expected: PASS. Add the size to the `/design-system` modal showcase if it lists sizes.
- [ ] **Step 5: Commit** `feat(ui): add full size to lib-modal`

---

### Task 3: Pure quadre util

**Files:**
- Create: `apps/dashboard/src/app/features/pinyes/utils/quadre-troncs.util.ts`
- Modify: `apps/dashboard/src/app/features/pinyes/components/person-panel/person-panel.component.ts:678` (`formatHeight` delegates)
- Test: `apps/dashboard/src/app/features/pinyes/utils/quadre-troncs.util.spec.ts`

**Interfaces:**
- Consumes: `ParticipationPerson` (`apps/dashboard/src/app/features/events/models/participation.model.ts`); `AttendanceStatus` **from `@muixer/pinyes-render`** (the model's string union — the `@muixer/shared` enum would need casts); only `DIRECCIO_PINYA_POSITION_TYPE` from `@muixer/shared`.
- Produces:
```ts
export type QuadreRowState =
  | 'both'            // coming + ANIRE to performance → success tone
  | 'notPerformance'  // coming + NO_VAIG to performance → error tone
  | 'unanswered'      // coming + PENDENT to performance → no colour
  | 'neutral'         // coming, nextPerformanceStatus null → no colour, no star
  | 'performanceOnly' // not coming, ANIRE to performance → dimmed + star
  | 'assignedAbsent'; // not coming, holds ≥1 placement → warning tone
export interface QuadreColumnDef { id: string; name: string }          // a tag
export interface QuadreEntry { person: ParticipationPerson; state: QuadreRowState; figureCount: number }
export interface QuadreColumn { id: string | null; name: string; entries: QuadreEntry[]; comingCount: number; performanceOnlyCount: number } // id null = «Altres»
export interface Quadre { columns: QuadreColumn[]; uniqueComing: number }
export function figureCount(person: ParticipationPerson): number;
export function participationDots(count: number): string;
export function rowState(person: ParticipationPerson): QuadreRowState | null; // null = not shown
export function buildQuadre(persons: ParticipationPerson[], columns: QuadreColumnDef[]): Quadre;
export function formatShoulderHeight(h: number | null, mode: HeightMode, baselineCm: number): string; // body moved verbatim from person-panel `formatHeight` ('-' for null/0; relative '+5'/'-3'; absolute '170 cm')
```
- `person-panel.component.ts` `formatHeight` delegates to `formatShoulderHeight` (no behaviour change; its existing tests must pass).
- `rowState` precedence: inactive → null; has any placement and not coming → `assignedAbsent`; not coming and next = ANIRE → `performanceOnly`; not coming → null; coming → by next status (`null`→`neutral`, ANIRE→`both`, NO_VAIG→`notPerformance`, otherwise `unanswered`).
- Column membership by `person.positions[].id`. «Altres» (`id: null`, name `'Altres'`) = shown persons with none of the given column ids; always present, last.
- Entry order per column: non-`performanceOnly` first, then `shoulderHeight` desc with `null` and `0` last, then alias `localeCompare(…, 'ca')`.
- `comingCount` = entries whose state is not `performanceOnly`/`assignedAbsent`; `performanceOnlyCount` = `performanceOnly` entries; `uniqueComing` = distinct persons in those coming states.

- [ ] **Step 1: Write failing tests** (fixture builder `person(overrides)`):
  - `participationDots`: `[0,1,2,3,4,7]` → `['', '●', '●●', '●●●', '●●●+', '●●●+']`.
  - `figureCount`: two placements in the same `instanceId` across segments → 1; a `direccio-pinya` placement only → 0; `direccio-tronc` → 1.
  - `rowState`: each of the six states + inactive → null + `PENDENT` with no placement and next `NO_VAIG` → null; `NO_VAIG` assigned with next `ANIRE` → `assignedAbsent`.
  - `formatShoulderHeight`: `(null|0, …)` → `'-'`; `(175,'relative',170)` → `'+5'`; `(165,'relative',170)` → `'-5'`; `(175,'absolute',170)` → `'175 cm'`.
  - `buildQuadre`: person with tags of columns A and B appears in both, `uniqueComing === 1`, each `comingCount === 1`; person with no column tag lands in «Altres»; ordering (180, 170, null, then performanceOnly at end); `performanceOnly` excluded from `comingCount` and counted in `performanceOnlyCount`; `assignedAbsent` counted nowhere; all `nextPerformanceStatus: null` → no `both`/`notPerformance`/`performanceOnly` states.
- [ ] **Step 2: Run** `nx test dashboard --testFile=apps/dashboard/src/app/features/pinyes/utils/quadre-troncs.util.spec.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the functions above.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(dashboard): add quadre de troncs grouping util`

---

### Task 4: Column preferences (per device)

**Files:**
- Create: `apps/dashboard/src/app/features/pinyes/services/quadre-columns.service.ts`
- Test: `apps/dashboard/src/app/features/pinyes/services/quadre-columns.service.spec.ts`

**Interfaces:**
- Consumes: tag catalog `TagWithCount[]` from `TagService` (`features/config/services/tag.service.ts`), `QuadreColumnDef` (Task 3).
- Produces:
```ts
export const QUADRE_DEFAULT_SLUGS = ['mans', 'baix', 'segona', 'alcadora', 'terca', 'persona-nova', 'xicalla'] as const;
@Injectable({ providedIn: 'root' }) export class QuadreColumnsService {
  resolve(tags: { id: string; name: string; slug: string }[]): QuadreColumnDef[]; // stored ids that still exist, in stored order; else defaults by slug (missing slugs skipped)
  save(tagIds: string[]): void;   // persists under key 'muixer.quadreTroncs.columns'
  reset(): void;                  // removes the key
}
```
The column panel never calls `save([])`: the last ticked column can't be unticked (its checkbox is disabled).
Every `localStorage` read/write in `try/catch`; anything unparsable or not a `string[]` = no stored value. Follow the shape of `figures-view-mode.service.ts`.

- [ ] **Step 1: Failing tests**: defaults in slug order with a missing slug skipped; stored order respected; unknown stored id dropped; stored list whose ids all vanished → defaults; corrupt JSON → defaults; `localStorage.getItem` throwing → defaults; `save` then `resolve` round-trips; `reset` restores defaults.
- [ ] **Step 2: Run** `nx test dashboard --testFile=…/quadre-columns.service.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(dashboard): persist quadre de troncs columns per device`

---

### Task 5: Modal + entry point

**Files:**
- Modify: `apps/dashboard/src/app/features/events/services/participation.service.ts` — `getByEvent(eventId: string, options?: { includeNextPerformance?: boolean })` adds `?includeNextPerformance=true` only when set.
- Create: `apps/dashboard/src/app/features/pinyes/components/quadre-troncs-modal/quadre-troncs-modal.component.{ts,html,spec.ts}`
- Modify: `apps/dashboard/src/app/features/pinyes/components/segment-workspace/segment-workspace.component.{ts,html}` — button beside «Importa tronc», only on the Troncs tab.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `<app-quadre-troncs-modal [open]="…" [eventId]="…" (closed)="…" />` — inputs `open: boolean`, `eventId: string`; output `closed: void`.

Behaviour:
- On each transition to `open`, fetch `participation.getByEvent(eventId, { includeNextPerformance: true })` and the tag catalog; show a loading state, and a `lib-alert` on error.
- `lib-modal size="full"`, title «Quadre de persones — {event.title}» (assistant's call; adjust copy with language-rules).
- Header: global total («{uniqueComing} persones»), a «Columnes» `lib-button` that toggles an inline panel (one `lib-checkbox` per tag of the catalog + up/down `lib-button`s + «Restableix»; changes call `QuadreColumnsService.save`/`reset` and recompute), and a `lib-checkbox` «Només qui no ha participat» (hides entries with `figureCount > 0`; totals unchanged).
- Body: one column per `QuadreColumn`, horizontally scrollable inside the modal (never the page). Column header: name, `comingCount`, and when > 0 a muted «+{n} actuació».
- Row: alias · height via `formatShoulderHeight(h, AssignmentStateService.heightMode(), injectPinyesRenderSettings()().shoulderHeightBaselineCm)` — follows the workspace's relative/absolute toggle, hidden when `'-'` · `participationDots(figureCount)` · star (`DOMAIN_ICONS.ACTUACIO`, same markup/aria as `person-panel.component.html:284`) when `nextPerformanceStatus === ANIRE` · warning icon with `title="Assignada però no ve a l'assaig"` for `assignedAbsent`. Background via a static `Record<QuadreRowState, string>` map using semantic tokens (success / error tints, warning tint, `opacity-50` for `performanceOnly`, none for `unanswered`/`neutral`).
- Hover: a `hoveredPersonId` signal; every entry of that person gets a ring (static class). Clicking does nothing.

- [ ] **Step 1: Failing component tests** (stub `ParticipationService` + `TagService`): requests with `includeNextPerformance: true` on open; refetches on reopen; renders default columns + «Altres» with totals; row of state `both` has the success class, `assignedAbsent` the warning icon; hovering a person rings all their entries; «Només qui no ha participat» hides a person with dots but keeps the header total; error response shows the alert. Plus `participation.service.spec`: no query string without options.
- [ ] **Step 2: Run** `nx test dashboard --testFile=…/quadre-troncs-modal.component.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the modal and the workspace button (`lib-button variant="ghost" size="sm"`, Lucide `Table2` icon, label «Quadre», `ariaLabel` «Obri el quadre de persones de l'event»; wire `ws.eventId()`). Place it in the Troncs header block **outside** the `@if (importCandidates().length > 0)` that wraps «Importa tronc» — it must show when the segment has no troncs yet. Not disabled by `ws.isLocked()` (read-only). Hidden on phones (inside the existing `hidden sm:flex` wrapper) is fine.
- [ ] **Step 4: Run** the spec, `nx lint dashboard`, `nx test dashboard` — Expected: PASS.
- [ ] **Step 5: Verify in the real app** with the `run-muixer-app` skill: open a rehearsal segment → Troncs → «Quadre»; check columns, colours, dots, hover, both themes (light/dark).
- [ ] **Step 6: Commit** `feat(dashboard): add quadre de persones modal to the troncs workspace`

---

### Task 6: Docs + manual

**Files:**
- Modify: `docs/manual/12-assignacio-troncs.md` — header list item 6 (new «Quadre» button) + a new `### El quadre de persones` section: what columns mean, colours, star, dots, «+N actuació», warning, hover, «Columnes» (saved on this device), «Només qui no ha participat».
- Modify: `docs/PINYES_MODULE.md` — one paragraph under the workspace section pointing at the modal, the util and the `includeNextPerformance` flag.
- Modify: `apps/dashboard-e2e/src/manual/shots/s07.ts` (the troncs page's shots) — new shot: open a rehearsal segment → Troncs → «Quadre», wait for the columns, `blur` names/surnames but not aliases (see `manual-shot.ts`).

- [ ] **Step 1:** Write the manual section (language-rules skill first) referencing the new image.
- [ ] **Step 2:** Add the shot, run `pnpm run docs:manual-shots`, check the image.
- [ ] **Step 3:** Run `pnpm run ci:local` — Expected: lint + test + build all green.
- [ ] **Step 4: Commit** `docs: document the quadre de persones`
