# Seasons CRUD — Gestió de Temporades

> **Data:** 10 de juny de 2026
> **Estat:** Disseny aprovat
> **Prerequisits:** Season entity + read-only API (P3)

---

## 1. Objectiu

Implementar el CRUD complet de temporades al dashboard (`/config/seasons`) i millorar l'assignació automàtica d'events a temporades per rang de dates.

**Capacitats:**

1. **CRUD de temporades** — Crear, editar i eliminar temporades des del dashboard.
2. **Validació de no-solapament** — El backend rebutja temporades amb dates que se solapin.
3. **Auto-assignació d'events** — Quan es crea/edita un event sense `seasonId` explícit, s'assigna automàticament a la temporada vigent.
4. **Temporada actual** — Endpoint dedicat + pre-selecció als dropdowns del frontend.

---

## 2. Decisions de disseny

| Decisió | Resultat |
|---------|----------|
| Soft delete vs hard delete | **Hard delete** — poques temporades, no cal històric. Guard referencial: no es pot eliminar si té events. |
| Solapament de dates | **Prohibit** — validació backend amb `daterange OVERLAPS`. |
| Auto-assignació | **Backend-driven** — `EventService.create/update` crida `SeasonService.findCurrent()` si no rep `seasonId`. |
| Temporada actual | **Per rang de dates** — `startDate <= TODAY <= endDate`. Fallback: temporada amb `startDate` DESC més recent. |
| UI pattern | **Taula simple** estil `PositionListComponent` — poques temporades, no cal paginació. |
| Formulari | **Modal** (`<dialog>`) per crear i editar. |
| Camp `legacyId` | **No exposat** al CRUD — només l'usen seeds/sync. |

---

## 3. Backend

### 3.1 DTOs

**`apps/api/src/modules/season/dto/create-season.dto.ts`**

```typescript
export class CreateSeasonDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

**`apps/api/src/modules/season/dto/update-season.dto.ts`** — `PartialType(CreateSeasonDto)`

**Validació custom:** `endDate > startDate` (validat al service, no al DTO).

### 3.2 Service — nous mètodes

| Mètode | Lògica |
|--------|--------|
| `create(dto)` | Validar `endDate > startDate`. Validar no-solapament. Guardar i retornar. |
| `update(id, dto)` | Buscar season (404). Si canvien dates, validar no-solapament excloent `id`. Guardar i retornar. |
| `remove(id)` | Buscar season (404). Comprovar `eventCount > 0` → `409 Conflict`. Hard delete. |
| `findCurrent()` | Query: `startDate <= TODAY AND endDate >= TODAY`. Fallback: `ORDER BY startDate DESC LIMIT 1`. |

**Query no-solapament:**

```sql
SELECT COUNT(*) FROM seasons
WHERE id != :excludeId
  AND daterange("startDate"::date, "endDate"::date, '[]')
    && daterange(:start::date, :end::date, '[]')
