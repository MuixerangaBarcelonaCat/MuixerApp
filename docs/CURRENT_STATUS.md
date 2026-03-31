# Estat Actual del Projecte MuixerApp

> **Última actualització:** 31 de març de 2026

---

## 🎯 Resum Executiu

El projecte MuixerApp està en **fase de desenvolupament actiu** amb el vertical slice P0-P2 i les millores de dashboard P2.1 completats i funcionals. L'aplicació inclou:

- ✅ Backend NestJS amb API REST completa + ordenació server-side
- ✅ Sistema de sincronització amb legacy API (SSE + Strategy pattern)
- ✅ Dashboard Angular amb DaisyUI v4 + Angular CDK
- ✅ Gestió de persones amb filtres, cerca, paginació i **ordenació per columnes**
- ✅ Visualització d'alçada d'espatlles **absoluta i relativa** (+/- 140 cm)
- ✅ Arquitectura de components moderna (signals, standalone, OnPush)
- ✅ **Tests complets:** 34/34 backend + 16/16 dashboard passing

---

## 📊 Estat per Mòdul

### Backend API (NestJS)

| Mòdul | Estat | Descripció |
|-------|-------|------------|
| **Person Module** | ✅ Complet | CRUD + filtres + cerca + paginació + activate/deactivate + **ordenació server-side** |
| **Position Module** | ✅ Complet | CRUD + relacions M:N amb Person |
| **User Module** | ✅ Bàsic | Entitat creada, CRUD bàsic (sense auth encara) |
| **Sync Module** | ✅ Complet | LegacyApiClient + PersonSyncStrategy + SSE progress |
| **Database** | ✅ Funcional | TypeORM + NeonDB PostgreSQL + migrations |
| **Swagger** | ✅ Funcional | Documentació interactiva a `/api/docs` |
| **Tests** | ✅ 34/34 passing | PersonService + PersonController + PersonFilterDto + PositionService + Sync |

**Endpoints disponibles:**
- `GET /api/persons` - Llistar amb filtres
- `GET /api/persons/:id` - Detall
- `POST /api/persons` - Crear
- `PATCH /api/persons/:id` - Actualitzar
- `DELETE /api/persons/:id` - Soft delete
- `PATCH /api/persons/:id/activate` - Activar
- `PATCH /api/persons/:id/deactivate` - Desactivar
- `GET /api/sync/persons` - Sincronització SSE

### Dashboard (Angular 20+)

| Component | Estat | Descripció |
|-----------|-------|------------|
| **Layout** | ✅ Complet | Sidebar + Header + Drawer mòbil (DaisyUI) |
| **Person List** | ✅ Complet | Taula sempre (scroll horitzontal) + ordenació per columnes + filtres + cerca + paginació configurable |
| **Person Detail** | ✅ Complet | Vista responsive 2 columnes |
| **Person Sync** | ✅ Complet | EventSource + progress bar + log en temps real |
| **Routing** | ✅ Funcional | Lazy loading per features |
| **Services** | ✅ Complet | ApiService + PersonService |
| **Utils** | ✅ Complet | Color, date, person utilities (incl. `formatShoulderHeight*`, `shoulderHeightRelativeTone`) |
| **Tests** | ✅ 16/16 passing | PersonListComponent + PersonService + person.util + http-params.util |

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
| `docs/SYNC_MERGE_STRATEGY.md` | Regles de sincronització (referència canònica) |
| `docs/API_PERSON_ENDPOINTS.md` | Endpoints REST de Person |
| `docs/VALIDATION_CHECKLIST.md` | Checklist de validació manual |
| `docs/TROUBLESHOOTING.md` | Solucions a problemes comuns |
| `docs/specs/` | Specs tècniques aprovades (P0-P2, Sync+Dashboard) |

---

## 🧪 Testing

### Backend

```bash
nx test api
```

**Resultat:** 34/34 tests passing

**Cobertura:**
- `PersonService` — CRUD, filtres, paginació, ordenació (default/ASC/DESC), activate/deactivate
- `PersonController` — endpoint `findAll`, envoltura `{ data, meta }`
- `PersonFilterDto` — validació `@IsIn` per `sortBy` i `sortOrder`, rebuig de valors invàlids
- `PositionService` — CRUD
- `LegacyApiClient` — autenticació multi-step (GET session + POST login + redirect)
- `PersonSyncStrategy` — create vs update, `deactivateMissingPersons`

### Frontend

```bash
nx test dashboard
```

**Resultat:** 16/16 tests passing

**Cobertura:**
- `PersonListComponent` — inicialització, `onSortColumn` (3 estats), toggle `shoulderHeightRelative`
- `PersonService` (Angular) — crides HTTP a `getAll` i `getPositions` amb params correctes
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

### 1. Validació Manual (P2 final)

Seguir checklist a `docs/VALIDATION_CHECKLIST.md`:
- [ ] Executar sync complet
- [ ] Verificar dades a dashboard
- [ ] Provar filtres i cerca
- [ ] Provar responsive (375px, 768px, 1024px)
- [ ] Verificar activate/deactivate manual

### 2. Ajustaments Post-Sync

Després del primer sync real:
- [ ] Revisar mappings de camps
- [ ] Ajustar regles de merge si cal
- [ ] Verificar soft delete automàtic
- [ ] Documentar anomalies

### 3. P3: Seasons + Events + Attendance

Següent fase del roadmap:
- [ ] Dissenyar entitats Season, Event, Attendance
- [ ] Implementar CRUD
- [ ] Afegir sync strategy per Events
- [ ] Dashboard UI per Events

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

- **Backend Sync:** `apps/api/src/modules/sync/`
- **Frontend Components:** `apps/dashboard/src/app/features/persons/`
- **Shared Utils:** `apps/dashboard/src/app/shared/utils/`
- **Rules:** `.cursor/rules/`

### Specs Aprovades

- **P0-P2:** `docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`
- **Sync + Dashboard:** `docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`

---

## 🎉 Fites Aconseguides

- ✅ **Vertical Slice P0-P2** — Complet i funcional
- ✅ **Migració a DaisyUI** — Stack UI estable
- ✅ **Sistema de Sync** — SSE + Strategy pattern + Merge rules
- ✅ **Dashboard Responsive** — Taula always-on amb scroll horitzontal
- ✅ **Arquitectura Moderna** — Signals + Standalone + OnPush
- ✅ **Documentació Exhaustiva** — 15+ documents tècnics
- ✅ **Ordenació server-side** — Whitelist de camps, protecció SQL injection
- ✅ **Alçada espatlles relativa** — Toggle absolut/relatiu amb codificació de color
- ✅ **Suite de tests completa** — 34/34 API + 16/16 dashboard passing

---

**Estat del projecte:** 🟢 **Actiu i saludable**
