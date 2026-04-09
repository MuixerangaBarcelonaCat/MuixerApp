# MuixerApp — Punt actual i pròxims passos

> Última actualització: 9 d'abril de 2026

---

## On estem?

### ✅ Fase completada: P0+P1+P2+P2.1+P3+P4.1 — Complet i Funcional

Vertical slice complet amb auth layer implementat. L'aplicació té **login real, guards globals i refresh token rotation**:

#### Backend
- ✅ Nx monorepo configurat
- ✅ NestJS API amb TypeORM + NeonDB
- ✅ Entitats: Position, User, Person amb relacions
- ✅ CRUD complet per Person i Position
- ✅ **Sistema de sincronització** amb legacy API (SSE + Strategy pattern)
- ✅ **Merge strategy** refinada (CREATE vs UPDATE amb regles clares)
- ✅ **Soft delete automàtic** de persones desaparegudes
- ✅ **Endpoints activate/deactivate** per gestió manual
- ✅ **Swagger/OpenAPI** documentació disponible a `/api/docs`
- ✅ **Interceptor de latència** per monitorització de requests
- ✅ **Ordenació server-side** — `sortBy` + `sortOrder` amb whitelist estricta (`PERSON_SORT_COLUMN_MAP`)
- ✅ Entitats: Season, Event, Attendance amb TypeORM + JSONB metadata + attendanceSummary denormalitzat
- ✅ CRUD complet per Season, Event, Attendance (GET, PATCH)
- ✅ **EventSyncStrategy + AttendanceSyncStrategy** amb context-aware status mapping
- ✅ **Sync /sync/events** i **/sync/all** SSE endpoints
- ✅ **Tests** amb Jest (101/101 passing — Person + Season + Event + Attendance + Sync strategies)

#### Auth (P4.1)
- ✅ **AuthModule** complet: JWT+Passport (local + jwt strategies)
- ✅ **7 endpoints**: login, refresh, logout, logout-all, me, invite/accept, setup/user
- ✅ **TokenService**: refresh token rotation amb detecció de reutilització + revocació per família
- ✅ **Guards globals**: JwtAuthGuard + RolesGuard com APP_GUARD
- ✅ **Decoradors**: `@Public()`, `@Roles()`, `@CurrentUser()`
- ✅ **RefreshToken entity**: SHA-256 hash, family, clientType, expiresAt, usedAt, revokedAt
- ✅ **User entity refactoritzat**: afegit `email` (unique), `person` OneToOne
- ✅ **Person entity**: afegit `user` back-ref, eliminat `isMainAccount`
- ✅ **Rate limiting**: `@nestjs/throttler` als endpoints auth
- ✅ **Shared lib**: `ClientType` enum, `JwtPayload`/`UserProfile`/`PersonSummary` interfaces
- ✅ **Tests** auth.service + token.service

#### Frontend
- ✅ Angular 20+ dashboard amb arquitectura moderna
- ✅ **DaisyUI v4 + Angular CDK** (migrat des de Spartan UI)
- ✅ **Estructura de 3 fitxers** per components (TS/HTML/SCSS)
- ✅ **Person List** — taula sempre (scroll horitzontal), ordenació per columnes, filtres, cerca, paginació configurable (25/50/100), selector columnes col·lapsable, filtre chips, skeleton loader
- ✅ **Person Detail** amb vista responsive de 2 columnes
- ✅ **Person Sync** amb EventSource + progress bar + log en temps real
- ✅ **Layout responsive** amb sidebar + header + drawer mòbil
- ✅ **Utils compartides** (color, date, person) + `formatShoulderHeight*` + `shoulderHeightRelativeTone`
- ✅ Shared library amb enums
- ✅ **Tailwind CSS v3 + DaisyUI v4** configurat (estable, 55 components)
- ✅ **Event List** — tabs Assajos/Actuacions, filtres temporada/estadística/cerca, ordenació, paginació, columnes assistència
- ✅ **Event Detail** — info, metadata per tipus, resum assistència + progress bar, llista assistència filtrable
- ✅ **Event Sync** — SSE progress UI, resum de sincronització
- ✅ Sidebar activat per Esdeveniments
- ✅ **Auth Dashboard (P4.1)**:
  - AuthService signal-based (`currentUser`, `isAuthenticated`, `userRole`)
  - `authInterceptor`: Bearer header + 401→refresh→retry
  - `authGuard` + `rolesGuard()` CanActivateFn
  - `LoginComponent` (DaisyUI, 3 fitxers, UI en català)
  - `APP_INITIALIZER` que intenta refresh a l'arrancar
  - Totes les rutes protegides amb `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`
