# Arquitectura de Sincronització amb el Legacy API

Documentació del mòdul `apps/api/src/modules/sync/` — com carrega dades, d'on les obté, i
el pla per desconnectar-lo quan el legacy APPsistència quedi retirat.

---

## 1. Visió general

La sincronització és **unidireccional** (legacy → MuixerApp) i s'activa **manualment** via
endpoints SSE (`/api/sync/...`). No hi ha cap job automàtic ni webhooks.

```
Legacy APPsistència (PHP)
  ├── JSON API  →  Persons, Events
  └── XLSX export  →  Attendance
```

El `LegacyApiClient` gestiona la sessió PHP (cookie `PHPSESSID`), el login i tots els
accessos HTTP. Les tres estratègies (`PersonSyncStrategy`, `EventSyncStrategy`,
`AttendanceSyncStrategy`) l'utilitzen com a servei compartit.

---

## 2. Fonts de dades per entitat

### 2.1 Persones — `GET /api/castellers` (JSON)

| Camp legacy | Camp MuixerApp | Regla |
|---|---|---|
| `id` | `legacyId` | Clau de l'upsert |
| `nom`, `cognom1`, `cognom2` | `name`, `firstSurname`, `secondSurname` | Sempre sync |
| `mote` | `alias` | Sempre sync (deduplicat) |
| `email`, `telefon` | `email`, `phone` | Sempre sync |
| `data_naixement` | `birthDate` | Sempre sync |
| `alcada_espatlles` | `shoulderHeight` | Sempre sync |
| `propi` (Sí/No) | `isMember` | Sempre sync |
| `lesionat` (Sí/No) | `availability` | Sempre sync |
| `estat_acollida` | `onboardingStatus` | Sempre sync |
| `instant_camisa` | `shirtDate` | Sempre sync |
| `posicio` | `positions[]` (M2M) | **Només en CREATE** — MuixerApp n'és propietari en UPDATE |
| `observacions` | `notes` | **Només en CREATE** — mai sobreescrit |
| — | `isXicalla` | **Derivat** de `posicio` — Només en CREATE |
| — | `isActive` | `true` si present al legacy; `false` si desapareix |

**Lògica especial:** persones presents a la DB però absents de la resposta del legacy API
passen a `isActive = false` (deactivateMissingPersons).

---

### 2.2 Temporades — Hardcoded (cap petició API)

Les dues temporades actuals es creen amb constants al codi (`EventSyncStrategy`):

```
Temporada 2024-2025  → legacyId: '2025', dates: 01/09/2024 – 05/09/2025
Temporada 2025-2026  → legacyId: '2026', dates: 06/09/2025 – 05/09/2026
```

L'assignació de temporada a un event és per data de tall (`SEASON_CUTOFF = 2025-09-06`).

> ⚠️ Limitació: les temporades futures no es crearan automàticament.
> Pendent: convertir en CRUD gestionat per admins.

---

### 2.3 Esdeveniments — JSON API (2 peticions per event)

Cada event requereix **dues** peticions al legacy:

| Petició | Dades obtingudes |
|---|---|
| `GET /api/assajos` | Llista + `n_si`, `n_no`, `hora_esdeveniment` — l'`event_id` s'extreu del camp HTML `"0"` via regex `/llista/(\d+)/` |
| `GET /api/assajos/{id}` | Detall: `lloc_esdeveniment`, `hora_final`, `informacio` |
| `GET /api/actuacions` | Ídem per actuacions |
| `GET /api/actuacions/{id}` | Detall: `lloc_event`, `colles`, `transport`, `casa`, `informacio` |

**Regles d'upsert:**

| Camp | Regla |
|---|---|
| `title`, `date`, `startTime`, `location`, `information`, `metadata` | Sempre sync |
| `countsForStatistics` | **Mai sobreescrit** — propietat de MuixerApp |
| `season` | **Mai sobreescrit** — propietat de MuixerApp |
| `legacyId`, `legacyType` | Immutables — clau de l'upsert |

> ⚠️ **Bug pendent** (`fix-colles`): `metadata.colles` per actuacions es divideix per `,`
> però el legacy usa ` i ` com a separador. Exemple: `"Jove Muixeranga de València i Castellers de Mollet"`
> hauria de donar `["Jove Muixeranga de València", "Castellers de Mollet"]`.

---

### 2.4 Assistència — XLSX export (1 petició per event)

**Font:** `GET /assistencia-export/{legacy_event_id}` → fitxer `.xlsx` en memòria.

El JSON endpoint `/api/assistencies/{id}` **no s'utilitza** (només retorna respostes
positives, no retorna "No vinc" ni "sense resposta").

**Estructura del XLSX:**

