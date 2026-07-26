# MuixerApp — Document de Context

> Resum de referència per a IA i col·laboradors. Visió global compacta: arquitectura, estat i decisions.
> Per al detall viu dels endpoints → **Swagger `/api/docs`**. Docs dedicats a `docs/` (vegeu §14).
> **Última actualització:** 23 de juliol de 2026

---

## 1. Visió general

**MuixerApp** gestiona colles muixerangueres: persones, assistència a assajos/actuacions i el disseny i assignació de **figures** (construccions humanes). Dues apps client: **Dashboard** (admin, tècnics) i **PWA** (membres).

**Rols:** `ADMIN` (≡ TECHNICAL fins multi-tenant) · `TECHNICAL` (accés total Dashboard + PWA) · `MEMBER` (PWA: autogestió assistència + visualització).

**Flux:** Persones → Temporades → Esdeveniments → Assistència. Per event: Segments → Figures (instàncies) → Assignació de persones a nodes → Projecció fullscreen.

---

## 2. Stack tecnològic

| Àrea | Tecnologia |
|------|-----------|
| Backend | NestJS 11, TypeORM 0.3, PostgreSQL 15+, Passport + JWT, Swagger |
| Dashboard | Angular 21 (standalone, OnPush, Signals), DaisyUI v4, Tailwind v3.4, Konva 10 (imperatiu), Lucide, Angular CDK |
| PWA | Angular 21 + Service Worker (offline cache), DaisyUI/Tailwind, Lucide |
| Monorepo | Nx 22.7, pnpm, Node 22 LTS |
| Infra | Docker Compose (dev/pre/prod), GitHub Actions CI |
| Tests | Jest (API), Vitest (dashboard/pwa) |

**Decisions clau:** Konva API imperativa (no `ng2-konva`) · access token en memòria/signal + refresh token httpOnly cookie · PostgreSQL Docker local · JWT 15min + refresh 7d amb rotació · zero custom CSS (DaisyUI tokens) · UI en català, codi en anglès · **DB via migracions TypeORM** (`synchronize: false`) · npm→pnpm (juny 2026).

---

## 3. Estructura del monorepo

```
apps/
  api/                 NestJS REST API (port 3000, prefix /api)
    src/modules/       auth, user, person, season, event, sync,
                       figure, composition, event-segment,
                       node-assignment, tag, database
    src/migrations/    Migracions TypeORM (~29, InitialSchema → …)
  dashboard/           Angular SPA admin (port 4200)
  pwa/                 Angular PWA membres (implementada)
  *-e2e/               Playwright
libs/shared/           Enums, constants, interfaces — @muixer/shared
docs/                  Specs, roadmap, docs de codebase, audits
.cursor/rules/         Regles per a agents IA
```

---

## 4. Roadmap i estat

| Fase | Contingut | Estat |
|------|-----------|-------|
| P0–P3.1 | Scaffold, Persones, Sync legacy, Temporades (CRUD), Events + Assistència | ✅ |
| P4.1–4.4 | Auth (JWT), Dashboard Events, Design Refactor (DaisyUI), Docker multi-entorn | ✅ |
| P5.1–5.2 | Pinyes: Templates + Editor Konva, Composicions | ✅ |
| P5.3–5.5 | Segments + Instàncies, Assignació persones, Snapshot lazy + upgrade cordó | ✅ |
| P5.6–5.9 | Troncs (CSS Grid), tronc a nivell família, ordre bases, Projecció (grid CSS) | ✅ |
| P5.10–5.12 | Posicions/Lock/Historials, Rengles, **Nodes ad-hoc** (substitueix ReferenceElement) | ✅ |
| Refactors | Unified Segment Workspace, presets unificats, distribució segments, cordons oberts | ✅ |
| PWA | App membres: login, agenda, confirmació assistència | ✅ (a develop) |
| Audit suite | Fixes a11y/responsive (tap targets, mobile guards, card mode) | 🔵 En curs |
| P5.3.1 | Revisió UX segments (tab a event-detail) | ⚪ Pendent |
| P6.2 / P7 / P8+ | Push (FCM), informes, estadístiques, multi-tenant, export PDF | ⚪ Pendent |