- ✅ **Tests** amb Vitest (22/22 passing — Person + EventService + AttendanceService + utils) + auth guards + interceptor + login component

### Què s'ha implementat?

- **Stack:** NestJS + Angular 20+ + TypeORM + PostgreSQL (NeonDB) + Nx monorepo
- **Enfocament:** Vertical Slice — entitat Person completa de punta a punta
- **Model de dades:** Person, Position, User (entitats TypeORM amb decoradors)
- **API REST:** Endpoints amb filtres, paginació i cerca
- **Dashboard:** Tailwind CSS + DaisyUI + Angular CDK
- **Idioma:** Català UI, anglès codi

### Estructura actual del repo

```
apps/
  api/          → NestJS backend (Person, Position, User, Auth, Season, Event, Attendance, Sync)
  dashboard/    → Angular dashboard (layout + auth + persons + events)
  pwa/          → PWA scaffold (buit)
libs/
  shared/       → Enums + interfaces compartides (UserRole, ClientType, JwtPayload, UserProfile...)
docs/
  specs/        → Specs tècnics aprovats
  AUTH_FLOW.md  → Fluxos d'autenticació (P4.1)
  DATA_MODEL.md → Model de dades actualitzat
  PROJECT_ROADMAP.md
  NEXT_STEPS.md (aquest document)
  API_APPSISTENCIA.md
.cursor/rules/  → Regles per l'agent
scripts/        → Extractor Python
```

---

## Pròxims passos

### 1. ✅ Validació Manual del Vertical Slice (P2 final)

Seguir el checklist complet a `docs/VALIDATION_CHECKLIST.md`:

```bash
# 1. Assegurar-te que tens .env configurat
cp .env.example .env
# Editar DATABASE_URL amb credencials de NeonDB
# Editar LEGACY_API_URL, LEGACY_API_USERNAME, LEGACY_API_PASSWORD

# 2. Executar backend
nx serve api
# http://localhost:3000/api
# Swagger: http://localhost:3000/api/docs

# 3. Executar dashboard
nx serve dashboard
# http://localhost:4200

# 4. Provar sincronització
# - Navega a "Persones"
# - Clica "Sincronitzar"
# - Verifica progrés en temps real
# - Comprova dades carregades

# 5. Provar filtres i cerca
# - Cerca per nom/alias
# - Filtra per posició
# - Filtra per disponibilitat
# - Filtra actius/inactius

# 6. Provar responsive
# - Desktop (≥1024px)
# - Tablet (768px)
# - Mòbil (375px)

# 7. Provar activate/deactivate
# - Desactivar una persona
# - Activar una persona
# - Verificar lastSyncedAt actualitzat
```

**Objectiu:** Verificar que tot funciona correctament abans de passar a P3.

### 2. Ajustaments Post-Sync (si cal)

Després del primer sync real amb dades de producció:

- [ ] Revisar mappings de camps (alias, dates, posicions)
- [ ] Ajustar regles de merge si cal
- [ ] Verificar soft delete automàtic funciona correctament
- [ ] Documentar anomalies o casos especials trobats
- [ ] Ajustar validacions si cal

**Documentació:** `docs/SYNC_MERGE_STRATEGY.md`

### 3. ✅ P3: Seasons + Events + Attendance — COMPLET

Implementat a `docs/specs/2026-03-31-p3-seasons-events-attendance-sync-design.md`:

- ✅ Entitats Season, Event, Attendance (TypeORM)
- ✅ API REST completa (seasons, events, attendance per event)
- ✅ LegacyApiClient estès (getAssajos, getActuacions, getAssistencies)
- ✅ EventSyncStrategy + AttendanceSyncStrategy
- ✅ Context-aware status mapping (past/future × assaig/actuació)
- ✅ Dashboard: EventList + EventDetail + EventSync
- ✅ 101/101 backend tests + 22/22 dashboard tests

### 4. Pròxims passos: P4.2+

| Ítem | Prioritat | Descripció |
|------|-----------|------------|
| **Validació manual P4.1** | Alta | Provar login real, refresh, guards amb dades de producció |
| **P4.2: Dashboard Events + Assistència** | Alta | Edició manual d'assistència, llista de confirmats, guards actius |
| **P5: Mòdul Pinyes i Figures** | Mitjana | Canvas, templates, assignació de posicions |
| **P6: PWA Mobile** | Baixa | Angular PWA per membres (confirmar assistència, login MEMBER) |
| **P7: Notificacions** | Baixa | Reports, FCM, estadístiques |