| Columna | Camp | Notes |
|---|---|---|
| `Id` | `legacyPersonId` | Identificador directe — sense fuzzy matching per nom |
| `Persona` | — | `"Cognom, Nom / Alias"` — ignorat (tenim Id) |
| `Comentari` | `notes` | Només escrit en CREATE (`WHERE notes IS NULL`) |
| `Resposta` | `estat` | `Vinc` / `No vinc` / `Potser` / `null` (sense resposta) |
| `Instant` | `respondedAt` | `DD/MM/YYYY HH:MM:SS` |

El XLSX inclou **totes les persones** (≈212 files), incloent les que no han respost (`estat = null`).
Les files de capçalera repetides que separen seccions (`Id = "Id"`) es filtren automàticament.

**Mapping d'estats:**

| `estat` | Event futur | Event passat |
|---|---|---|
| `Vinc` | `ANIRE` | `ASSISTIT` |
| `Potser` | `ANIRE` | `NO_PRESENTAT` (ASSAIG) / `NO_PRESENTAT` (ACTUACIÓ) |
| `No vinc` | `NO_VAIG` | `NO_VAIG` |
| `null` | `PENDENT` | `PENDENT` |

**Baixes tardanes (`lateCancel`):** camp calculat al `attendanceSummary` (no guardat per fila).
Un registre compta com a baixa tardana si `status = NO_VAIG` i `respondedAt` cau dins les
6h anteriors a l'inici de l'event. Es recalcula en cada sync, de manera que és sempre consistent
amb l'estat actual (si algú canvia de "No vinc" a "Vinc", el comptador s'actualitza).

**Regla de notes:** les notes del XLSX s'escriuen **només si** el registre d'assistència no
en té cap (`notes IS NULL`). Mai es sobreescriuen notes editades per l'equip.

---

## 3. Flux complet d'una sincronització (`GET /api/sync/events`)

```
EventSyncStrategy.execute()
  1. legacyApiClient.login()                       → sessió PHP (cookie)
  2. createStaticSeasons()                         → upsert 2 temporades (idempotent)
  3. legacyApiClient.getAssajos()                  → llista 74 assajos (JSON)
     └─ per cada assaig:
        legacyApiClient.getAssaigDetail(id)        → detall (JSON)
        upsertRehearsalEvent()
  4. legacyApiClient.getActuacions()               → llista 15 actuacions (JSON)
     └─ per cada actuació:
        legacyApiClient.getActuacioDetail(id)      → detall (JSON)
        upsertPerformanceEvent()
  5. AttendanceSyncStrategy.syncAll(allLegacyEvents)
     └─ per cada event amb legacyId:
        legacyApiClient.getAssistenciesXlsx(id)   → XLSX binari
        parse + upsert assistències
        recalculateSummary()                       → actualitza attendanceSummary al event
```

**Sincronització individual d'assistència** (`GET /api/sync/events/:id/attendance`):
Executa només el pas 5 per un sol event (bypass dels passos 1-4).

---

## 4. Codi obsolet / a eliminar

| Fitxer | Element | Estat |
|---|---|---|
| `legacy-api.client.ts` | `getAssistencies()` | ⚠️ Mètode obsolet — substituït per `getAssistenciesXlsx()`. Pot eliminar-se |
| `legacy-event.interface.ts` | `LegacyAttendance` | ⚠️ Interfície obsoleta — ja no s'utilitza. Pot eliminar-se |
| `legacy-api.client.spec.ts` | Tests de `getAssistencies` | Verificar si continuen testant el mètode obsolet |

---

## 5. Camps de traçabilitat del legacy (a eliminar en desconnexió)

Tots els camps `legacy*` i `lastSyncedAt` existeixen **únicament** per gestionar la
sincronització. Quan el legacy quedi retirat:

| Entitat | Camps a eliminar | Migració necessària |
|---|---|---|
| `persons` | `legacyId`, `lastSyncedAt` | Sí — DROP COLUMN |
| `events` | `legacyId`, `legacyType`, `lastSyncedAt` | Sí — DROP COLUMN |
| `attendances` | `legacyId`, `lastSyncedAt` | Sí — DROP COLUMN |
| `seasons` | `legacyId` | Sí — DROP COLUMN |

El mòdul `sync/` sencer pot eliminar-se. Les temporades hauran de tenir un CRUD propi.

---

## 6. Pendent abans de desconnectar

- [ ] CRUD de temporades (ara hardcoded)
- [ ] `colles` parsing bug (split per ` i ` a més de `,`)
- [ ] Decidir si `legacyId` en events s'exposa al frontend (spec §6.2 diu que no)
- [ ] Eliminar `getAssistencies()` i `LegacyAttendance` del codi
- [ ] Migració per eliminar tots els camps `legacy*`
