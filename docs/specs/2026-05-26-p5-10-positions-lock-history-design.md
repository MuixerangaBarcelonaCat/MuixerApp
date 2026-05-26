# P5.10 — Posicions, Lock d'Assignacions i Consulta Històrica

> **Data:** 26 de maig de 2026
> **Estat:** Implementada
> **Fases:** F1 (Fonaments) → F2 (Workflow) → F3 (Historials)
> **Prerequisits:** P5.1–P5.9 implementats

---

## 1. Objectiu

Completar el cicle de vida del mòdul de pinyes amb tres capacitats que falten:

1. **Gestió de posicions (tags)** — CRUD complet de posicions muixerangueres + assignació a persones des del dashboard.
2. **Lock d'assignacions** — Immutabilitat automàtica de les assignacions després d'un període configurable post-event.
3. **Consulta històrica** — Tres vistes d'historial (per persona, per event, per figura/família) integrades als llocs naturals del dashboard.

Addicionalment, es millora el workflow d'assignació amb un **filtre intel·ligent** que auto-prioritza persones per posició coincident.

---

## 2. Decisions de disseny

| Decisió | Resultat |
|---------|----------|
| Position vs positionType | **Relacionar per slug convention, no unificar.** `Position` (tag de membre) i `FigureNode.positionType` (string lliure al canvas) segueixen sent camps independents. El matching es fa per `Position.slug === FigureNode.positionType` quan coincideixen. El canvas no es toca. |
| Registre històric | **Les assignacions existents són el registre.** No cal pas de confirmació addicional. |
| Lock d'assignacions | **Automàtic a 2 dies post-event** (configurable via env var). Afecta escriptures, no lectures. |
| Ubicació UI historials | **Integrades als llocs naturals**: tab a person-detail, secció a event-detail, tab a vista família. |
| Filtre al panel d'assignació | **Auto-priorització**: en seleccionar un node, les persones amb tag coincident apareixen primer. No s'amaguen les altres. |
| Ordre d'implementació | F1 (Config/Tags + Lock) → F2 (Filtre intel·ligent) → F3 (Historials) |

---

## 3. Fase 1: Fonaments

### 3.1 Config/Tags — CRUD de posicions

#### 3.1.1 Backend

**Estat actual:** `PositionController` exposa `GET /positions`, `GET /positions/:id`, `POST /positions`, `PATCH /positions/:id`. `PositionService.remove()` existeix però no té ruta al controller.

**Canvis:**