### 4. Deute tècnic identificat (per abordar durant P3/P4)

| Ítem | Descripció | Prioritat |
|------|-----------|-----------|
| N+1 queries al sync | ~600 queries per 300 persones — substituir per bulk upsert TypeORM | Baixa |
| ~~Auth (JWT + Passport)~~ | ✅ Resolt a P4.1 | ~~Alta~~ |
| E2E tests | Cap test Playwright/Cypress — falta cobertura de flux complet | Mitjana |
| PersonDetail tests | Component sense tests unitaris | Baixa |
| PersonSyncComponent tests | Component sense tests unitaris | Baixa |
| Persistència filtre actius | El toggle d'alçada relativa no es persisteix entre sessions | Baixa |
| `.nx/workspace-data/` al `.gitignore` | Cache de Nx podria pujar al repo per error | Immediata |

### 4. Executar l'aplicació

```bash
# Build
nx build shared       # Compilar shared library primer
nx build api          # Compilar API
nx build dashboard    # Compilar Dashboard

# Executar en desenvolupament
nx serve api          # http://localhost:3000/api
                      # Swagger: http://localhost:3000/api/docs

nx serve dashboard    # http://localhost:4200

# Tests
nx test api           # 10/10 tests passing

# Sincronització
# Usar el botó "Sincronitzar" al dashboard
# o directament via Swagger: GET /api/sync/persons (SSE)
```

### 6. Monitorització

L'API inclou un interceptor de latència que registra automàticament:
- Mètode HTTP + URL
- Status code
- Temps de resposta en ms
- Errors amb stack trace

Logs disponibles a la consola del servidor.

---

## Documents de referència

### Estat i Roadmap

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Estat Actual** | [`docs/CURRENT_STATUS.md`](CURRENT_STATUS.md) | Resum executiu complet |
| **Roadmap** | [`docs/PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) | Visió general i fases |
| **Pròxims Passos** | [`docs/NEXT_STEPS.md`](NEXT_STEPS.md) | Aquest document |

### Documentació Tècnica

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Implementation Status** | [`docs/IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) | Estat detallat d'implementació |
| **Sync Merge Strategy** | [`docs/SYNC_MERGE_STRATEGY.md`](SYNC_MERGE_STRATEGY.md) | Regles de sincronització |
| **Sync Improvements** | [`docs/SYNC_IMPROVEMENTS_2026-03-30.md`](SYNC_IMPROVEMENTS_2026-03-30.md) | Millores implementades |
| **API Person Endpoints** | [`docs/API_PERSON_ENDPOINTS.md`](API_PERSON_ENDPOINTS.md) | Documentació API REST |
| **DaisyUI Migration** | [`docs/DAISYUI_MIGRATION.md`](DAISYUI_MIGRATION.md) | Migració Spartan → DaisyUI |
| **Angular Component Structure** | [`docs/ANGULAR_COMPONENT_STRUCTURE_MIGRATION.md`](ANGULAR_COMPONENT_STRUCTURE_MIGRATION.md) | Migració a 3 fitxers |
| **Tailwind Version** | [`docs/TAILWIND_VERSION.md`](TAILWIND_VERSION.md) | Decisió v3 vs v4 |
| **Validation Checklist** | [`docs/VALIDATION_CHECKLIST.md`](VALIDATION_CHECKLIST.md) | Checklist de validació |

### Specs Aprovades

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Spec P0-P2** | [`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`](specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md) | Spec original |
| **Spec Sync + Dashboard** | [`docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`](specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md) | Spec complet |

### Altres

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Auth Flow** | [`docs/AUTH_FLOW.md`](AUTH_FLOW.md) | Fluxos d'autenticació, components, env vars |
| **API Legacy** | [`docs/API_APPSISTENCIA.md`](API_APPSISTENCIA.md) | Endpoints legacy per migració |
| **Rules** | [`.cursor/rules/`](../.cursor/rules/) | Regles per l'agent |
| **Arxiu** | [`docs/archive/`](archive/) | Docs històrics obsolets |

---

## Branques actives

| Branca | Descripció | Estat |
|--------|-----------|-------|
| `feat/vertical-slice-completion-sync-dashboard` | P2.1: Ordenació, alçada relativa, UX persones, tests complets | ✅ Llesta per merge |