**Simplificacions de model:** eliminades `FigureFamily` i `ReferenceElement`. `hasPinya` → `FigureMode`.

---

## 5. Model de dades

Font de veritat: `apps/api/src/modules/database/entities.ts` (16 entitats).

| Entitat | Taula | Notes |
|---------|-------|-------|
| User | `users` | email, role, tokens invite/reset, OneToOne Person |
| Person | `persons` | alias provisional (`~`), gender, availabilityStatus, onboardingStatus, notes, emoji, alçada; M:N Tag (`person_positions`); `managedBy`(User), `mentor`(Person) |
| Tag | `positions` | Etiquetes de posició/rol per persones (mòdul `tag`) |
| Season | `seasons` | Rang de dates, no solapament |
| Event | `events` | EventType, attendanceSummary |
| Attendance | `attendances` | AttendanceStatus |
| RefreshToken | `refresh_tokens` | Rotació, hash |
| FigureTemplate | `figure_templates` | name, slug, direction, `figureMode` |
| FigureNode | `figure_nodes` | zone, positionType, ringLevel, renglaId/Position, originNodeId, x/y |
| Rengla | `rengles` | Seqüència radial de nodes per cordó |
| Composition | `compositions` | Composició reutilitzable |
| CompositionEntry | `composition_entries` | Entrada (figura + offset) d'una composició |
| EventSegment | `event_segments` | Bloc temporal d'un event |
| FigureInstance | `figure_instances` | `snapshotted`, numberOfCordons, cordonsObertsEnabled, projectionX/Y/Scale, camps distribució |
| InstanceNode | `instance_nodes` | Còpia immutable de FigureNode; `isAdHoc`, sourceNodeId, originNodeId |
| NodeAssignment | `node_assignments` | Person → InstanceNode. FK `segment` denormalitzat; unique `[segment, person]` |

**Enums (`@muixer/shared`):** `UserRole`, `AttendanceStatus` (PENDENT/ANIRE/NO_VAIG/ASSISTIT), `AvailabilityStatus`, `OnboardingStatus`, `EventType` (ASSAIG/ACTUACIO), `FigureMode` (COMPLETA/PEU/REMAT/NETA), `FigureZone` (BASE/PINYA/TRONC/FIGURE_DIRECTION/XICALLA_DIRECTION/DECORATION), `NodeShape` (ELLIPSE/RECTANGLE/ARROW/CIRCLE), `Gender`, `ClientType` (dashboard/pwa), `SegmentMoveConflictResolution`.

---

## 6. Backend API — mòduls i endpoints

Prefix global `/api`. `JwtAuthGuard` + `RolesGuard` + `ThrottlerGuard` globals; `@Public()` per obrir. **Detall complet i sempre actualitzat → Swagger `/api/docs`.**

| Base | Mòdul | Rutes clau |
|------|-------|-----------|
| `/auth` | auth | login, refresh, logout, logout-all, me, invite/accept, setup/user (bootstrap X-Setup-Token). Throttle 10/60s |
| `/users` | user | CRUD, create-with-invite, grant-role (ADMIN), deactivate |
| `/persons` | person | list/detail/create/update/soft-delete, provisional, activate |
| `/seasons` | season | CRUD, current |
| `/events` | event | CRUD + `/attendance` CRUD (409 si duplicat/té assistència) |
| `/sync` | sync | SSE (ADMIN): persons, events, events/:id/attendance, all |
| `/figure-templates` | figure | CRUD, duplicate, save-from-instance, suggest-version-name |
| `/compositions` | composition | CRUD, duplicate |
| `/events/:eventId/segments` | event-segment | segments CRUD + reorder, instances CRUD + reorder/move/copy, distribution GET/PUT/DELETE, projection, apply-composition, tronc-view |
| `/figure-instances/...` `/events/:id/...` | node-assignment | nodes, assignments (assign auto-snapshot / swap / unassign / bulk), cordons, reset, ad-hoc-nodes CRUD, available-persons, history, lock-status, next-performance, assignment-summary |
| `/tags` | tag | CRUD (409 si en ús) |