| Canvi | Detall |
|-------|--------|
| `DELETE /positions/:id` | Nova ruta al controller. Guard: 409 Conflict si existeixen `person_positions` amb aquesta posició (comprovar amb query `SELECT COUNT(*) FROM person_positions WHERE positions_id = :id`). Missatge: "No es pot esborrar: hi ha persones amb aquesta posició assignada." |
| `GET /positions` amb count | Retornar `personCount` per cada posició (nombre de persones assignades). Requereix LEFT JOIN o subquery a `person_positions`. |
| Validació slug únic | `PositionService.create()` i `update()` han de llançar 409 si el `slug` ja existeix (ja està com a `unique: true` a l'entity, però cal un missatge clar). |

**Endpoints finals:**

| Mètode | Ruta | Canvi |
|--------|------|-------|
| `GET` | `/positions` | Afegir `personCount` al response |
| `GET` | `/positions/:id` | Sense canvis |
| `POST` | `/positions` | Validació slug únic amb 409 |
| `PATCH` | `/positions/:id` | Validació slug únic amb 409 |
| `DELETE` | `/positions/:id` | **NOU** — guard referencial |

**Response ampliada de `GET /positions`:**

```typescript
interface PositionWithCount {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  longDescription: string | null;
  color: string | null;
  zone: FigureZone | null;
  personCount: number;
}
```

**Tests backend (nous):**

- `position.service.spec.ts`:
  - `findAll()` retorna posicions amb `personCount`
  - `create()` amb slug duplicat → 409
  - `update()` amb slug duplicat (diferent ID) → 409
  - `remove()` exitós quan no té persones
  - `remove()` amb persones assignades → 409
- `position.controller.spec.ts`:
  - `DELETE /positions/:id` retorna 204
  - `DELETE /positions/:id` amb persones → 409

#### 3.1.2 Frontend — `/config/tags`

Substituir `ConfigPlaceholderComponent` per `PositionListComponent` a la ruta `config/tags`.

**`PositionListComponent`** (`apps/dashboard/src/app/features/config/components/position-list/`):

- Taula `app-data-table` amb columnes:
  - **Color** — cercle de preview del color (12px)
  - **Nom** — text principal
  - **Slug** — text secundari monospace
  - **Zona** — badge amb zona (`PINYA`, `TRONC`, etc.) o "—" si null
  - **Persones** — comptador `personCount`
- Accions per fila: Editar, Eliminar (amb `app-confirm-dialog`)
- Botó capçalera: "Nova posició" → obre `PositionFormModalComponent`
- `app-page-header` amb títol "Etiquetes" i badge amb total

**`PositionFormModalComponent`** (`apps/dashboard/src/app/features/config/components/position-form-modal/`):

- Modal `<dialog>` per crear i editar posicions
- Camps:
  - **Nom** — `input text`, required
  - **Slug** — `input text`, auto-generat des del nom (kebab-case), editable. Readonly en mode edició (el frontend no envia `slug` al `PATCH`; el backend ho accepta però no és l'ús previst).
  - **Descripció curta** — `input text`, opcional
  - **Descripció llarga** — `textarea`, opcional
  - **Color** — `input type="color"` + preview badge. Opcional.
  - **Zona** — `select` amb opcions de `FigureZone` + opció buida. Opcional.
- Validació: nom i slug requerits
- Error 409: mostrar toast amb missatge del backend

**`PositionService`** (`apps/dashboard/src/app/features/config/services/position.service.ts`):

- `getAll(): Observable<PositionWithCount[]>` → `GET /positions`
- `getOne(id): Observable<Position>` → `GET /positions/:id`
- `create(dto): Observable<Position>` → `POST /positions`
- `update(id, dto): Observable<Position>` → `PATCH /positions/:id`
- `remove(id): Observable<void>` → `DELETE /positions/:id`

**Tests frontend (nous):**

- `PositionListComponent`: renderitza taula, obre modal, elimina amb confirmació
- `PositionFormModalComponent`: crea posició, edita posició, mostra error 409
- `PositionService`: crides HTTP correctes per tots els mètodes

### 3.2 Assignació de posicions a persones

#### 3.2.1 Backend

**Sense canvis.** L'endpoint `PATCH /persons/:id` amb `positionIds` ja existeix i funciona.

#### 3.2.2 Frontend — person-detail

**Canvis a `PersonDetailComponent`:**

- Carregar posicions disponibles (`PersonService.getPositions()`) al `ngOnInit`
- Afegir signal `allPositions = signal<Position[]>([])`

**Canvis a `person-detail.component.html`:**

- **Mode lectura**: sense canvis (badges ja es mostren)
- **Mode edició**: substituir la secció read-only de "Posicions" per un **multi-select amb chips**:
  - Llista de checkboxes o chips toggle amb totes les posicions disponibles
  - Cada chip mostra el color de la posició com a fons
  - En desar, envia `positionIds` amb els IDs seleccionats

**Canvis a `save()`**: incloure `positionIds` al payload.

**Tests frontend (nous):**

- `PersonDetailComponent`: mostra posicions en mode lectura, permet seleccionar en mode edició, envia `positionIds` al desar

### 3.3 Lock d'assignacions

#### 3.3.1 Backend

**Nova env var:**

```env
ASSIGNMENT_LOCK_DAYS=2
```

**Lògica de lock:**

Nova funció privada a `NodeAssignmentService`:

```typescript
private async checkEventLock(instance: FigureInstance): Promise<void> {
  const lockDays = parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '2', 10);
  if (lockDays <= 0) return; // 0 = disabled

  const segment = await this.eventSegmentRepository.findOne({
    where: { id: instance.segment.id },
    relations: ['event'],
  });
  if (!segment?.event) return;

  const eventDate = new Date(segment.event.date);
  const lockDate = new Date(eventDate);
  lockDate.setDate(lockDate.getDate() + lockDays);

  if (new Date() > lockDate) {
    throw new ForbiddenException(
      `Les assignacions d'aquest event estan bloquejades (event del ${eventDate.toISOString().slice(0, 10)}, bloqueig després de ${lockDays} dies).`
    );
  }
}
```

**Mètodes afectats** (cridar `checkEventLock()` abans de l'operació):

| Mètode | Acció |
|--------|-------|
| `assign()` | Check lock abans d'assignar |
| `unassign()` | Check lock abans de desassignar |
| `swap()` | Check lock abans d'intercanviar |
| `bulkImport()` | Check lock abans d'importar |
| `upgradeInstance()` | Check lock abans d'upgradar |
| `resetInstance()` | Check lock abans de resetejar |

**Nou endpoint informatiu:**

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/node-assignments/events/:eventId/lock-status` | Retorna `{ locked: boolean, lockDate: string \| null, lockDays: number }` |

