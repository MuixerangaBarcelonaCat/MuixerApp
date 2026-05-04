# Estat Actual del Projecte MuixerApp

> **Última actualització:** 24 d'abril de 2026

---

## 🎯 Resum Executiu

El projecte MuixerApp està en **fase de desenvolupament actiu** amb P0-P3 + P4.1 + P4.2 + P4.3 completats. L'aplicació inclou:

- ✅ Backend NestJS amb API REST completa + ordenació server-side
- ✅ Sistema de sincronització amb legacy API (SSE + Strategy pattern) — Persons + Events + Attendance
- ✅ Dashboard Angular amb DaisyUI v4 + Angular CDK — **redeseny visual complet (P4.3)**
- ✅ Gestió de persones, temporades, esdeveniments i assistència
- ✅ **Auth Layer complet**: JWT+Passport, refresh token rotation, guards globals, login page
- ✅ **CRUD complet Events + Attendance** al dashboard (crear, editar, eliminar)
- ✅ **Persones provisionals**: creació ràpida amb àlies `~`, promoció/democió
- ✅ **Dashboard Design Refactor (P4.3)**: top nav tabs, Inter font, Lucide icons, `generateCollaTheme()`, 15+ shared components, Home tab, fullscreen mode per Pinyes
- ✅ Visualització d'alçada d'espatlles **absoluta i relativa** (+/- 140 cm)
- ✅ **CI/CD**: GitHub Actions amb lint + test + build (affected per PRs, all per push)
- ✅ Arquitectura de components moderna (signals, standalone, OnPush)
- ✅ **Tests complets:** 101/101 backend + 22/22 dashboard passing

---

## 📊 Estat per Mòdul

### Backend API (NestJS)

| Mòdul | Estat | Descripció |
|-------|-------|------------|
| **Person Module** | ✅ Complet | CRUD + filtres + cerca + paginació + activate/deactivate + **ordenació server-side** + persones provisionals (`~` prefix) |
| **Position Module** | ✅ Complet | CRUD + relacions M:N amb Person |
| **User Module** | ✅ Complet | Entitat amb email + OneToOne Person. Gestionat via AuthModule |
| **Auth Module** | ✅ Complet | JWT+Passport, 7 endpoints, refresh rotation, guards globals, rate limiting |
| **Season Module** | ✅ Complet | CRUD + comptador d'esdeveniments |
| **Event Module** | ✅ Complet | Full CRUD (POST/PUT/DELETE) + Attendance CRUD (POST/PUT/DELETE) + filtres/paginació/ordenació + recàlcul automàtic attendanceSummary |
| **Sync Module** | ✅ Complet | LegacyApiClient + PersonSyncStrategy + EventSyncStrategy + AttendanceSyncStrategy + SSE |
| **Database** | ✅ Funcional | TypeORM + NeonDB PostgreSQL + entitats Season/Event/Attendance |
| **Swagger** | ✅ Funcional | Documentació interactiva a `/api/docs` |
| **Tests** | ✅ 101/101 passing | Person + Season + Event + Attendance + Sync strategies |

**Endpoints disponibles:**
- `GET /api/persons` - Llistar amb filtres
- `GET /api/persons/:id` - Detall
- `POST /api/persons` - Crear
- `PATCH /api/persons/:id` - Actualitzar
- `DELETE /api/persons/:id` - Soft delete
- `PATCH /api/persons/:id/activate` - Activar / `PATCH /api/persons/:id/deactivate` - Desactivar
- `GET /api/seasons` - Llistar temporades (amb event count)
- `GET /api/seasons/:id` - Detall temporada
- `GET /api/events` - Llistar esdeveniments (eventType, seasonId, dateFrom/To, search, countsForStatistics, sortBy, pagination)
- `POST /api/events` - Crear esdeveniment
- `GET /api/events/:id` - Detall (inclou metadata + attendanceSummary)
- `PUT /api/events/:id` - Actualitzar esdeveniment (tots els camps)
- `DELETE /api/events/:id` - Eliminar esdeveniment (409 si té assistència)
- `GET /api/events/:id/attendance` - Llista assistència (status filter, search, pagination)
- `POST /api/events/:id/attendance` - Crear registre d'assistència (409 si duplicat)
- `PUT /api/events/:id/attendance/:attendanceId` - Actualitzar assistència
- `DELETE /api/events/:id/attendance/:attendanceId` - Eliminar assistència
- `POST /api/persons/provisional` - Crear persona provisional (només àlies)
- `POST /api/auth/login` - Login (email + password + clientType)
- `POST /api/auth/refresh` - Rotar refresh token (cookie)
- `POST /api/auth/logout` - Logout (revocar token actual)
- `POST /api/auth/logout-all` - Revocar tots els tokens del user
- `GET /api/auth/me` - Perfil de l'usuari autenticat
- `POST /api/auth/invite/accept` - Acceptar invitació (onboarding)
- `POST /api/auth/setup/user` - Bootstrap primer user (X-Setup-Token)
- `GET /api/sync/persons` - Sincronització SSE (persones)
- `GET /api/sync/events` - Sincronització SSE (events + assistència)
- `GET /api/sync/all` - Sincronització SSE completa (persones → events → assistència)

