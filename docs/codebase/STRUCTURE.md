# Estructura del Projecte — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Evidència: exploració directa dels fitxers del repositori.

---

## 1. Mapa de Directoris d'Arrel

| Directori / Fitxer | Propòsit |
|--------------------|----------|
| `apps/api/` | Backend NestJS (API REST + SSE) |
| `apps/dashboard/` | Frontend Angular (panell d'administració tècnica) |
| `apps/pwa/` | Frontend Angular (PWA mòbil per a membres) — scaffold creat, pendent d'implementar (P6) |
| `apps/dashboard-e2e/` | Tests E2E Playwright per al Dashboard |
| `apps/pwa-e2e/` | Tests E2E Playwright per a la PWA |
| `libs/shared/` | Codi compartit entre backend i frontend (enums, interfaces) |
| `docs/` | Documentació del projecte (roadmap, model de dades, auth, etc.) |
| `docs/codebase/` | Documents de coneixement del codebase (aquest directori) |
| `docs/specs/` | Especificacions tècniques aprovades per fase (P0–P4.3) |
| `.cursor/rules/` | Regles per a l'agent AI (Cursor) |
| `.agents/skills/` | Skills de l'agent AI (brainstorming, components, etc.) |
| `.env.example` | Plantilla de variables d'entorn |
| `nx.json` | Configuració del monorepo Nx |
| `tsconfig.base.json` | Path aliases compartits (`@muixer/shared`, `@app/*`) |
| `tailwind.config.js` | Tema DaisyUI personalitzat (`generateCollaTheme`) |

---

## 2. Punts d'Entrada

| Aplicació | Fitxer d'entrada | Com s'inicia |
|-----------|-----------------|--------------|
| Backend API | `apps/api/src/main.ts` | `nx serve api` → NestJS bootstrap |
| Dashboard | `apps/dashboard/src/main.ts` | `nx serve dashboard` → Angular bootstrap |
| PWA | `apps/pwa/src/main.ts` | `nx serve pwa` → Angular bootstrap (pendent) |

---

## 3. Estructura del Backend (`apps/api/src/`)

```
apps/api/src/
├── main.ts                     # Bootstrap: CORS, ValidationPipe, Swagger, cookies
├── app/
│   ├── app.module.ts           # Mòdul arrel: imports tots els feature modules + guards globals
│   ├── app.controller.ts       # Health check endpoint
│   └── app.service.ts          # Servei mínim de l'app
├── common/
│   └── interceptors/
│       └── latency.interceptor.ts  # Afegeix X-Response-Time a totes les respostes
└── modules/
    ├── auth/                   # Autenticació: JWT+Passport, guards, decoradors, refresh tokens
    ├── database/               # Connexió TypeORM + seed scripts
    ├── event/                  # Esdeveniments (assajos/actuacions) + assistència
    ├── person/                 # Membres de la colla (CRUD + filtres)
    ├── position/               # Posicions muixerangueres (CRUD)
    ├── season/                 # Temporades (llista + detall)
    ├── sync/                   # Sincronització unidireccional des del legacy APPsistència
    └── user/                   # Comptes d'accés (entitat + servei)
```

### Estructura interna d'un mòdul (exemple: `person/`)

```
modules/person/
├── dto/
│   ├── create-person.dto.ts
│   ├── update-person.dto.ts
│   ├── person-filter.dto.ts
│   └── person-response.dto.ts
├── entities/
│   └── person.entity.ts
├── person.controller.ts
├── person.service.ts
├── person.module.ts
└── person.controller.spec.ts, person.service.spec.ts
```

### Mòdul d'autenticació (`auth/`)

```
modules/auth/
├── constants/auth.constants.ts
├── decorators/
│   ├── current-user.decorator.ts   # @CurrentUser() — extreu JwtPayload del request
│   ├── public.decorator.ts         # @Public() — exclou del JwtAuthGuard
│   └── roles.decorator.ts          # @Roles() — restringeix per rol
├── dto/
│   ├── login.dto.ts
│   ├── accept-invite.dto.ts
│   ├── setup-user.dto.ts
│   └── auth-response.dto.ts
├── entities/
│   └── refresh-token.entity.ts
├── guards/
│   ├── jwt-auth.guard.ts           # Guard global — respecta @Public()
│   └── roles.guard.ts              # Guard global — respecta @Roles()
├── strategies/
│   ├── jwt.strategy.ts             # Passport JWT: extreu Bearer token
│   └── local.strategy.ts           # Passport Local: email + password
├── auth.controller.ts              # 7 endpoints d'auth
├── auth.module.ts
├── auth.service.ts
└── token.service.ts                # CRUD refresh tokens amb detecció de reutilització
```

### Mòdul de sincronització (`sync/`)

```
modules/sync/
├── strategies/
│   ├── person-sync.strategy.ts     # Sincronitza persones des de /api/castellers
│   ├── event-sync.strategy.ts      # Sincronitza assajos i actuacions
│   └── attendance-sync.strategy.ts # Sincronitza assistència via XLSX
├── interfaces/
│   └── legacy-event.interface.ts
├── legacy-api.client.ts            # Client HTTP per al legacy APPsistència (sessió PHP)
├── sync.controller.ts              # Endpoints SSE per activar la sync
└── sync.module.ts
```

---

## 4. Estructura del Frontend (`apps/dashboard/src/app/`)

```
apps/dashboard/src/app/
├── app.ts                          # Component arrel (standalone)
├── app.html                        # Template arrel: header + tab-nav + router-outlet
├── app.routes.ts                   # Rutes principals amb lazy loading
├── app.config.ts                   # providers: HttpClient, Router, interceptors, guards
│
├── core/                           # Serveis singleton i lògica transversal
│   ├── auth/
│   │   ├── services/auth.service.ts    # Signal-based: currentUser, isReady, refresh dedup
│   │   ├── interceptors/auth.interceptor.ts  # Afegeix Bearer + retry 401→refresh
│   │   ├── guards/auth.guard.ts        # Redirigeix a /login si no autenticat
│   │   ├── guards/role.guard.ts        # Verifica rol abans d'activar ruta
│   │   └── models/auth.models.ts
│   ├── services/
│   │   ├── api.service.ts              # Wrapper HttpClient amb baseUrl
│   │   └── layout.service.ts           # Fullscreen signal per al mòdul Pinyes
│   └── utils/
│       └── http-params.util.ts         # Construeix HttpParams des d'objectes
│
├── shared/                         # Components i utilitats reutilitzables
│   ├── components/
│   │   ├── data/                       # data-table, page-header, filter-bar, pagination, etc.
│   │   ├── feedback/                   # toast, confirm-dialog, skeleton-rows, skeleton-cards
│   │   ├── forms/                      # form-field, person-search-input
│   │   └── layout/                     # header, tab-nav, user-chip
│   ├── models/
│   │   ├── column-def.model.ts
│   │   └── sort.model.ts
│   └── utils/
│       ├── color.util.ts
│       ├── date.util.ts
│       ├── person.util.ts
│       └── index.ts                    # Barrel re-export
│
└── features/                       # Funcionalitats per domini
    ├── auth/
    │   └── login/login.component.ts
    ├── home/
    │   └── home.component.ts           # Pàgina d'inici amb preview d'events i nav cards
    ├── persons/
    │   ├── components/person-list/, person-detail/, person-sync/
    │   ├── services/person.service.ts
    │   ├── models/
    │   └── persons.routes.ts
    ├── events/
    │   ├── components/event-list/, event-detail/, event-sync/, event-form-modal/, attendance-edit-modal/
    │   ├── services/event.service.ts, attendance.service.ts, season.service.ts
    │   ├── models/
    │   └── events.routes.ts            # Factories: rehearsalRoutes(), performanceRoutes()
    ├── sync/
    │   └── global-sync.component.ts    # Hub global de sincronització
    ├── pinyes/
    │   └── pinyes-placeholder.component.ts  # Placeholder per a P5
    └── config/
        ├── config.component.ts
        └── config-placeholder.component.ts  # Sub-rutes: users, tags, seasons
```

---

## 5. Biblioteca Compartida (`libs/shared/src/`)

```
libs/shared/src/
├── index.ts                        # Barrel: exporta tots els enums i interfaces
├── enums/
│   ├── attendance-status.enum.ts   # ANIRE, ASSISTIT, NO_VAIG, NO_PRESENTAT, PENDENT
│   ├── availability-status.enum.ts # AVAILABLE, TEMPORARILY_UNAVAILABLE, LONG_TERM_UNAVAILABLE
│   ├── client-type.enum.ts         # DASHBOARD, PWA
│   ├── event-type.enum.ts          # REHEARSAL, PERFORMANCE
│   ├── figure-zone.enum.ts         # PINYA, TRONC, FIGURE_DIRECTION, XICALLA_DIRECTION
│   ├── gender.enum.ts              # MALE, FEMALE, OTHER
│   ├── onboarding-status.enum.ts   # COMPLETED, IN_PROGRESS, LOST, NOT_APPLICABLE
│   └── user-role.enum.ts           # ADMIN, TECHNICAL, MEMBER
└── interfaces/
    ├── attendance-summary.interface.ts
    ├── auth.interfaces.ts          # JwtPayload, UserProfile, PersonSummary
    └── event-metadata.interface.ts # Metadata per assajos i actuacions
```

---

## 6. Regles de Nomenclatura

| Àmbit | Regla | Exemple |
|-------|-------|---------|
| Fitxers | `kebab-case` amb sufix del tipus | `person-list.component.ts`, `auth.service.ts` |
| Classes Angular | `PascalCase` + sufix | `PersonListComponent`, `AuthService` |
| Classes NestJS | `PascalCase` + sufix | `PersonService`, `JwtAuthGuard` |
| Interfaces | `PascalCase` sense prefix | `UserProfile`, `JwtPayload` |
| Enums | `PascalCase` | `UserRole`, `AttendanceStatus` |
| Valors d'enum | `UPPER_SNAKE_CASE` | `ANIRE`, `NO_VAIG` |
| Signals Angular | `camelCase` | `currentUser`, `isAuthenticated` |
| Constants | `UPPER_SNAKE_CASE` | `SEASON_CUTOFF`, `API_BASE_URL` |
| Directoris features | `kebab-case` | `features/persons/`, `features/events/` |

---

## 7. Path Aliases (`tsconfig.base.json`)

| Alias | Apunta a |
|-------|----------|
| `@muixer/shared` | `libs/shared/src/index.ts` |
| `@app/*` | `apps/dashboard/src/app/*` |

---

## 8. Evidència

- `apps/api/src/main.ts` — bootstrap del backend
- `apps/api/src/app/app.module.ts` — mòdul arrel
- `apps/dashboard/src/app/app.routes.ts` — rutes del dashboard
- `libs/shared/src/index.ts` — exports de la biblioteca compartida
- `tsconfig.base.json` — path aliases
- Exploració directa de l'arbre de directoris via scan.py