> **Nota:** el mòdul `me` és un stub buit (no muntat). Els tipus PWA (`MeEvent`) viuen a `libs/shared/interfaces/me/`. Els **invites no envien email** encara (`user.service` només logueja el token — TODO SEC-6).

---

## 7. Frontend dashboard (`apps/dashboard`)

Navegació: top bar amb tabs (Inici, Persones, Assajos/Actuacions, Pinyes, Configuració), responsive (desktop icon+text → tablet icon → mobile dropdown). Tema `data-theme="colla-barcelona"` generat via `generateCollaTheme(primaryHex)`.

**Features:**
- **home** — inici amb preview d'events.
- **auth** — login (JWT signal + refresh cookie; interceptor 401→refresh→retry).
- **persons** — llista/detall, filtres (cerca, cens/provisionals/tots), ordenació server-side, alçada abs/rel, provisionals inline, historial pinyes; modals invitació i vincular usuari.
- **events** — llista (tabs assajos/actuacions), event-detail inline (info + SegmentManager + assistència), CRUD via modal, attendance CRUD optimista, `attendance-confirmation` (keypad).
- **pinyes** — vegeu §9.
- **config** — landing + sub-rutes `users`, `tags`, `seasons` (llistes + form modals).
- **sync** — sincronització global SSE del legacy.

**Shared components** (`shared/components/`): `data/` (page-header, data-table, filter-bar, active-filters, column-toggle, pagination, empty-state, stat-card) · `feedback/` (toast) · `forms/` (form-field, emoji-picker, person-search-input) · `layout/` (header, tab-nav, user-chip). Compondre sempre amb aquests, mai HTML de taula/paginació cru.

**Rutes:** tot sota `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`. `unsavedChangesGuard` (canDeactivate) a l'editor de templates.

---

## 8. PWA de membres (`apps/pwa`)

App mòbil per a membres (implementada). Angular 21 + Service Worker (offline cache; **sense push encara**), UI DaisyUI/Tailwind, signals + `rxResource`.

**Rutes:** `login` (alreadyAuthGuard) · `AppShell` sota `authGuard` + `rolesGuard(MEMBER, TECHNICAL, ADMIN)`: `home`, `events`, `events/:id`, `profile` (placeholder).

**Funcionalitat:** login, home (proper assaig/actuació), agenda/calendari d'events, detall, i **confirmació d'assistència** (`AttendanceButton`: Vinc/No vinc → ANIRE/NO_VAIG; ASSISTIT bloquejat). `no-person-banner` per a comptes sense Person vinculada.

**Auth:** access token en memòria (signal) + refresh cookie httpOnly; login envia `clientType: PWA`; refresh silent al bootstrap (gated per hint `muixer_has_session` a localStorage). Sense endpoints `/me` propis encara — consumeix `/events`, `/auth/me`, `/events/:id/attendance`.

---

## 9. Mòdul de Pinyes

### Conceptes

| Concepte | Descripció |
|----------|-----------|
| FigureTemplate / FigureNode | Blueprint reutilitzable + nodes (PINYA, TRONC, BASE, direccions, DECORATION) |
| Rengla | Seqüència radial de nodes de pinya per cordó |
| Composition / CompositionEntry | Composició multi-figura reutilitzable |
| FigureInstance | Presència d'un template/composició en un segment; lleugera fins la 1a assignació |
| InstanceNode | Còpia immutable de FigureNode (snapshot lazy); pot ser `isAdHoc` |
| NodeAssignment | Persona → InstanceNode, **mai** a FigureNode |
| EventSegment | Bloc temporal d'un event |