### Dashboard (Angular 20+)

| Component | Estat | Descripció |
|-----------|-------|------------|
| **Layout** | ✅ Complet | Top nav + Tab Bar responsive (Desktop: icon+text, Tablet: icon, Mobile: dropdown) — P4.3 |
| **Person List** | ✅ Complet | Taula sempre (scroll horitzontal) + ordenació per columnes + filtres + cerca + paginació configurable + tabs Cens/Provisionals/Tots + badge provisional |
| **Person Detail** | ✅ Complet | Vista responsive 2 columnes + toggle provisional/regular |
| **Person Sync** | ✅ Complet | EventSource + progress bar + log en temps real |
| **Event List** | ✅ Complet | Tabs Assajos/Actuacions, filtres temporada/estadística/cerca, ordenació, paginació, columnes assistència + botó crear event |
| **Event Detail** | ✅ Complet | Info + edició via modal + eliminació (amb protecció 409) + gestió assistència completa (afegir/editar/eliminar) + filtre confirmats + persones provisionals inline |
| **Event Form Modal** | ✅ Complet | Modal reutilitzable per crear i editar esdeveniments (tots els camps) |
| **Attendance Edit Modal** | ✅ Complet | Edició estat + notes, eliminació amb confirmació, warning per events passats |
| **Person Search Input** | ✅ Complet | Component shared reutilitzable amb debounce, exclusió d'IDs, badge provisional |
| **Event Sync** | ✅ Complet | SSE progress UI — mirrors PersonSyncComponent |
| **Login Page** | ✅ Complet | DaisyUI form, email+password, UI en català, redirect a / on success |
| **Auth Guards** | ✅ Complet | authGuard (CanActivateFn) + rolesGuard factory. Totes les rutes protegides |
| **Auth Interceptor** | ✅ Complet | Bearer header + 401→refresh→retry + redirect /login on fail |
| **Routing** | ✅ Funcional | Lazy loading per features (persons + events), protegit amb auth |
| **Services** | ✅ Complet | AuthService (signals) + ApiService (GET/POST/PATCH/PUT/DELETE) + PersonService (incl. provisional) + EventService (full CRUD) + AttendanceService (CRUD) + SeasonService |
| **Utils** | ✅ Complet | Color, date, person utilities (incl. `formatShoulderHeight*`, `shoulderHeightRelativeTone`) |
| **Tests** | ✅ 22/22 passing | PersonListComponent + PersonService + EventService + AttendanceService + person.util + http-params.util |

**Stack UI:**
- DaisyUI v4.12.24 (55 components CSS)
- Angular CDK v21.2.4 (overlays, a11y, drag-drop)
- Tailwind CSS v3.4.19
- Arquitectura: Standalone components + Signals + OnPush

### PWA

| Component | Estat | Descripció |
|-----------|-------|------------|
| **PWA** | 🔲 Scaffold buit | Pendent d'implementació (P5) |

---

## 🏗️ Arquitectura Actual

### Stack Tecnològic

```
Backend:
├── NestJS 10.x
├── TypeORM 0.3.x
├── PostgreSQL (NeonDB)
├── Swagger/OpenAPI
└── Jest (testing)

Frontend:
├── Angular 20+ (standalone)
├── DaisyUI v4.12.24
├── Angular CDK v21.2.4
├── Tailwind CSS v3.4.19
└── RxJS 7.8.x

Monorepo:
├── Nx workspace
├── apps/api
├── apps/dashboard
├── apps/pwa (buit)
└── libs/shared
```

### Patrons de Disseny Implementats

1. **Strategy Pattern** - Sync module (extensible per Events, Attendance)
2. **Repository Pattern** - TypeORM repositories
3. **DTO Pattern** - Validació i transformació de dades
4. **Signals Pattern** - Gestió d'estat reactiu (Angular)
5. **Utility Functions** - Funcions compartides (color, date, person)

---

## 🔄 Sistema de Sincronització

### Característiques