Ubicat al `NodeAssignmentController` (coherent amb la resta d'endpoints d'assignació). Permet al frontend saber si l'event està bloquejat sense intentar una escriptura.

**Tests backend (nous):**

- `node-assignment.service.spec.ts`:
  - `assign()` amb event bloquejat → 403
  - `assign()` amb event no bloquejat → OK
  - `unassign()` amb event bloquejat → 403
  - `swap()` amb event bloquejat → 403
  - `bulkImport()` amb event bloquejat → 403
  - `upgradeInstance()` amb event bloquejat → 403
  - `ASSIGNMENT_LOCK_DAYS=0` → lock desactivat

#### 3.3.2 Frontend

**Canvis a `AssignmentCanvasComponent`:**

- Cridar `GET /events/:eventId/lock-status` al inicialitzar
- Si `locked = true`:
  - Banner informatiu a la part superior: "Assignacions bloquejades — l'event va tenir lloc el [data]. Les assignacions es van tancar el [lockDate]."
  - Nodes no-interactius (click desactivat)
  - Panel de persones amagat
  - Toolbar d'accions desactivada (assign, unassign, swap, import, upgrade)
  - Projecció (readonly) segueix funcionant

**Canvis a `SegmentManagerComponent`:**

- Comprovar lock status per l'event
- Si bloquejat: icona de candau (Lock de Lucide) al costat del botó "Assignar" + tooltip "Assignacions bloquejades"

**Canvis a event-detail (assajos i actuacions):**

- Si l'event està bloquejat: badge "Assignacions bloquejades" amb icona Lock

**Tests frontend (nous):**

- `AssignmentCanvasComponent`: mostra banner de lock, desactiva interacció
- `SegmentManagerComponent`: mostra icona de candau quan bloquejat

---

## 4. Fase 2: Workflow — Filtre intel·ligent al panel d'assignació

### 4.1 Backend

**Canvis a `AvailablePersonsService.getAvailablePersons()`:**

Nou query param opcional: `positionType?: string`

Quan `positionType` és present:

1. Fer LEFT JOIN amb `person_positions` + `positions` per marcar si la persona té una `Position` amb `slug = :positionType`
2. Afegir un camp `matchesPosition: boolean` al response `AvailablePersonDto`
3. Ordenar: `matchesPosition DESC` primer, després l'ordre actual (proximity d'alçada o alias)

```typescript
interface AvailablePersonDto {
  // ... camps existents ...
  matchesPosition: boolean;  // NOU
  positions: { id: string; name: string; slug: string; color: string | null }[];  // NOU
}
```

**Alternativa simplificada:** En lloc de fer el JOIN al backend, retornar les `positions` de cada persona i fer el matching al frontend. Això és més flexible i evita canviar la query cada cop que s'afegeix un positionType.

**Decisió: retornar `positions[]` de cada persona.** El LEFT JOIN per `person.positions` és un canvi menor. El frontend fa el sort per `matchesPosition`. Això evita que el backend necessiti conèixer el `positionType` seleccionat.