### Cicle de vida d'una instància

1. **Pre-snapshot** (`snapshotted: false`) → canvas llegeix els `FigureNode` vius del template.
2. **1a assignació** → snapshot automàtic en transacció: copia FigureNodes → InstanceNodes, `snapshotted = true`, crea NodeAssignment (match per `sourceNodeId`).
3. **Post-snapshot** → canvas llegeix InstanceNodes immutables; canvis al template NO afecten la instància.
4. Selector de cordons i nodes ad-hoc modifiquen la instància (reversible via reset).
5. Eliminació: CASCADE instància → InstanceNodes + NodeAssignments.

### Components i serveis (`features/pinyes/`)

- **`SegmentWorkspaceComponent`** — workspace unificat per segment, 5 tabs (`pinyes`, `troncs`, `distribucio`, `nodes`, `previsualitza`), deep-link via `?tab=`/`?figure=`. Backed per `SegmentWorkspaceStateService` (per instància) composant `AssignmentStateService`; `UndoRedoService` a nivell workspace. La tab Previsualitza incrusta `ProjectionViewComponent` (`[embedded]`). *(No existeix `AssignmentCanvasComponent`.)*
- **`FigureCanvasComponent`** (Konva) — modes: `editor`, `assignment`, `segment-assignment` (multi-figura), `readonly`, `composition`.
- **`TroncViewComponent`** — CSS Grid doblejat (`x*2`, `width*2`) per steps 0.5u; modes `editor`/`assignment`/`projection`.
- **`SegmentCanvasComponent`**, `ProjectionViewComponent`, `TemplateEditorComponent`, `CompositionEditorComponent`, `TemplateListComponent`, + panells (person-panel, figure-properties, ad-hoc-node-properties), modals i overlays.
- Serveis: `assignment-state`, `canvas-state`, `segment-workspace-state`, `event-segment`, `figure-instance`, `figure-template`, `composition`, `node-assignment`, `projection`, `segment-distribution`, `undo-redo`.

**Placement** (`utils/figure-placement.util.ts`): `placeFigures` empaqueta figures en files (ordre de segment = lectura) maximitzant el zoom fit-to-screen; panells de tronc situats prop de la seva figura.

### Rutes

```
/pinyes                                              TemplateListComponent
/pinyes/templates/new|:id/edit                       TemplateEditorComponent (canDeactivate)
/pinyes/compositions/new|:id/edit                    CompositionEditorComponent
/pinyes/events/:eventId/segments/:segmentId/assign[/:instanceId]   SegmentWorkspaceComponent
/pinyes/events/:eventId/segments/:segmentId/project[/:instanceId]  ProjectionViewComponent
```

### Invariants

1. `NodeAssignment` apunta **sempre** a `InstanceNode`, mai a `FigureNode`.
2. Un cop `snapshotted`, els `InstanceNode` no es modifiquen per canvis al template.
3. `FigureInstance` té `figureTemplate` **o** `composition` (XOR).
4. Una persona NO pot estar en dues assignacions del **mateix segment** (unique `[segment, person]`).
5. Tots els nodes viuen a `figure_nodes` per template. TRONC/BASE: `x`/`width` en unitats relatives; PINYA: píxels.
6. `FigureNode.id` estable entre saves (upsert per ID).

---

## 10. Autenticació i seguretat

Login (email+password) → access token JWT 15min (memòria/signal) + refresh token 7d (httpOnly cookie). 401 → interceptor fa refresh (rotació) → reintenta. Logout revoca token; logout-all revoca tots. `@Public()` obre endpoints (login, refresh, invite/accept, setup/user). `RolesGuard` + `@Roles()` per rol. `ThrottlerGuard` (auth 10/60s). Cron neteja refresh tokens expirats. Invites: token hash a `users`; **email encara no s'envia (TODO)**.