- ✅ **SSE (Server-Sent Events)** - Progrés en temps real
- ✅ **Strategy Pattern** - Extensible per altres entitats
- ✅ **Idempotència** - Safe to run múltiples vegades
- ✅ **Soft Delete Automàtic** - Detecta persones desaparegudes
- ✅ **Merge Strategy** - CREATE vs UPDATE amb regles clares
- ✅ **Tracking** - `lastSyncedAt` per cada persona
- ✅ **Gestió Manual** - Endpoints activate/deactivate

### Merge Strategy

| Camp | CREATE | UPDATE | Rationale |
|------|--------|--------|-----------|
| Identitat (name, surnames, alias, email, phone) | ✅ | ✅ | Legacy és master |
| Administratiu (isMember, availability, onboarding) | ✅ | ✅ | Legacy és master |
| Posicions (positions[], isXicalla) | ✅ | ❌ | MuixerApp gestiona |
| Notes locals (notes) | ✅ | ❌ | MuixerApp gestiona |
| Control (isActive, lastSyncedAt) | ✅ | ✅ | Automàtic |

**Documentació detallada:** `docs/SYNC_MERGE_STRATEGY.md`

---

## 🎨 Stack UI: DaisyUI v4

- **DaisyUI v4.12.24** + **Tailwind CSS v3.4.19** (no v4, per compatibilitat amb PostCSS/Sass)
- **Angular CDK v21.2.4** per overlays, a11y, drag-drop
- Theming multi-colla via `data-theme` de DaisyUI
- Tots els components segueixen l'**estructura obligatòria de 3 fitxers** (regla `.cursor/rules/angular-component-structure.mdc`)

---

## 📚 Documentació

| Document | Descripció |
|----------|------------|
| `docs/INDEX.md` | Índex complet de tota la documentació |
| `docs/DATA_MODEL.md` | Entitats, camps, relacions i enums actuals |
| `docs/AUTH_FLOW.md` | Fluxos d'autenticació, components, env vars |
| `docs/SYNC_MERGE_STRATEGY.md` | Regles de sincronització (referència canònica) |
| `docs/VALIDATION_CHECKLIST.md` | Checklist de validació manual |
| `docs/TROUBLESHOOTING.md` | Solucions a problemes comuns |
| `docs/specs/` | Specs tècniques aprovades (P0-P2, Sync+Dashboard, P4.1 Auth, P4.2 Events+Attendance) |

---

## 🧪 Testing

### Backend

```bash
nx test api
```

**Resultat:** 101/101 tests passing

**Cobertura:**
- `PersonService` — CRUD, filtres, paginació, ordenació (default/ASC/DESC), activate/deactivate
- `PersonController` — endpoint `findAll`, envoltura `{ data, meta }`
- `PersonFilterDto` — validació `@IsIn` per `sortBy` i `sortOrder`, rebuig de valors invàlids
- `PositionService` — CRUD
- `LegacyApiClient` — autenticació multi-step (GET session + POST login + redirect)
- `PersonSyncStrategy` — create vs update, `deactivateMissingPersons`
- `SeasonService` — llista amb event count, findOne, no exposa legacyId
- `EventService` — CRUD, tots els filtres (seasonId, eventType, dateRange, search, countsForStatistics), paginació, ordenació whitelist
- `AttendanceService` — llista per event, filtre per status, recalculateSummary (tots els estats incl. xicalla)
- `EventController` — envoltura { data, meta }, delegació a services
- `EventFilterDto` — validació tots els paràmetres, protecció whitelist sortBy
- `EventSyncStrategy` — extractEventId, parseDate, stripHtml, assignació temporades, guàrdia concurrència
- `AttendanceSyncStrategy` — mapAttendanceStatus (8 combinacions past/future × assaig/actuació × estats), parseTimestamp, match per alias/legacyId

### Frontend

```bash
nx test dashboard
```

**Resultat:** 22/22 tests passing

**Cobertura:**
- `PersonListComponent` — inicialització, `onSortColumn` (3 estats), toggle `shoulderHeightRelative`
- `PersonService` (Angular) — crides HTTP a `getAll` i `getPositions` amb params correctes
- `EventService` (Angular) — `getAll` amb params, omissió de filtres buits, `getOne`, `update` (PATCH)
- `AttendanceService` (Angular) — `getByEvent` amb eventId + filtre status
- `person.util` — `getFullName`, `getAvailabilityLabel`, `getOnboardingLabel`, `formatShoulderHeightCm`, `formatShoulderHeightRelative`, `shoulderHeightRelativeTone`
- `http-params.util` — `buildHttpParams` (arrays, omissió de null/undefined/buit)

---

## 🚀 Com Executar