**Retrocompatibilitat:** Afegir `positions[]` al response és additiu (nou camp). Cap consumidor existent es trenca. El `PersonPanelComponent` simplement ignorava el camp abans, ara el consumeix.

**Canvi concret a `AvailablePersonsService`:**

- Afegir `.leftJoinAndSelect('person.positions', 'positions')` al QueryBuilder
- Incloure `positions` al response DTO

**Tests backend (nous):**

- `available-persons.service.spec.ts`: `getAvailablePersons()` retorna `positions[]` per persona

### 4.2 Frontend

**Canvis a `PersonPanelComponent`:**

- Rebre nou input `activeNodePositionType: string | null` (el `positionType` del node seleccionat)
- Nou `computed` per ordenar:

```typescript
readonly sortedConfirmedPersons = computed(() => {
  const posType = this.activeNodePositionType();
  const persons = this.confirmedPersons();
  if (!posType) return persons;

  return [...persons].sort((a, b) => {
    const aMatch = a.positions?.some(p => p.slug === posType) ? 1 : 0;
    const bMatch = b.positions?.some(p => p.slug === posType) ? 1 : 0;
    return bMatch - aMatch;
  });
});
```

- Les persones amb match apareixen amb un **indicador visual**: petit badge o icona de check al costat del nom, amb el color de la posició coincident.
- Separador visual entre persones amb match i sense match (línia subtil o `opacity-60` per les no-match).

**Canvis a `AssignmentCanvasComponent`:**

- Obtenir el `positionType` del node seleccionat i passar-lo al `PersonPanelComponent` via input.

**Canvis a `AvailablePerson` model:**

```typescript
interface AvailablePerson {
  // ... camps existents ...
  positions: { id: string; name: string; slug: string; color: string | null }[];
}
```

**Tests frontend (nous):**

- `PersonPanelComponent`: ordena per posició coincident, mostra indicador visual
- `AssignmentCanvasComponent`: passa positionType al PersonPanel

---

## 5. Fase 3: Historials

### 5.1 Backend — Endpoints d'historial

#### 5.1.1 Historial per persona

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/persons/:personId/assignment-history` | Historial d'assignacions d'una persona |

**Query params:**

- `page?: number` (default 1)
- `limit?: number` (default 20, max 100)
- `seasonId?: string` (filtre per temporada)

**Response:**

```typescript
interface PersonAssignmentHistory {
  data: PersonAssignmentEntry[];
  meta: { total: number; page: number; limit: number };
}

interface PersonAssignmentEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  segmentName: string;
  instanceId: string;
  figureName: string;        // FigureTemplate.name
  figureSlug: string;
  familyName: string | null; // FigureFamily.name
  nodeLabel: string;         // InstanceNode.label
  positionType: string | null;
  zone: FigureZone;
  z: number;
}
```

**Implementació:** Query sobre `node_assignments` amb JOINs a `instance_nodes`, `figure_instances`, `event_segments`, `events`, `figure_templates`, `figure_families`. Filtre per `person.id`. Ordre: `event.date DESC`.

**Ubicació:** Nou mètode a `NodeAssignmentService` o un nou `AssignmentHistoryService` dedicat. Controller al `NodeAssignmentController`.

#### 5.1.2 Historial per event

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/events/:eventId/assignment-summary` | Resum d'assignacions de totes les figures d'un event |

**Response:**

```typescript
interface EventAssignmentSummary {
  segments: EventSegmentSummary[];
}

interface EventSegmentSummary {
  segmentId: string;
  segmentName: string;
  sortOrder: number;
  figures: EventFigureSummary[];
}

interface EventFigureSummary {
  instanceId: string;
  figureName: string;
  familyName: string | null;
  snapshotted: boolean;
  totalNodes: number;
  assignedNodes: number;
  assignments: {
    nodeLabel: string;
    positionType: string | null;
    zone: FigureZone;
    z: number;
    personAlias: string;
    personId: string;
  }[];
}
```