Frontend: `AuthService` (signals `currentUser`, `isAuthenticated`, `userRole`, `hasLinkedPerson`), `authGuard`, `rolesGuard(...)`, `AuthInterceptor`.

---

## 11. Patrons i convencions

- **Idioma:** UI català · codi anglès. Termes domini: `Person` (no Casteller), `Membre`, `Xicalla`.
- **Angular:** standalone + OnPush + Signals (no NgRx). `input()`/`output()`, no `@Input/@Output`. Dynamic Tailwind via mapes estàtics.
- **CSS:** DaisyUI v4 + Tailwind v3, zero custom CSS/`@apply`; `.scss` només per animacions.
- **TypeORM:** UUID PK, `createdAt`/`updatedAt` sempre, soft delete = `isActive` boolean (no `@DeleteDateColumn`), taules plural snake_case.
- **API envelope:** llistes `{ data, meta: { total, page, limit } }`; recurs únic = objecte; soft delete 204. Filtres/sort amb whitelist `@IsIn(SORT_FIELDS)`.
- **Patrons:** Strategy (sync), lazy snapshot, upsert per ID, optimistic UI + rollback, undo/redo, signals.

---

## 12. Testing

Co-ubicats `.spec.ts`: Jest (API, + integració amb testcontainers via `api:test-integration`), Vitest (dashboard/pwa). Cobertura CI (`--configuration=ci`): API 75/70/78/76, dashboard 40/35/40/40. `pnpm run ci:local` = lint + test + build. E2E Playwright: cobertura mínima (deute conegut).

---

## 13. DevOps i infraestructura

```bash
pnpm install && cp .env.example .env
pnpm run docker:up          # PostgreSQL Docker (dev)
nx serve api                # http://localhost:3000/api  (Swagger /api/docs)
nx serve dashboard          # http://localhost:4200
nx run api:migration-run    # aplicar migracions (auto en dev via migrationsRun)
nx run api:reset-figure-data
pnpm run ci:local
```

**Entorns:** dev local (Docker), pre (Hetzner), prod (VPS) — `docker:pre:up` / `docker:prod:up`. **DB:** `synchronize: false`, migracions TypeORM a `apps/api/src/migrations/` (auto-run en dev). No hi ha seed; les dades entren via sync del legacy. **CI:** GitHub Actions (`nx affected` a PRs). **Env vars clau:** `DATABASE_URL`, `DB_SSL`, `JWT_SECRET`, `CORS_ORIGINS`, `SETUP_TOKEN`, `LEGACY_API_URL`.

---

## 14. Pendents i futur

**Immediat:** tancar audit suite (a11y/responsive), P5.3.1 (UX segments), E2E Playwright.
**Futur:** push notifications PWA (P6.2/FCM), informes d'assistència, estadístiques (P8), export PDF de pinyes, multi-tenant (`collaId` al JWT), auditoria/versionat.
**Deute tècnic:** N+1 al sync (bulk upsert futur), enviament real d'emails d'invitació (SEC-6), cobertura E2E.

---

## 15. Documentació de referència (`docs/`)

`INDEX.md` (entrada) · `PROJECT_ROADMAP.md` (fases + decisions) · `CURRENT_STATUS.md` (frontier) · `PHASES_LOG.md` · `DATA_MODEL.md` · `PINYES_MODULE.md` · `AUTH_FLOW.md` / `SSE_AUTH.md` · `DASHBOARD_UI.md` · `SYNC_ARCHITECTURE.md` · `DOCKER_ARCHITECTURE.md` · `docs/codebase/` (ARCHITECTURE, STACK, TESTING, CONVENTIONS, STRUCTURE, INTEGRATIONS, CONCERNS) · `docs/specs/` (specs per fase) · `docs/audit/` · `.cursor/rules/` (regles IA).

---

*Actualitzar quan canviï l'estat d'una fase, el model de dades o l'arquitectura. Per a endpoints exactes, consultar sempre Swagger.*