### Backend

```bash
# Instal·lar dependències
npm install

# Configurar .env
cp .env.example .env
# Editar DATABASE_URL amb credencials de NeonDB

# Executar API
nx serve api
# http://localhost:3000/api
# Swagger: http://localhost:3000/api/docs
```

### Dashboard

```bash
# Executar dashboard
nx serve dashboard
# http://localhost:4200
```

### Sincronització

1. Obre el dashboard a `http://localhost:4200`
2. Navega a "Persones"
3. Clica "Sincronitzar"
4. Veuràs el progrés en temps real

---

## 🎯 Pròxims Passos Immediats

### 1. Validació Manual P4.1 + P4.2

- [ ] Crear primer user via `POST /auth/setup/user` amb `SETUP_TOKEN`
- [ ] Provar login al dashboard (`http://localhost:4200/login`)
- [ ] Verificar guards: rutes protegides redirigeixen a login
- [ ] Provar CRUD d'esdeveniments (crear, editar, eliminar)
- [ ] Provar gestió d'assistència (afegir, editar estat/notes, eliminar)
- [ ] Provar creació de persones provisionals i promoció a regulars
- [ ] Eliminar `SETUP_TOKEN` de `.env` un cop creat el primer user

### 2. P5: Mòdul Pinyes i Figures

- [ ] Canvas / drag-drop per posicions
- [ ] Templates de figures reutilitzables

**Documentació:** `docs/PROJECT_ROADMAP.md`

---

## 🐛 Problemes Coneguts

### Backend

- ⚠️ **N+1 queries** en sync - Funcional però no optimitzat (300 persones = 600 queries)
  - **Solució futura:** Bulk upsert amb TypeORM
  - **Prioritat:** Baixa (performance, no funcionalitat)

### Dashboard

- ⚠️ **Cobertura de tests parcial** — PersonListComponent té tests bàsics però falten E2E i tests de navegació/detall
  - **Solució futura:** Playwright/Cypress per E2E; ampliar cobertura de components de detall
  - **Prioritat:** Mitjana

### PWA

- 🔲 **No implementat** - Scaffold buit
  - **Solució:** P5 del roadmap
  - **Prioritat:** Baixa (després de P3-P4)

---

## 📞 Referències

### Documentació Clau

- **Roadmap:** `docs/PROJECT_ROADMAP.md`
- **Sync Strategy:** `docs/SYNC_MERGE_STRATEGY.md`
- **API Endpoints:** `docs/API_PERSON_ENDPOINTS.md`
- **Pròxims Passos:** `docs/NEXT_STEPS.md`

### Codi Clau

- **Backend Auth:** `apps/api/src/modules/auth/`
- **Backend Sync:** `apps/api/src/modules/sync/`
- **Frontend Auth:** `apps/dashboard/src/app/core/auth/`
- **Frontend Components:** `apps/dashboard/src/app/features/persons/`
- **Shared Utils:** `apps/dashboard/src/app/shared/utils/`
- **Rules:** `.cursor/rules/`

### Specs Aprovades

- **P0-P2:** `docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`
- **Sync + Dashboard:** `docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`
- **Auth Layer P4.1:** `docs/specs/2026-04-07-p4-1-auth-layer-design.md`
- **Events + Attendance P4.2:** `docs/specs/2026-04-12-p4-2-dashboard-events-attendance-design.md`

---

## 🎉 Fites Aconseguides

- ✅ **Vertical Slice P0-P3 + P4.1 Auth** — Complet i funcional
- ✅ **Migració a DaisyUI** — Stack UI estable
- ✅ **Sistema de Sync** — SSE + Strategy pattern (Persons + Events + Attendance)
- ✅ **Dashboard Responsive** — Taula always-on amb scroll horitzontal
- ✅ **Arquitectura Moderna** — Signals + Standalone + OnPush
- ✅ **Context-aware attendance mapping** — 4 branques past/future × assaig/actuació
- ✅ **AttendanceSummary denormalized** — JSONB a Event per rendiment de llista
- ✅ **Ordenació server-side** — Whitelist de camps, protecció SQL injection
- ✅ **Alçada espatlles relativa** — Toggle absolut/relatiu amb codificació de color
- ✅ **Auth Layer (P4.1)** — JWT+Passport, refresh rotation, dashboard login, guards globals
- ✅ **Dashboard Events + Attendance (P4.2)** — CRUD events, gestió assistència manual, persones provisionals, optimistic UI
- ✅ **Suite de tests completa** — 101/101 API + 22/22 dashboard passing

---

**Estat del projecte:** 🟢 **Actiu i saludable**