**Implementació:** Query sobre `event_segments` → `figure_instances` → `instance_nodes` + `node_assignments` → `persons`. Agrupat per segment → instància.

#### 5.1.3 Historial per figura/família

L'endpoint `GET /figure-templates/:templateId/history` **ja existeix**. Canvis:

- Ampliar `FigureHistoryEntry` amb `eventType` i `familyName`
- Afegir filtre opcionals: `seasonId`, `page`, `limit`
- L'endpoint actual retorna totes les instàncies sense paginar — afegir paginació

**Response ampliada:**

```typescript
interface FigureHistoryEntry {
  // ... camps existents ...
  eventType: EventType;     // NOU
  familyName: string | null; // NOU
}
```

**Nou endpoint per família:**

| Mètode | Ruta | Descripció |
|--------|------|-----------|
| `GET` | `/figure-families/:familyId/history` | Historial agregat de totes les variants d'una família |

**Response:** Mateixa estructura que `FigureHistoryEntry[]` però agrega totes les variants.

**Tests backend (nous):**

- `PersonAssignmentHistory`: retorna historial paginat, filtra per temporada
- `EventAssignmentSummary`: retorna resum correcte amb segments i figures
- `FigureFamily history`: retorna historial agregat de totes les variants
- `FigureTemplate history`: retorna `eventType` i `familyName`

### 5.2 Frontend — Historial per persona

**Canvis a `person-detail.component.html`:**

Nova secció "Historial de pinyes" després de la card "Informació de la colla":

- Card col·lapsable (expandida per defecte)
- Taula amb columnes: Data, Event, Segment, Figura, Posició (nodeLabel), Zona
- Paginació amb `app-pagination`
- Filtre per temporada (select dropdown)
- `app-empty-state` si no hi ha historial: "Aquesta persona no té assignacions registrades."
- Les files són clicables → naveguen al detall de l'event

**Nou servei:** `PersonHistoryService` o reutilitzar `NodeAssignmentService` amb un mètode `getPersonHistory(personId, filters)`.

**Tests frontend (nous):**

- `PersonDetailComponent`: renderitza taula d'historial, paginació, filtre temporada, estat buit

### 5.3 Frontend — Historial per event

**Canvis a event-detail (rehearsal-detail / performance-detail):**

Nova secció "Pinyes" al detall d'event (o tab si s'implementa tabs):

- Per cada segment: card amb nom del segment
- Dins de cada segment: llista de figures amb assignacions
- Cada figura mostra:
  - Nom de la figura (amb link a la família si existeix)
  - Badge amb `assignedNodes / totalNodes`
  - Llista d'assignacions: nodeLabel → personAlias (amb badge de color per zona)
- Si l'event està bloquejat: badge "Registre tancat" al costat del títol de la secció
- `app-empty-state` si no hi ha segments/figures: "No hi ha figures assignades a aquest event."

**Tests frontend (nous):**

- Event detail: renderitza secció de pinyes amb segments i figures, estat buit

### 5.4 Frontend — Historial per figura/família

**Canvis a `TemplateListComponent` (tab Famílies):**

Nou botó "Historial" a cada fila de família → obre un modal o navega a una vista d'historial.

**`FamilyHistoryModalComponent`** (o vista dedicada):

- Taula amb columnes: Data, Event, Tipus, Variant, Assignats/Total
- Paginació amb `app-pagination`
- Files clicables → naveguen al detall de l'event
- Filtre per temporada (select dropdown)
- `app-empty-state` si no hi ha historial: "Aquesta família no té instàncies registrades."

**Tests frontend (nous):**

- `FamilyHistoryModalComponent`: renderitza taula, paginació, filtre temporada

---

## 6. Posicions inicials a crear

Un cop implementada la F1, crear manualment les posicions següents via la UI de `/config/tags` per validar el funcionament:

| Nom | Slug | Zona | Color | Coincideix amb positionType |
|-----|------|------|-------|-----------------------------|
| Agulla | `agulla` | PINYA | `#0d9488` | ✅ `agulla` |
| Mans | `mans` | PINYA | `#FFE082` | ✅ `mans` |
| Laterals | `laterals` | PINYA | `#80DEEA` | ✅ `laterals` |
| Vents | `vents` | PINYA | `#A5D6A7` | ✅ `vents` |
| Cordó obert | `cordo-obert` | PINYA | `#FFF9C4` | ✅ `cordo-obert` |
| Tap | `tap` | PINYA | `#be185d` | ✅ `tap` |
| Crossa | `crossa` | PINYA | `#9FA8DA` | ✅ `crossa` |
| Contrafort | `contrafort` | PINYA | `#EF9A9A` | ✅ `contrafort` |
| Primeres | `primeres` | TRONC | `#E53935` | Partial (positionType tronc varia) |
| Segones | `segones` | TRONC | `#FB8C00` | Partial |
| Base | `base` | BASE | `#EEEEEE` | ✅ `base` |

**Nota:** Les posicions del legacy sync (`POSITION_MAPPING` a `person-sync.strategy.ts`) ja creen algunes d'aquestes. Les noves es creen via UI.

---

## 7. Model de dades — Canvis

### 7.1 Entitats existents afectades

| Entitat | Camp | Canvi |
|---------|------|-------|
| Cap | — | No hi ha canvis de schema. Tot el que cal ja existeix. |

**Justificació:** `Position` ja existeix amb tots els camps necessaris. `person_positions` (M:N) ja existeix. `NodeAssignment` ja registra tota la informació d'historial necessària via les relacions existents. L'únic canvi és expositiu (endpoints i UI).

### 7.2 Nova env var

| Variable | Valor per defecte | Descripció |
|----------|-------------------|-----------|
| `ASSIGNMENT_LOCK_DAYS` | `2` | Dies després de la data de l'event per bloquejar assignacions. `0` = desactivat. |

---

## 8. Gestió d'errors

| Situació | Codi HTTP | Missatge (Català) |
|----------|-----------|-------------------|
| Eliminar posició amb persones | 409 | "No es pot esborrar: hi ha persones amb aquesta posició assignada." |
| Slug de posició duplicat | 409 | "L'identificador ja l'utilitza una altra posició. Canvia'l." |
| Assignació en event bloquejat | 403 | "Les assignacions d'aquest event estan bloquejades (event del [data], bloqueig després de [N] dies)." |
| Desassignació en event bloquejat | 403 | (Mateix missatge) |
| Historial persona no trobada | 404 | "Persona no trobada." |
| Historial event no trobat | 404 | "Event no trobat." |

---

## 9. Fitxers afectats per fase

### Fase 1

**Backend:**

| Fitxer | Canvis |
|--------|--------|
| `apps/api/src/modules/position/position.controller.ts` | Afegir `DELETE` endpoint |
| `apps/api/src/modules/position/position.service.ts` | `findAll()` amb `personCount`, `remove()` amb guard referencial, validació slug únic a `create()`/`update()` |
| `apps/api/src/modules/position/position.service.spec.ts` | **NOU** — tests unitaris |
| `apps/api/src/modules/position/position.controller.spec.ts` | **NOU** — tests controller |
| `apps/api/src/modules/node-assignment/node-assignment.service.ts` | `checkEventLock()` private, cridat des de `assign()`, `unassign()`, `swap()`, `bulkImport()`, `upgradeInstance()`, `resetInstance()` |
| `apps/api/src/modules/node-assignment/node-assignment.service.spec.ts` | Tests de lock (403/OK) |
| `apps/api/src/modules/node-assignment/node-assignment.controller.ts` | `GET /events/:eventId/lock-status` |

**Frontend:**