```

### 3.3 Controller — nous endpoints

| Mètode | Ruta | Resposta |
|--------|------|----------|
| `GET` | `/seasons` | `{ data: SeasonListItem[], meta }` (existent) |
| `GET` | `/seasons/current` | `SeasonListItem` (NOU) |
| `GET` | `/seasons/:id` | `SeasonListItem` (existent) |
| `POST` | `/seasons` | `201` + Season creada |
| `PATCH` | `/seasons/:id` | `200` + Season actualitzada |
| `DELETE` | `/seasons/:id` | `204` o `409 Conflict` |

**Nota:** `GET /seasons/current` ha d'anar ABANS de `GET /seasons/:id` per evitar que `:id` capturi "current".

### 3.4 Canvi a EventService

**`create(dto)`:** Si `dto.seasonId === undefined` (no enviat), cridar `seasonService.findCurrent()` i assignar. Si `dto.seasonId === null`, desassociar. Si és un UUID vàlid, assignar manualment.

**`update(id, dto)`:** Mateixa lògica que create per al camp `seasonId`.

---

## 4. Frontend

### 4.1 Season Service (ampliat)

**`apps/dashboard/src/app/features/events/services/season.service.ts`**

Nous mètodes:

```typescript
getCurrent(): Observable<Season> { return this.get<Season>('/seasons/current'); }
create(dto: CreateSeasonDto): Observable<Season> { return this.post<Season>('/seasons', dto); }
update(id: string, dto: Partial<CreateSeasonDto>): Observable<Season> { return this.patch<Season>(`/seasons/${id}`, dto); }
delete(id: string): Observable<void> { return this.del<void>(`/seasons/${id}`); }
```

### 4.2 SeasonListComponent

**Ruta:** `/config/seasons` (reemplaça `ConfigPlaceholderComponent`)

**Estructura:**

- `app-page-header` amb títol "Temporades" + botó "Nova temporada"
- Taula DaisyUI simple (no `app-data-table`)
- Columnes: Nom | Data inici | Data fi | Events | Accions
- Badge "Actual" a la temporada vigent (comparació per `id` amb `currentSeason`)
- Comptador d'events com a link a `/rehearsals?seasonId=X` (o `/performances` segons convingui)
- Botons d'acció: Editar (obre modal) + Eliminar (confirmació inline)
- Confirmació d'eliminació: `<dialog>` natiu amb missatge "Segur que vols eliminar la temporada X?"
- Error 409: toast "No es pot eliminar: té X events associats"

### 4.3 SeasonFormModalComponent

**Inputs:** `season?: Season` (si present = mode editar)
**Outputs:** `saved: Season`, `closed: void`

**Camps:**

| Camp | Tipus | Validació |
|------|-------|-----------|
| Nom | `<input type="text">` | Required, maxlength 100 |
| Data inici | `<input type="date">` | Required |
| Data fi | `<input type="date">` | Required, > data inici |
| Descripció | `<textarea>` | Opcional, maxlength 500 |

**Errors del backend:**
- 409 overlap → mostrar toast "Les dates se solapen amb una temporada existent"
- 400 validation → mostrar errors inline

### 4.4 Canvi a EventFormModalComponent

- Al crear un event nou: pre-seleccionar la temporada actual al dropdown (cridar `SeasonService.getCurrent()`)
- Al editar: mostrar la temporada actual de l'event

---

## 5. Error handling

| Situació | HTTP | Missatge frontend (Catalan) |
|----------|------|-----------------------------|
| Dates se solapen | `409` | "Les dates se solapen amb una temporada existent" |
| Eliminar amb events | `409` | "No es pot eliminar: té {n} events associats" |
| Season not found | `404` | "Temporada no trobada" |
| endDate <= startDate | `400` | Validació inline: "La data fi ha de ser posterior a la data d'inici" |
| Name duplicat | `409` | "Ja existeix una temporada amb aquest nom" |

---

## 6. Testing

### Backend (`season.service.spec.ts`)

- `create` — happy path: retorna temporada creada
- `create` — overlap: llança `ConflictException`
- `create` — `endDate <= startDate`: llança `BadRequestException`
- `update` — happy path: retorna temporada actualitzada
- `update` — overlap (excloent pròpia): llança `ConflictException`
- `remove` — happy path (0 events): elimina correctament
- `remove` — amb events: llança `ConflictException`
- `findCurrent` — retorna temporada per rang de dates
- `findCurrent` — fallback si cap temporada conté avui

### Frontend (`season-list.component.spec.ts`)

- Renderitza taula amb temporades
- Mostra badge "Actual" a la temporada vigent
- Obre modal al clicar "Nova temporada"
- Obre modal al clicar editar
- Elimina amb confirmació
- Mostra error toast en 409

### Frontend (`season-form-modal.component.spec.ts`)

- Mode create: formulari buit
- Mode edit: formulari pre-omplert
- Validació: data fi > data inici
- Submit: crida service i emet `saved`
- Cancel: emet `closed`

---

## 7. Fitxers nous/modificats

**Nous:**
- `apps/api/src/modules/season/dto/create-season.dto.ts`
- `apps/api/src/modules/season/dto/update-season.dto.ts`
- `apps/dashboard/src/app/features/config/components/season-list/season-list.component.ts`
- `apps/dashboard/src/app/features/config/components/season-list/season-list.component.html`
- `apps/dashboard/src/app/features/config/components/season-list/season-list.component.spec.ts`
- `apps/dashboard/src/app/features/config/components/season-form-modal/season-form-modal.component.ts`
- `apps/dashboard/src/app/features/config/components/season-form-modal/season-form-modal.component.html`
- `apps/dashboard/src/app/features/config/components/season-form-modal/season-form-modal.component.spec.ts`

**Modificats:**
- `apps/api/src/modules/season/season.service.ts` — nous mètodes CRUD
- `apps/api/src/modules/season/season.service.spec.ts` — nous tests
- `apps/api/src/modules/season/season.controller.ts` — nous endpoints
- `apps/api/src/modules/event/event.service.ts` — auto-assign logic
- `apps/dashboard/src/app/features/events/services/season.service.ts` — nous mètodes
- `apps/dashboard/src/app/features/config/config.routes.ts` — canviar placeholder per `SeasonListComponent`
- `apps/dashboard/src/app/features/events/components/event-form-modal/event-form-modal.component.ts` — pre-select current season
