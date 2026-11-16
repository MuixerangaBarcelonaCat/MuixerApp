# Frescor de dades (Dashboard i PWA) — pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un tècnic veja en ≤ 3–5 s les assignacions i l'assistència que canvien altres tècnics al mateix segment, i que un membre veja qualsevol canvi de la projecció en ≤ 35 s, sense SSE ni càrrega apreciable al servidor.

**Architecture:** Comptadors de revisió a Postgres mantinguts per triggers (cap servei ha d'avisar ningú), un endpoint mínim que els torna, i *polling* de revisió als clients: només es descarreguen dades quan la revisió ha canviat. La projecció es guarda en memòria per segment mentre la revisió no canvia.

**Tech Stack:** PostgreSQL 15+ (plpgsql), TypeORM 0.3 (migració a mà), NestJS 11, Angular 21 (signals, `rxResource`), Jest + testcontainers, Vitest, Caddy (`caddy-ratelimit`).

**Spec:** [docs/DATA_FRESHNESS.md](../../DATA_FRESHNESS.md) (estudi del 05-10-2026, opció D). Este pla el seguix excepte en els punts de «Canvis respecte de l'estudi».

## Canvis respecte de l'estudi

El projecte ha evolucionat des de l'estudi (`bf21368e` → `4d83a501`). Decisions preses ací:

| Estudi (05-10) | Ara | Motiu |
|---|---|---|
| `figure_instances.revision` + refetch per figura (`refreshInstance(id)`) | **No hi ha revisió per figura.** Dos comptadors al segment: `revision` (nodes i assignacions) i `structureRevision` (figures i el segment mateix) | Ja existix `GET …/assignment-state` (nodes + assignacions de **totes** les figures en 1 petició, ~3 consultes). Refrescar tot el segment costa 1 petició; la granularitat per figura ja no estalvia res. A més, els triggers només bloquegen **una** fila (la del segment) i mai la de la figura: menys ordres de bloqueig creuats |
| Revisió de membres sense assistència | Igual: `{ revision }` = `revision + structureRevision` | `ProjectionData.personAttendance` existix, però a un membre no li cal fresca; incloure-la faria recarregar tots els mòbils a cada «Vinc» durant l'arribada |
| Cache per `(segmentId, revision)` | Segell = `revision:structureRevision:attendanceRevision`, TTL 60 s | La projecció inclou `personAttendance` (els tècnics sí que la volen fresca) i dades de persona (àlies) que no mouen cap revisió: el TTL en limita l'antiguitat |
| `refresh()` si canvia l'estructura | `reloadInstances()` | `refresh()` no afig ni lleva figures; `reloadInstances()` sí, i no mostra *spinner* ni reinicia la selecció |
| 409 → `refreshInstance` | 409 → `reloadAssignmentState()` (Task 1 → es reaprofita a la Task 6) | Mateix motiu: 1 petició per a tot el segment |
| Projecció fullscreen del Dashboard: no s'esmentava | També fa polling (Task 6) | És la pantalla que es projecta a l'assaig i ningú la refresca a mà |
| Assistència: «no row ≡ PENDENT» no existia | El trigger d'`attendances` cobrix `INSERT/UPDATE/DELETE` | Tornar a PENDENT pot esborrar la fila |
| Pas 8 opcional (push «Avisa dels canvis», SSE tècnics) | **Fora d'abast** | YAGNI; es valora després de provar el polling en un assaig real |

**Fora d'abast** (afegir quan es demostre que cal): revisió per a «Passa llista» de la PWA i per a la confirmació d'assistència del Dashboard (caldria `GET /events/:id/attendance/revision`; el comptador `events.attendanceRevision` ja queda fet); SSE per a tècnics (estudi §6); push «Avisa dels canvis» (estudi §5.5). Si `feat/quadre-troncs` es fusiona abans, el quadre llig de `SegmentWorkspaceStateService`/`AssignmentStateService` i queda cobert per la Task 6 sense res més; comproveu-ho a mà.

## Global Constraints

- Codi, commits, columnes i endpoints en anglés; text d'UI i manual en valencià (llegiu `.agents/skills/language-rules/` abans d'escriure text visible). Cap `Co-Authored-By` als commits.
- TDD: llegiu `.agents/skills/test-driven-development/` abans d'escriure codi. Test primer, veure'l fallar, implementar, veure'l passar, commit.
- `synchronize: false`: tot canvi d'esquema va en una migració a `apps/api/src/migrations/` registrada a `migrations/index.ts`. Columnes en camelCase entre cometes (`"structureRevision"`), com la resta.
- Intervals (valors de l'estudi, exportats de `@muixer/shared`): Dashboard **3 000 ms**; PWA **30 000 ms + jitter aleatori 0–5 000 ms** (màxim 35 s). Sempre pausats amb `document.visibilityState !== 'visible'` i consulta immediata en tornar a `visible`.
- El polling no mostra mai *toasts* ni *spinners*: un error de xarxa, 401 o 404 es descarta en silenci i es torna a provar al següent tic.
- Frontends: standalone + `OnPush` + signals, `input()`/`output()`, components de `@muixer/ui`, sense NgRx.
- Un sol procés d'API: la cache en memòria és correcta. Si algun dia n'hi ha més, cada procés té la seua i continua sent correcte.
- Després de tocar un `.entity.ts`: `pnpm run docs:model` i `pnpm run docs:map`, i el diff al mateix commit.
- Abans de donar una tasca per acabada: `nx lint <projecte>` i els tests del projecte tocat. Al final: `pnpm run ci:local` i `nx run api:test-integration`.

## Review Focus

1. **Operació optimista en vol quan arriba una recàrrega remota** → la recàrrega no pot esborrar l'assignació temporal ni el `previousAssignments` del rollback. S'espera: es descarta la resposta i es reintenta al següent tic (test a la Task 6).
2. **Pestanya oculta molta estona i torna** → una sola consulta immediata, cap ràfega de temporitzadors acumulats, cap petició mentre està oculta (test a la Task 5).
3. **Errors durant el polling (xarxa caiguda, 401 mentre es refresca el JWT, 404 perquè el segment s'ha despublicat)** → silenci, es conserva l'última dada bona en pantalla i la revisió de referència, i es reprén sol (tests a les Tasks 5 i 7).
4. **Recàrrega silenciosa de la projecció** → no ha de reiniciar la càmera/zoom, ni tancar el cercador de persones, ni perdre `selectedParticipant`, ni fer el vol «Troba'm» de nou (tests a les Tasks 6 i 7).
5. **Dos tècnics escrivint alhora al mateix segment** → cap increment perdut: N escriptures concurrents deixen `revision` en +N (test a la Task 2). Cas conegut i acceptat: moure una figura de segment mentre un altre hi assigna pot acabar en *deadlock* que Postgres resol avortant una de les dues (el client ja mostra l'error i fa rollback).

---

## Estructura de fitxers

| Fitxer | Responsabilitat |
|---|---|
| `apps/api/src/migrations/1787200000000-AddRevisionCounters.ts` (nou) | Columnes + funcions + triggers |
| `apps/api/src/migrations/1787200000000-AddRevisionCounters.integration.spec.ts` (nou) | Prova de la migració i dels triggers amb Postgres real |
| `apps/api/src/modules/event-segment/entities/event-segment.entity.ts`, `apps/api/src/modules/event/event.entity.ts` | Camps de només lectura |
| `apps/api/src/modules/event-segment/segment-revision.service.ts` (+ spec, nou) | Llegir les revisions amb 1 consulta |
| `apps/api/src/modules/event-segment/event-segment.controller.ts`, `apps/api/src/modules/me/me.controller.ts`, `me.service.ts` | Endpoints `…/revision` |
| `apps/api/src/modules/event-segment/projection.service.ts` | Cache per segell de revisió |
| `libs/shared/src/interfaces/segment-revision.interface.ts` (nou) | `SegmentRevision`, `MeSegmentRevision` |
| `libs/shared/src/utils/revision-poller.util.ts` (+ spec, nou) | Bucle de polling sense framework + constants d'interval |
| `apps/dashboard/src/app/features/pinyes/services/segment-workspace-state.service.ts` | `reloadAssignmentState()`, sincronització en viu |
| `apps/dashboard/src/app/features/pinyes/services/segment-assignment-actions.service.ts` | 409 → recàrrega |
| `apps/dashboard/src/app/features/pinyes/components/projection-view/projection-view.component.ts` | Polling + recàrrega silenciosa |
| `apps/pwa/src/app/features/events/services/projection.service.ts`, `segment-projection/segment-projection.component.{ts,html}`, `event-detail/event-detail.component.ts` | Polling de la projecció; refresc en tornar a la pestanya |
| `apps/dashboard/Caddyfile` | Zona de límit pròpia per a `…/revision` |
| `docs/…`, `CLAUDE.md`, `docs/manual/…` | Documentació |

Si quan s'implemente `develop` ja té una migració amb un número ≥ `1787200000000`, useu el següent centenar de milions lliure i canvieu el nom de la classe en conseqüència.

---

### Task 1: Dashboard — un 409 `NODE_OCCUPIED` recarrega el segment

Canvi independent i útil encara que no es faça res més: hui el tècnic veu «Este lloc ja està ocupat» però no qui l'ocupa.

**Files:**
- Modify: `apps/dashboard/src/app/features/pinyes/services/segment-workspace-state.service.ts` (`fetchSegmentData`, ~l. 301-352)
- Modify: `apps/dashboard/src/app/features/pinyes/services/segment-assignment-actions.service.ts` (handler d'error d'`assign`, ~l. 228-239)
- Test: els `.spec.ts` germans dels dos fitxers

**Interfaces:**
- Produces: `SegmentWorkspaceStateService.reloadAssignmentState(): Observable<boolean>` — demana `getSegmentAssignmentState(eventId, segmentId)` i fusiona nodes + assignacions a `instances` (amb `withState`) i `state.assignments`; després crida `reloadConflicts()`. Emet `true` si ha aplicat la resposta i `false` si l'ha descartada. **Descarta** la resposta (no toca cap signal) si, quan arriba, `state.pendingOperations().length > 0` o si `eventId()`/`segmentId()` ja no són els de la petició. Un error de xarxa emet `false` (no llança, no fa *toast*).

- [ ] **Step 1: Tests que fallen** (`segment-workspace-state.service.spec.ts`)

```ts
it('reloadAssignmentState replaces nodes and assignments of every instance and reloads conflicts', …);
// després: ws.state.assignments() === resposta aplanada; instances()[0].nodes === resposta; getSegmentConflicts cridat

it('reloadAssignmentState discards the response while an optimistic operation is pending', …);
// state.pendingOperations.set([op]) abans que arribe la resposta → state.assignments() intacte, emet false

it('reloadAssignmentState emits false and shows no toast on error', …);
```

I a `segment-assignment-actions.service.spec.ts`:

```ts
it('reloads the segment state after a 409 on assign so the occupant becomes visible', …);
// assign() → error { status: 409 } → expect(ws.reloadAssignmentState).toHaveBeenCalledTimes(1)
it('does not reload the segment state on a non-409 assign error', …);
```

- [ ] **Step 2:** `nx test dashboard --testFile=<cada spec>` → FALLEN (`reloadAssignmentState is not a function`).
- [ ] **Step 3: Implementa.** Extrau de `fetchSegmentData` la part que aplica `instanceState` a `instances`/`state.assignments` a un mètode privat i reusa-la des de `reloadAssignmentState()`. Al handler d'error d'`assign`, després del rollback (l'operació pendent ja s'ha tret de `pendingOperations`), si `err?.status === 409` → `this.ws.reloadAssignmentState().subscribe()`. El *toast* es queda igual.
- [ ] **Step 4:** els dos specs PASSEN; `nx lint dashboard`.
- [ ] **Step 5: Commit** — `fix(dashboard): reload segment state when a node is already occupied`

---

### Task 2: Migració — comptadors de revisió i triggers

**Files:**
- Create: `apps/api/src/migrations/1787200000000-AddRevisionCounters.ts`
- Create: `apps/api/src/migrations/1787200000000-AddRevisionCounters.integration.spec.ts` (mateix patró que `1786300000000-AddNodeStandsOn.integration.spec.ts`)
- Modify: `apps/api/src/migrations/index.ts` (import + última entrada de l'array)
- Modify: `apps/api/src/modules/event-segment/entities/event-segment.entity.ts`, `apps/api/src/modules/event/event.entity.ts`
- Regenerate: `docs/DATA_MODEL.md` (`pnpm run docs:model`)

**Interfaces:**
- Produces (BD): `event_segments."revision" int NOT NULL DEFAULT 0`, `event_segments."structureRevision" int NOT NULL DEFAULT 0`, `events."attendanceRevision" int NOT NULL DEFAULT 0`.
- Produces (entitats): `EventSegment.revision: number`, `EventSegment.structureRevision: number`, `Event.attendanceRevision: number`, tots amb `@Column({ type: 'int', default: 0, insert: false, update: false })` — TypeORM no els escriu mai; només els triggers.

Què mou cada comptador:

| Escriptura a | Comptador | Segment afectat |
|---|---|---|
| `node_assignments` (I/U/D) | `event_segments.revision` | `"segmentId"` (vell i nou: `move()` el reapunta) |
| `instance_nodes` (I/U/D) | `event_segments.revision` | el de la seua `figure_instances` |
| `figure_instances` (I/U/D) | `event_segments.structureRevision` | `"segmentId"` vell i nou |
| `event_segments` (U directe: nom, notes, publicar, ordre) | `structureRevision` (ell mateix) | — |
| `attendances` (I/U/D) | `events.attendanceRevision` | `"eventId"` |

- [ ] **Step 1: Test d'integració que falla.** Munta l'esquema fins a la migració anterior, sembra amb SQL cru (event, 2 segments, plantilla, 1 figura *snapshotted* per segment, 2 `instance_nodes`, 2 persones), aplica la migració i comprova (helper `rev(segmentId) → { revision, structureRevision }`, `att(eventId) → number`):

```ts
it('adds the three counters at 0 to existing rows');
it('node_assignments: INSERT, UPDATE and DELETE each bump revision by 1 and leave structureRevision alone');
it('node_assignments: re-pointing segmentId bumps both the old and the new segment');
it('instance_nodes: INSERT/UPDATE/DELETE bump revision of the owning segment');
it('figure_instances: INSERT, UPDATE (label) and DELETE bump structureRevision, not revision');
it('figure_instances: moving to another segment bumps structureRevision of both');
it('event_segments: a direct UPDATE (name, isPublished) bumps its own structureRevision exactly once');
it('event_segments: a trigger-driven bump does not also bump structureRevision');   // la guarda
it('deleting a figure with nodes and assignments (cascade) does not fail and bumps structureRevision');
it('deleting a segment or an event (cascade) does not fail');
it('attendances: INSERT, UPDATE and DELETE each bump events.attendanceRevision by 1');
it('a segment in another event is never touched');
it('10 concurrent INSERTs into node_assignments on separate connections leave revision at +10');   // Review Focus 5
it('down() drops the triggers, the functions and the columns; writes keep working');
```

Per al test concurrent: 10 `queryRunner` independents, `Promise.all`, 10 nodes diferents (la unicitat és per node).

- [ ] **Step 2:** `nx run api:test-integration --testFile=apps/api/src/migrations/1787200000000-AddRevisionCounters.integration.spec.ts` → FALLA (la migració no existix).
- [ ] **Step 3: Escriu la migració.** `up()` executa, en este ordre, els tres `ALTER TABLE … ADD COLUMN` i este SQL (un `queryRunner.query` per sentència):

```sql
CREATE FUNCTION muixer_bump_assignment_segment() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."segmentId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."segmentId"; END IF;
  UPDATE "event_segments" SET "revision" = "revision" + 1 WHERE "id" IN (old_id, new_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION muixer_bump_node_segment() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."figureInstanceId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."figureInstanceId"; END IF;
  -- On a cascade from figure_instances the parent row is already gone: 0 rows, and the
  -- figure_instances trigger has bumped structureRevision.
  UPDATE "event_segments" SET "revision" = "revision" + 1
   WHERE "id" IN (SELECT "segmentId" FROM "figure_instances" WHERE "id" IN (old_id, new_id));
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION muixer_bump_instance_segment() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."segmentId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."segmentId"; END IF;
  UPDATE "event_segments" SET "structureRevision" = "structureRevision" + 1 WHERE "id" IN (old_id, new_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

-- A direct UPDATE of the segment (name, notes, isPublished, sortOrder) is a structure change.
-- The bumps above already changed a counter, so they pass through untouched.
CREATE FUNCTION muixer_guard_segment_structure() RETURNS trigger AS $$
BEGIN
  IF NEW."revision" = OLD."revision" AND NEW."structureRevision" = OLD."structureRevision" THEN
    NEW."structureRevision" := OLD."structureRevision" + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION muixer_bump_event_attendance() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."eventId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."eventId"; END IF;
  UPDATE "events" SET "attendanceRevision" = "attendanceRevision" + 1 WHERE "id" IN (old_id, new_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_node_assignments_revision" AFTER INSERT OR UPDATE OR DELETE ON "node_assignments"
  FOR EACH ROW EXECUTE FUNCTION muixer_bump_assignment_segment();
CREATE TRIGGER "trg_instance_nodes_revision" AFTER INSERT OR UPDATE OR DELETE ON "instance_nodes"
  FOR EACH ROW EXECUTE FUNCTION muixer_bump_node_segment();
CREATE TRIGGER "trg_figure_instances_revision" AFTER INSERT OR UPDATE OR DELETE ON "figure_instances"
  FOR EACH ROW EXECUTE FUNCTION muixer_bump_instance_segment();
CREATE TRIGGER "trg_event_segments_revision" BEFORE UPDATE ON "event_segments"
  FOR EACH ROW EXECUTE FUNCTION muixer_guard_segment_structure();
CREATE TRIGGER "trg_attendances_revision" AFTER INSERT OR UPDATE OR DELETE ON "attendances"
  FOR EACH ROW EXECUTE FUNCTION muixer_bump_event_attendance();
```

Afig al comentari de la classe: `// ponytail: row-level triggers — a 200-row bulk import bumps the segment 200 times inside one transaction (clients only see the last value). Switch to statement-level triggers with transition tables if imports get slow.` `down()` fa `DROP TRIGGER` ×5, `DROP FUNCTION` ×5, `DROP COLUMN` ×3.

- [ ] **Step 4:** registra la migració a `index.ts`; afig els tres camps a les entitats; `pnpm run docs:model`.
- [ ] **Step 5:** el spec PASSA. Després **tota** la suite: `nx run api:test-integration` i `nx test api` → verds (comprova sobretot `snapshot-race`, `attendance-summary-race`, `figure-instance-sort-order` i el *sync*: són els que escriuen en massa o amb bloquejos).
- [ ] **Step 6: Commit** — `feat(api): add revision counters maintained by triggers`

---

### Task 3: API — endpoints de revisió

**Files:**
- Create: `libs/shared/src/interfaces/segment-revision.interface.ts` (exporta'l des del mateix barril que `MeSegment`)
- Create: `apps/api/src/modules/event-segment/segment-revision.service.ts` + `.spec.ts`
- Modify: `apps/api/src/modules/event-segment/event-segment.module.ts` (provider + export), `event-segment.controller.ts`
- Modify: `apps/api/src/modules/me/me.service.ts`, `me.controller.ts` (+ specs)

**Interfaces:**
- Consumes: columnes de la Task 2.
- Produces:

```ts
// @muixer/shared
/** Staff view: what changed since the last poll decides what to refetch. */
export interface SegmentRevision {
  /** Nodes and assignments of the segment's figures (`assignment-state`). */
  state: number;
  /** Figures added/removed/moved/edited, or the segment itself. */
  structure: number;
  /** Any attendance write of the event. */
  attendance: number;
}
/** Member view: one opaque number; it moves whenever the published projection may have changed. */
export interface MeSegmentRevision { revision: number; }

// apps/api
SegmentRevisionService.get(eventId: string, segmentId: string, options?: { onlyPublished?: boolean }): Promise<SegmentRevision>
// 1 consulta (event_segments JOIN events). NotFoundException si el segment no és d'eixe event
// o, amb onlyPublished, si no està publicat.
```

- `GET /events/:eventId/segments/:segmentId/revision` (TECHNICAL/ADMIN, hereta els `@Roles` del controlador) → `SegmentRevision`.
- `GET /me/events/:eventId/segments/:segmentId/revision` (MEMBER/TECHNICAL/ADMIN) → `MeSegmentRevision`, amb `revision = state + structure` i `onlyPublished: true` (404 igual que la projecció). **No** exposa `attendance`.
- Les dues amb `@ApiOperation` i `ParseUUIDPipe` als dos paràmetres, com els veïns.

- [ ] **Step 1: Tests que fallen.**

```ts
// segment-revision.service.spec.ts (repositori simulat)
it('returns state, structure and attendance of the segment');
it('throws NotFoundException when the segment does not belong to the event');
it('throws NotFoundException for an unpublished segment when onlyPublished is set');
it('runs a single query');

// event-segment.controller.spec.ts
it('GET :segmentId/revision delegates to SegmentRevisionService.get(eventId, segmentId)');

// me.service.spec.ts
it('findSegmentRevision returns { revision: state + structure } and asks for onlyPublished');
it('findSegmentRevision never exposes attendance');   // expect(Object.keys(result)).toEqual(['revision'])
```

- [ ] **Step 2:** `nx test api --testFile=<cada spec>` → FALLEN.
- [ ] **Step 3: Implementa** el servei (un `findOne` amb `relations: { event: true }` i `select` dels tres camps, o `createQueryBuilder`), `MeService.findSegmentRevision(eventId, segmentId)` i les dues rutes.
- [ ] **Step 4:** specs PASSEN; `nx lint api`; alça l'API (`nx serve api`) i comprova a Swagger (`/api/docs`) que apareixen les dues rutes i tornen 200/404.
- [ ] **Step 5: Commit** — `feat(api): expose segment revision endpoints for staff and members`

---

### Task 4: API — cache de projecció per segell de revisió

**Files:**
- Modify: `apps/api/src/modules/event-segment/projection.service.ts`
- Test: `apps/api/src/modules/event-segment/projection.service.spec.ts`

**Interfaces:**
- Consumes: `EventSegment.revision`, `.structureRevision`, `Event.attendanceRevision` (ja venen al `findOne` del segment amb `relations: { event: true }`).
- Produces: `getProjection()` manté la signatura i el resultat. Constants exportades: `PROJECTION_CACHE_TTL_MS = 60_000`, `PROJECTION_CACHE_MAX_ENTRIES = 200`.

Disseny: les dues primeres consultes (segment + event, i llista de segments per a prev/next) **es fan sempre**: donen el 404, respecten `onlyPublished` i porten el segell. La resta (figures, nodes, assignacions, assistències, conflictes) és el «cos» i es guarda en un `Map<segmentId, { stamp: string; expiresAt: number; body: Promise<Body> }>`, amb `stamp = \`${revision}:${structureRevision}:${attendanceRevision}\``. Es guarda la **promesa**, de manera que 100 peticions simultànies després d'un canvi calculen el cos una sola vegada. Si la promesa falla, l'entrada s'esborra. Si el mapa passa de `PROJECTION_CACHE_MAX_ENTRIES`, es buida sencer. El segell es llig **abans** de calcular el cos, per tant un cos guardat mai és més vell que el seu segell.

- [ ] **Step 1: Tests que fallen.**

```ts
it('computes the body once for two calls with the same stamp');           // getNodesByInstances cridat 1 vegada
it('recomputes when revision changes');
it('recomputes when structureRevision changes');
it('recomputes when attendanceRevision changes');
it('recomputes after PROJECTION_CACHE_TTL_MS even with the same stamp');   // jest.useFakeTimers
it('shares one in-flight computation between concurrent callers');         // Promise.all de 5 crides → 1 càlcul
it('does not cache a failed computation');
it('still returns 404 for an unpublished segment with onlyPublished, even when the body is cached');
it('computes prevSegmentId/nextSegmentId on every call (staff and member views differ)');
```

- [ ] **Step 2:** `nx test api --testFile=apps/api/src/modules/event-segment/projection.service.spec.ts` → els nous FALLEN, els existents PASSEN.
- [ ] **Step 3: Implementa.** Extrau el cos a `private buildBody(eventId, segmentId): Promise<…>` i posa el mapa com a camp privat del servei. Comentari: `// ponytail: per-process Map; correct with N processes (each has its own), just less effective.`
- [ ] **Step 4:** spec sencer PASSA; `nx run api:test-integration --testFile=apps/api/src/modules/event-segment/distribution-projection-nodes-equivalence.integration.spec.ts` PASSA.
- [ ] **Step 5: Commit** — `perf(api): cache the segment projection until its revision changes`

---

### Task 5: `@muixer/shared` — bucle de polling de revisió

Una sola peça, sense Angular ni tipus del DOM, que usen el Dashboard i la PWA.

**Files:**
- Create: `libs/shared/src/utils/revision-poller.util.ts` + `.spec.ts`
- Modify: el barril de `libs/shared` (export)

**Interfaces:**
- Produces:

```ts
export const DASHBOARD_REVISION_POLL_MS = 3_000;
export const PWA_REVISION_POLL_MS = 30_000;
export const PWA_REVISION_JITTER_MS = 5_000;

/** The slice of `document` the poller needs (kept structural: libs/shared has no DOM lib). */
export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface RevisionPollerOptions<T> {
  /** Reads the current revision. A rejection is ignored and retried on the next tick. */
  fetch: () => Promise<T>;
  /** Called when the revision differs from the last accepted one. Resolve `false` to keep the
   *  previous baseline (the change was not applied) so the next tick reports it again. */
  onChange: (next: T, previous: T) => boolean | void | Promise<boolean | void>;
  intervalMs: number;
  /** Extra random delay in [0, jitterMs) added to every wait. Default 0. */
  jitterMs?: number;
  /** While it returns true a tick fetches nothing and only schedules the next one. */
  isPaused?: () => boolean;
  /** Default: deep equality via JSON.stringify. */
  isEqual?: (a: T, b: T) => boolean;
  visibility: VisibilitySource;
  random?: () => number;
}

export interface RevisionPoller { start(): void; stop(): void; }
export function createRevisionPoller<T>(options: RevisionPollerOptions<T>): RevisionPoller;
```

Comportament fixat:
- `start()` fa una consulta immediata si és visible; la primera resposta bona fixa la referència **sense** cridar `onChange`.
- Cada espera és `intervalMs + random() * jitterMs`, programada amb `setTimeout` **després** que acabe la consulta anterior (mai dues consultes solapades).
- Ocult: es cancel·la el temporitzador i no es consulta. En tornar a `visible`: una consulta immediata (i cap si ja n'hi ha una en vol).
- `onChange` que resol `false` o llança → la referència no avança.
- `stop()` cancel·la temporitzador i *listener*; una resposta que arribe després no crida `onChange`. `start()` dues vegades no duplica res.

- [ ] **Step 1: Tests que fallen** (`vi.useFakeTimers()`, un `VisibilitySource` fals amb `setVisible(bool)`):

```ts
it('fetches immediately on start and does not call onChange for the first value');
it('calls onChange(next, previous) when a later value differs');
it('does not call onChange when the value is equal');
it('waits intervalMs + random()*jitterMs between polls');            // random: () => 0.5, jitter 5000 → 32 500
it('never overlaps two fetches when a fetch outlasts the interval');
it('skips the fetch while paused and resumes on the next tick');
it('does not fetch while hidden and has no pending timer');           // vi.getTimerCount() === 0
it('fetches once, immediately, when becoming visible again');         // Review Focus 2
it('ignores a rejected fetch, keeps the baseline and keeps polling'); // Review Focus 3
it('keeps the previous baseline when onChange resolves false');
it('keeps the previous baseline when onChange throws');
it('stop() cancels the timer, removes the listener and ignores an in-flight result');
it('start() twice does not double the polling');
```

- [ ] **Step 2:** `nx test shared --testFile=libs/shared/src/utils/revision-poller.util.spec.ts` → FALLA. (Si el projecte de tests de la llibreria té un altre nom, mireu-lo a `libs/shared/project.json`.)
- [ ] **Step 3: Implementa** `createRevisionPoller`.
- [ ] **Step 4:** PASSA; `nx build api` continua compilant (la llibreria no pot dependre de tipus del DOM).
- [ ] **Step 5: Commit** — `feat(shared): add a visibility-aware revision poller`

---

### Task 6: Dashboard — sincronització en viu del workspace i de la projecció

**Files:**
- Modify: el servei del Dashboard que ja té `getByEvent()` per a segments (`EventSegmentService`): afig `getRevision`
- Modify: `apps/dashboard/src/app/features/pinyes/services/segment-workspace-state.service.ts`
- Modify: `apps/dashboard/src/app/features/pinyes/components/segment-workspace/segment-workspace.component.ts`
- Modify: `apps/dashboard/src/app/features/pinyes/components/projection-view/projection-view.component.ts`
- Test: els `.spec.ts` germans
- Docs: `docs/manual/12-assignacio-troncs.md`, `13-assignacio-pinyes.md`, `16-previsualitza-i-projeccio.md`; `docs/PINYES_MODULE.md`; `docs/REQUEST_AUDIT.md` (fila P5)

**Interfaces:**
- Consumes: `createRevisionPoller`, `DASHBOARD_REVISION_POLL_MS`, `SegmentRevision`, `reloadAssignmentState()` (Task 1), `GET …/revision` (Task 3).
- Produces:
  - `EventSegmentService.getRevision(eventId: string, segmentId: string): Observable<SegmentRevision>`
  - `SegmentWorkspaceStateService.liveSyncPaused: WritableSignal<boolean>` (per defecte `false`)
  - `SegmentWorkspaceStateService.startLiveSync(): void` / `stopLiveSync(): void`
  - `SegmentWorkspaceStateService.applyRemoteRevision(next: SegmentRevision, previous: SegmentRevision): Promise<boolean>` (públic perquè es puga provar sense temporitzadors)

Regles d'`applyRemoteRevision`:

| Ha canviat | Acció |
|---|---|
| `structure` | `reloadInstances()` (ja inclou nodes, assignacions, distribució i conflictes) → `true` |
| només `state` | `reloadAssignmentState()` → resol el que emeta (`false` si s'ha descartat) |
| `attendance` (sol o amb els altres) | a més, `state.refreshPersonList()` (el `PersonPanelComponent` ja recarrega el *roster* amb eixe *trigger*) |

Regles del bucle del workspace:
- `isPaused` = `state.pendingOperations().length > 0 || liveSyncPaused()`. Mentre està pausat la referència no avança, així que el canvi s'aplica al primer tic lliure.
- `SegmentWorkspaceComponent` posa `ws.liveSyncPaused` a `true` mentre la pestanya activa és `distribucio` o `nodes` (s'hi editen posicions i nodes a mà; en eixir, `refresh()` ja recarrega) i a `false` a la resta, amb un `effect`.
- `load()` reinicia el bucle (canvi de segment amb prev/next = referència nova); `DestroyRef.onDestroy` → `stopLiveSync()`. `startLiveSync()` es crida al final de `load()`.
- L'eco propi (el tècnic assigna → canvia `state`) costa 1 petició `assignment-state` per tic com a màxim. Acceptat: 5 tècnics actius ≈ 100 consultes + ≤ 100 recàrregues per minut, lluny dels 600/min/IP. Comentari: `// ponytail: own writes trigger one redundant state reload per tick; return the new revision from mutation responses if this ever shows up in the rate limit.`
- Es manté `ROSTER_MAX_AGE_MS` (10 s en clicar un node) com a xarxa de seguretat si el polling falla.

Projecció (`ProjectionViewComponent`, incrustada i fullscreen):
- `loadSegment(options?: { silent?: boolean })`: amb `silent`, ni `loading.set(true)` ni *toast* d'error; es conserva `segmentData` si falla.
- Un `createRevisionPoller` propi (mateix interval) amb `onChange` → `loadSegment({ silent: true })` davant **qualsevol** canvi de `state`, `structure` o `attendance`. Es reinicia a `navigateSegment` i es para a `ngOnDestroy`.
- Açò tanca el P5 de `REQUEST_AUDIT`: la previsualització incrustada deixa de dependre de remuntar-se per a estar al dia.

- [ ] **Step 1: Tests que fallen.**

```ts
// segment-workspace-state.service.spec.ts
it('applyRemoteRevision: a state-only change calls reloadAssignmentState and not reloadInstances');
it('applyRemoteRevision: a structure change calls reloadInstances once, even if state changed too');
it('applyRemoteRevision: an attendance change refreshes the person list and reloads no figures');
it('applyRemoteRevision resolves false when reloadAssignmentState discarded the response');   // Review Focus 1
it('polls getRevision every DASHBOARD_REVISION_POLL_MS after load()');
it('does not poll while an optimistic operation is pending');
it('does not poll while liveSyncPaused is true and catches up when it turns false');
it('load() for another segment restarts the baseline: no reload for the first revision of the new segment');
it('stops polling when the service is destroyed');
it('a failing getRevision shows no toast and keeps polling');                                  // Review Focus 3

// segment-workspace.component.spec.ts
it('pauses live sync on the distribucio and nodes tabs and resumes it on pinyes, troncs and previsualitza');

// projection-view.component.spec.ts
it('reloads the projection silently when the revision changes: no spinner, segmentData replaced');
it('keeps the current projection and shows no toast when a silent reload fails');
it('restarts the poller for the new segment on navigateSegment');
it('stops polling on destroy');
```

- [ ] **Step 2:** `nx test dashboard --testFile=<cada spec>` → FALLEN.
- [ ] **Step 3: Implementa** en este ordre: `getRevision` → `applyRemoteRevision` → bucle al servei → `effect` de pausa al component → projecció. Per a `fetch` usa `firstValueFrom(this.segmentService.getRevision(...))` i `visibility: inject(DOCUMENT)`.
- [ ] **Step 4:** specs PASSEN; `nx lint dashboard`.
- [ ] **Step 5: Verificació a mà amb dos navegadors** (skill `run-muixer-app`; dues sessions TECHNICAL al mateix segment):
  - A assigna una persona → B la veu en ≤ 3 s sense tocar res, i el seu node seleccionat i el text del cercador no es perden.
  - A i B assignen al mateix node alhora → un rep «Este lloc ja està ocupat» i veu l'ocupant.
  - A afig una figura des de Distribució → B (a Pinyes) la veu aparéixer.
  - Es marca una assistència (PWA o confirmació) → el *roster* de B i el mode «Assistència» s'actualitzen sols.
  - B arrossega una persona mentre A assigna → l'arrossegament no es talla. **Si es talla**, afig a `isPaused` l'estat d'arrossegament que exposen `FigureCanvasComponent`/`PersonPanelComponent` i un test que ho fixe.
  - B desfà (Ctrl+Z) una acció sobre un node que A ha canviat després → error controlat (toast), cap estat incoherent després del següent tic.
  - Projecció fullscreen oberta en una tercera pestanya: reflectix els canvis sense reiniciar zoom ni posició. **Si `lib-pinya-projection` torna a enquadrar** en canviar `data` amb el mateix `segment.id`, corregiu-ho a `libs/pinyes-render` (enquadrar només quan canvia `segment.id` o el conjunt d'`instances`) amb un test a `pinya-projection.component.spec.ts`: `it('keeps the stage transform when data is replaced for the same segment')` (Review Focus 4).
  - Pestanya de la xarxa: amb la pestanya en segon pla no ix cap `…/revision`.
- [ ] **Step 6: Documentació.** Manual 12, 13 i 16: una frase a cada pàgina dient que els canvis d'altres tècnics i l'assistència apareixen sols en pocs segons (sense captures noves: no canvia res visualment). `PINYES_MODULE.md`: secció curta «Sincronització en viu» (què consulta, cada quant, què recarrega, quan es pausa). `REQUEST_AUDIT.md`: lleva la fila P5.
- [ ] **Step 7: Commit** — `feat(dashboard): keep the segment workspace and projection in sync with other technicians`

---

### Task 7: PWA — polling de la projecció i refresc en tornar a la pestanya

**Files:**
- Modify: `apps/pwa/src/app/features/events/services/projection.service.ts`
- Modify: `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.ts` i `.html`
- Modify: `apps/pwa/src/app/features/events/event-detail/event-detail.component.ts`
- Test: els `.spec.ts` germans
- Docs: `docs/manual/19-pwa.md`, `docs/PWA_UI.md`

**Interfaces:**
- Consumes: `createRevisionPoller`, `PWA_REVISION_POLL_MS`, `PWA_REVISION_JITTER_MS`, `MeSegmentRevision`, `getEventPhase` (`@muixer/shared`), `GET /me/…/revision` (Task 3).
- Produces: `ProjectionService.getRevision(eventId: string, segmentId: string): Observable<MeSegmentRevision>` (amb el mateix `timeout(PROJECTION_TIMEOUT_MS)`).

Regles de `SegmentProjectionComponent`:
- El bucle només corre si `getEventPhase(data.event.date, data.event.startTime)` és `'day'` o `'started'` (dia de l'event). Fora d'eixe dia, cap petició de revisió.
- `intervalMs: PWA_REVISION_POLL_MS`, `jitterMs: PWA_REVISION_JITTER_MS`. `onChange` → `projectionResource.reload()`.
- S'arranca/reinicia amb un `effect` sobre `eventId()`/`segmentId()` + dades carregades (prev/next canvia de segment sense destruir el component) i es para a `ngOnDestroy`.
- **Recàrrega silenciosa:** `rxResource.reload()` conserva `value()` mentre recarrega, però `isLoading()` passa a `true` i la plantilla actual canviaria la projecció per l'*spinner* (destruint `lib-pinya-projection`, la càmera i el cercador). La plantilla ha de mostrar l'*spinner* només si `isLoading() && !data()`. I `data` ha de conservar l'última dada bona si una recàrrega falla: hui `data()` torna `undefined` quan hi ha `error()`; guarda l'últim valor bon en un `linkedSignal`/signal propi que només es buida quan canvien `eventId`/`segmentId`.
- No es crida `flyToHighlighted()` en una recàrrega silenciosa.

Regles d'`EventDetailComponent`: en `visibilitychange` → `visible`, torna a carregar event, segments («on sou») i estadístiques amb la mateixa funció que el *pull-to-refresh* (l. ~183-185), sense el gest. Mateix patró de *listener* que `app-update.service.ts`. Sense polling.

- [ ] **Step 1: Tests que fallen.**

```ts
// projection.service.spec.ts
it('getRevision GETs /me/events/:eventId/segments/:segmentId/revision');

// segment-projection.component.spec.ts
it('polls the revision only on the day of the event');                     // phase 'before' i 'after' → 0 peticions
it('reloads the projection when the revision changes');
it('keeps the projection mounted during a background reload (no spinner)'); // Review Focus 4
it('keeps selectedParticipant and an open picker across a background reload');
it('does not re-trigger the flight on a background reload');
it('keeps showing the last projection when a background reload fails');     // Review Focus 3
it('keeps showing the last projection when the revision endpoint answers 404'); // segment despublicat
it('restarts polling with a fresh baseline after prev/next');
it('still shows the spinner on first load and when navigating to another segment');
it('stops polling on destroy');

// event-detail.component.spec.ts
it('reloads event, segments and stats when the tab becomes visible again');
it('does not reload while hidden and removes the listener on destroy');
```

- [ ] **Step 2:** `nx test pwa --testFile=<cada spec>` → FALLEN.
- [ ] **Step 3: Implementa** (servei → component i plantilla → detall de l'event).
- [ ] **Step 4:** specs PASSEN; `nx lint pwa`.
- [ ] **Step 5: Verificació a mà** (skill `run-muixer-app`; un event **d'avui** amb un segment publicat; PWA en vista mòbil): un tècnic canvia una assignació al Dashboard → la PWA la mostra en ≤ 35 s sense perdre el zoom; amb la pestanya oculta no ix cap petició i en tornar ix una de sola; en un event d'un altre dia no ix cap `…/revision`.
- [ ] **Step 6: Documentació.** `docs/manual/19-pwa.md`: la projecció s'actualitza sola el dia de l'event (fins a mig minut de retard) i el detall de l'event es refresca en tornar a l'app. `docs/PWA_UI.md`: nota curta al costat del *pull-to-refresh*.
- [ ] **Step 7: Commit** — `feat(pwa): refresh the segment projection when its revision changes`

---

### Task 8: Caddy — límit propi per a la consulta de revisió

120 membres darrere d'una mateixa IP (Wi-Fi del local, CGNAT) fan ~220 consultes de revisió per minut: més d'un terç dels 600/min/IP de la zona `api`. La consulta és 1 `SELECT` d'una fila, així que pot tindre un límit ample sense risc.

**Files:**
- Modify: `apps/dashboard/Caddyfile` (bloc `{$PWA_SITE_ADDRESS}`; comentari de capçalera)
- Docs: `CLAUDE.md` (frase del rate limiting al Backend), `docs/DEPLOY_PRE.md` si descriu els límits

**Interfaces:** cap de codi. Valor fixat: `/api/me/events/*/segments/*/revision` → **3 000 req/min per IP**, i eixes peticions **no** compten a la zona `api`.

- [ ] **Step 1:** Confirma la sintaxi de `match` dins d'una `zone` de `caddy-ratelimit` (README del plugin que s'instal·la al Dockerfile del dashboard) i escriu al bloc de la PWA:

```
zone revision {
    match {
        path_regexp ^/api/me/events/[^/]+/segments/[^/]+/revision$
    }
    key {remote_host}
    events 3000
    window 1m
}
zone api {
    match {
        not path_regexp ^/api/me/events/[^/]+/segments/[^/]+/revision$
    }
    key {remote_host}
    events 600
    window 1m
}
```

El bloc del Dashboard no canvia (≤ 5 tècnics).

- [ ] **Step 2: Verifica.** `caddy validate --config apps/dashboard/Caddyfile` dins la imatge (o `pnpm run docker:pre:up` en local) → vàlid. Amb l'stack alçat: 700 GET seguits a la ruta de revisió → cap 429; 700 GET a `/api/me/events` → 429 a partir del 601.
- [ ] **Step 3:** actualitza el comentari de capçalera del Caddyfile i la frase de `CLAUDE.md`.
- [ ] **Step 4: Commit** — `chore(infra): give the PWA revision poll its own rate-limit zone`

---

### Task 9: Tancament — deute, documentació d'agents i verificació global

**Files:**
- Modify: `docs/DEBT.md` (esborra la fila **A1**; no la marques com a resolta)
- Modify: `docs/DATA_FRESHNESS.md` (capçalera: estat «implementat», enllaç a este pla; §5 i §7 alineats amb el que s'ha fet: sense revisió per figura, segell de cache, intervals reals)
- Modify: `CLAUDE.md`: mòdul `event-segment` (endpoints de revisió, cache de projecció, triggers), mòdul `me` (ruta `…/revision`), secció PWA (la projecció fa polling el dia de l'event), «Key components» de Pinyes (sincronització en viu), `docs/MAP.md` (`pnpm run docs:map`)

- [ ] **Step 1:** fes els canvis de documentació; `pnpm run docs:map && pnpm run docs:model` → sense diff inesperat.
- [ ] **Step 2:** `pnpm run ci:local` → verd. `nx run api:test-integration` → verd. `pnpm run lint:dead` → cap export nou sense consumidor.
- [ ] **Step 3: Prova de càrrega curta** en local o a pre (opcional però recomanada abans d'un assaig real): 120 clients simulats consultant `/me/…/revision` cada 30–35 s durant 2 min mentre es fan 20 assignacions → comprova als logs de Postgres que les projeccions calculades són ≤ 2 per segment i minut, i que el p95 d'una assignació no empitjora respecte d'abans.
- [ ] **Step 4: Commit** — `docs: document live data freshness and close debt A1`