| Fitxer | Canvis |
|--------|--------|
| `apps/dashboard/src/app/features/config/config.routes.ts` | Ruta `tags` → `PositionListComponent` |
| `apps/dashboard/src/app/features/config/components/position-list/position-list.component.ts` | **NOU** |
| `apps/dashboard/src/app/features/config/components/position-list/position-list.component.html` | **NOU** |
| `apps/dashboard/src/app/features/config/components/position-form-modal/position-form-modal.component.ts` | **NOU** |
| `apps/dashboard/src/app/features/config/components/position-form-modal/position-form-modal.component.html` | **NOU** |
| `apps/dashboard/src/app/features/config/services/position.service.ts` | **NOU** |
| `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.ts` | Carregar posicions, afegir `positionIds` al save |
| `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.html` | Multi-select de posicions en mode edició |
| `apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.ts` | Lock check + banner |
| `apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.html` | Banner de lock, desactivar interacció |

### Fase 2

**Backend:**

| Fitxer | Canvis |
|--------|--------|
| `apps/api/src/modules/node-assignment/available-persons.service.ts` | LEFT JOIN `person.positions`, incloure `positions[]` al response |
| `apps/api/src/modules/node-assignment/available-persons.service.spec.ts` | Test `positions[]` al response |

**Frontend:**

| Fitxer | Canvis |
|--------|--------|
| `apps/dashboard/src/app/features/pinyes/models/assignment.model.ts` | `positions` a `AvailablePerson` |
| `apps/dashboard/src/app/features/pinyes/components/person-panel/person-panel.component.ts` | Input `activeNodePositionType`, computed sort per match |
| `apps/dashboard/src/app/features/pinyes/components/person-panel/person-panel.component.html` | Indicador visual de match, separador |
| `apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.ts` | Passar `positionType` del node seleccionat al PersonPanel |

### Fase 3

**Backend:**

| Fitxer | Canvis |
|--------|--------|
| `apps/api/src/modules/node-assignment/node-assignment.service.ts` | `getPersonHistory()`, `getEventAssignmentSummary()` |
| `apps/api/src/modules/node-assignment/node-assignment.controller.ts` | 3 nous endpoints |
| `apps/api/src/modules/node-assignment/node-assignment.service.spec.ts` | Tests d'historial |

**Frontend:**

| Fitxer | Canvis |
|--------|--------|
| `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.ts` | Secció historial de pinyes |
| `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.html` | Card historial col·lapsable |
| Event detail components (rehearsal/performance) | Secció "Pinyes" amb segments i figures |
| `apps/dashboard/src/app/features/pinyes/components/template-list/template-list.component.ts` | Botó "Historial" per família |
| `apps/dashboard/src/app/features/pinyes/components/family-history-modal/family-history-modal.component.ts` | **NOU** |

---

## 10. Proves manuals (checklist post-implementació)

### Fase 1 — Config/Tags + Lock

#### Config/Tags CRUD

- [ ] Navegar a `/config/tags` i verificar que la taula de posicions es carrega (sense placeholder)
- [ ] Crear una nova posició amb nom "Test", slug auto-generat, color i zona
- [ ] Verificar que el slug es genera automàticament des del nom (kebab-case)
- [ ] Intentar crear una posició amb slug duplicat → verificar error 409
- [ ] Editar una posició existent: canviar nom, descripció, color
- [ ] Verificar que el comptador de persones (`personCount`) es mostra correctament
- [ ] Eliminar una posició sense persones assignades → verificar que s'elimina
- [ ] Assignar la posició a una persona (des de person-detail), tornar a config/tags i verificar que el comptador augmenta
- [ ] Intentar eliminar la posició amb persones assignades → verificar error 409

#### Assignació de posicions a persones

- [ ] Navegar al detall d'una persona (`/persons/:id`)
- [ ] Activar mode edició
- [ ] Verificar que apareix la secció de selecció de posicions amb chips
- [ ] Seleccionar 2-3 posicions i desar
- [ ] Verificar que els badges de posicions es mostren correctament en mode lectura
- [ ] Treure totes les posicions i desar → verificar que mostra "Cap posició"

#### Lock d'assignacions

- [ ] Crear un event amb data de fa 3+ dies
- [ ] Afegir un segment amb una figura i assignar una persona
- [ ] Verificar que al canvas d'assignació apareix el banner de "Assignacions bloquejades"
- [ ] Verificar que no es pot assignar ni desassignar (click desactivat)
- [ ] Verificar que la projecció segueix funcionant (readonly)
- [ ] Verificar que al segment manager apareix la icona de candau
- [ ] Crear un event amb data d'avui → verificar que les assignacions funcionen normalment
- [ ] Canviar `ASSIGNMENT_LOCK_DAYS=0` al `.env` i reiniciar API → verificar que el lock es desactiva

#### Creació de posicions inicials (validació funcional)

- [ ] Crear les 11 posicions de la taula de la secció 6 via la UI
- [ ] Verificar que cada posició es crea amb el color, slug i zona correctes
- [ ] Assignar posicions a 5-10 persones de prova
- [ ] Verificar que els badges es mostren correctament al llistat de persones i al detall

### Fase 2 — Filtre intel·ligent

- [ ] Navegar al canvas d'assignació d'un event actiu (no bloquejat)
- [ ] Seleccionar un node amb `positionType = 'vents'`
- [ ] Verificar que les persones amb tag "Vents" apareixen primer al panel
- [ ] Verificar que tenen un indicador visual (badge/check)
- [ ] Verificar que les persones sense tag "Vents" segueixen visibles però després
- [ ] Seleccionar un node sense `positionType` → verificar que l'ordre torna a ser normal
- [ ] Seleccionar un node amb `positionType` que no coincideix amb cap `Position.slug` → verificar que no hi ha canvi d'ordre

### Fase 3 — Historials

#### Historial per persona

- [ ] Navegar al detall d'una persona que tingui assignacions
- [ ] Verificar que apareix la secció "Historial de pinyes" amb taula
- [ ] Verificar columnes: Data, Event, Segment, Figura, Posició, Zona
- [ ] Verificar paginació (si hi ha més de 20 entrades)
- [ ] Filtrar per temporada → verificar que es filtra correctament
- [ ] Fer click a una fila → verificar que navega al detall de l'event
- [ ] Navegar al detall d'una persona sense assignacions → verificar `app-empty-state`

#### Historial per event

- [ ] Navegar al detall d'un event que tingui figures assignades
- [ ] Verificar que apareix la secció "Pinyes" amb els segments
- [ ] Verificar que cada segment mostra les figures amb assignacions
- [ ] Verificar badge `assignedNodes / totalNodes`
- [ ] Verificar que cada assignació mostra nodeLabel → personAlias
- [ ] Verificar event sense figures → mostra `app-empty-state`
- [ ] Verificar event bloquejat → mostra badge "Registre tancat"

#### Historial per figura/família

- [ ] Navegar a `/pinyes` (tab Famílies)
- [ ] Fer click a "Historial" d'una família que tingui instàncies
- [ ] Verificar taula amb columnes: Data, Event, Tipus, Variant, Assignats/Total
- [ ] Verificar paginació
- [ ] Filtrar per temporada
- [ ] Fer click a una fila → navega al detall de l'event
- [ ] Família sense instàncies → `app-empty-state`

---

## 11. Invariants nous

Afegir als invariants de domini existents (secció 15 de `PINYES_MODULE.md`):

13. **Assignment lock**: Un cop `event.date + ASSIGNMENT_LOCK_DAYS < now()`, les operacions d'escriptura sobre `NodeAssignment` (assign, unassign, swap, bulkImport, upgrade, reset) retornen 403. Les lectures (GET) no es veuen afectades. `ASSIGNMENT_LOCK_DAYS = 0` desactiva el lock.

14. **Position-positionType soft matching**: `Position.slug` i `FigureNode.positionType` es relacionen per convenció de noms (mateixa cadena), no per FK. El matching és opcional i s'usa per prioritzar persones al panel d'assignació.

---

## 12. Fora d'abast (futur)

- Colors del canvas derivats de `Position.color` (ara hardcodejats a `PINYA_POSITIONS`)
- Històric de canvis a `Position` entity (audit log)
- Historial d'assignacions en temps real (WebSocket)
- Descàrrega/exportació d'historials (CSV/PDF)
- Vista d'historial a la PWA (P6)
- Dashboard estadístic de participació (P7)
