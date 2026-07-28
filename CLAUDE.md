# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
It is the **single source of truth for agents**: `README.md` is for humans (setup + product overview) and
the topic docs live in `docs/` (navigable index: [docs/MAP.md](docs/MAP.md)).

For exact endpoints always read **Swagger** at `/api/docs` — never a hand-maintained list.

---

## Commands

```bash
# Setup
pnpm install
cp .env.example .env
pnpm run docker:up         # Start PostgreSQL in Docker (required for dev)

# Dev servers
nx serve api               # http://localhost:3000/api  |  Swagger: /api/docs
nx serve dashboard         # http://localhost:4200  (proxied to API via proxy.conf.json)
nx serve pwa               # Members PWA

# Tests
nx test api                # Jest — backend unit tests
nx test dashboard          # Vitest — dashboard unit tests
nx test pwa                # Vitest — PWA unit tests
nx test api --testFile=apps/api/src/modules/person/person.service.spec.ts   # single file
nx run api:test-integration  # Jest — integration tests against real Postgres (testcontainers)
pnpm run ci:local          # lint + test + build (all, excludes e2e)

# Lint / build
nx lint api | nx lint dashboard | nx lint pwa
nx build api | nx build dashboard | nx build pwa

# Dead code
pnpm run lint:dead         # knip: files, exports and deps with no consumers

# Database — migrations (synchronize: false; auto-run in dev via migrationsRun)
nx run api:migration-run             # Apply pending migrations
nx run api:migration-generate        # Generate migration from entity changes
nx run api:migration-revert          # Revert last migration
nx run api:reset-figure-data         # Dev reset: wipe instances/nodes/assignments

# Docker
pnpm run docker:down       # Stop (keeps data)
pnpm run docker:clean      # Stop + wipe volumes
pnpm run docker:psql       # Interactive SQL console
pnpm run docker:pre:up     # Pre-production stack
pnpm run docker:prod:up    # Production stack
```

---

## Domain

**MuixerApp** manages *colles muixerangueres*: people, attendance to rehearsals/performances, and the design
and staffing of **figures** (human constructions).

**Roles:** `ADMIN` (≡ TECHNICAL until multi-tenant exists) · `TECHNICAL` (full Dashboard + PWA access) ·
`MEMBER` (PWA: self-service attendance + read-only views).

**Flow:** Persons → Seasons → Events → Attendance. Per event: Segments → Figures (instances) → Assignment of
persons to nodes → Fullscreen projection.

---

## Architecture

### Monorepo layout

```
apps/api/          → NestJS 11 REST API (port 3000, prefix /api)
apps/dashboard/    → Angular 21 SPA admin (port 4200)
apps/pwa/          → Angular 21 PWA for members
apps/*-e2e/        → Playwright (e2e + responsive audit suite)
libs/shared/       → Shared enums, constants, interfaces — import via @muixer/shared
docs/              → Topic documentation (see docs/MAP.md)
.cursor/rules/     → Agent coding rules (important patterns)
.agents/skills/    → Stack-specific agent skills
```

**Stack:** NestJS 11 · TypeORM 0.3 · PostgreSQL 15+ · Passport/JWT · Swagger · Angular 21 (standalone,
OnPush, Signals) · DaisyUI v4 + Tailwind v3.4 · Konva 10 (imperative) · Lucide · Angular CDK · Nx 22 · pnpm ·
Node 22 · Docker Compose (dev/pre/prod) · GitHub Actions.

### Backend (`apps/api/src`)

Global guards registered in `app.module.ts`: `JwtAuthGuard` (all routes by default) + `RolesGuard` +
`ThrottlerGuard`. Mark public endpoints with `@Public()`, role-restricted ones with `@Roles()`.

Modules under `src/modules/`:

| Module | Content |
|--------|---------|
| `auth` | JWT (15min) + httpOnly refresh token (7d), Passport, token rotation, invite accept, bootstrap |
| `user` | admin/member accounts (`users`), roles, invite provisioning; OneToOne `Person` |
| `person` | CRUD + soft delete via `isActive` boolean |
| `person-delegate` | delegation: attendance on behalf of others (`managedBy` / `mentor`) |
| `season` · `event` | seasons, events and attendance |
| `figure` | `FigureTemplate`, `FigureNode`, `Rengla` |
| `composition` | `Composition` + `CompositionEntry` |
| `event-segment` | `EventSegment`, `FigureInstance`, `InstanceNode`, distribution, `ProjectionService` |
| `node-assignment` | assignment logic, lazy snapshot, ad-hoc nodes |
| `tag` | CRUD of position/role labels; entity maps to the `positions` table (M:N with Person) |
| `sync` | SSE strategy pattern for legacy data import |

**TypeORM conventions:** UUID primary keys · `createdAt`/`updatedAt` always present · soft delete =
`isActive: boolean` (not `@DeleteDateColumn`) · enums imported from `@muixer/shared` · table names plural
snake_case.

**API response envelope:** list endpoints return `{ data: T[], meta: { total, page, limit } }`. Single
resource returns the object directly. Soft deletes return 204.

**Filter/sort DTOs:** always use `@IsIn(SORT_FIELDS)` whitelist — never trust raw `sortBy` in `ORDER BY`.
Numeric query params need `@Type(() => Number)`.

**Migrations:** `apps/api/src/migrations/`, `synchronize: false`, auto-run in dev. No seed script — data
enters via the `sync` module.

### Frontend dashboard (`apps/dashboard/src/app`)

All components are standalone + `OnPush` + Signals. No NgRx. No `@Input()`/`@Output()` — use
`input()` / `output()`.

Routes (all behind `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`):

- `/home` → `HomeComponent`
- `/persons` → `PersonListComponent`
- `/rehearsals`, `/performances` → events feature (list + sync)
- `/events/:id` → `EventDetailComponent`, `/events/:id/confirmation` → `AttendanceConfirmationComponent`
- `/pinyes` → Pinyes module (see below)
- `/sync` → legacy sync SSE UI
- `/config` → `ConfigComponent`, with `/config/users`, `/config/tags`, `/config/seasons`

**Shared components** (`shared/components/`): `data/` (page-header, data-table, filter-bar, active-filters,
column-toggle, pagination, empty-state, stat-card) · `feedback/` (toast) · `forms/` (emoji-picker,
person-search-input) · `layout/` (header, tab-nav, user-chip). Compose list pages with these — never build
raw table/pagination HTML.

`app-data-table` has a **responsive card mode** below `lg` (`matchMedia`); flag the title column with
`primary: true` in its `ColumnDef`.

**Styling:** DaisyUI v4 + Tailwind CSS v3. No `@angular/material`. No `.scss` files unless animations are
needed. No `@apply`. Dynamic Tailwind classes must use static maps (not template literals). Theme generated
via `generateCollaTheme(primaryHex)` in `tailwind.config.js`.

**Canvas:** Konva 10.x used imperatively — not `ng2-konva` (incompatible with Angular 20+).

### Members PWA (`apps/pwa`)

Angular 21 + Service Worker (offline cache; **no push yet**), signals + `rxResource`.

**Routes:** `login` (alreadyAuthGuard) · `AppShell` behind `authGuard` +
`rolesGuard(MEMBER, TECHNICAL, ADMIN)`: `home`, `events`, `events/:id`, `profile` (placeholder).

**Features:** login, home (next rehearsal/performance), event agenda, event detail, and **attendance
confirmation** (`AttendanceButton`: Vinc/No vinc → ANIRE/NO_VAIG; ASSISTIT locked). `no-person-banner` for
accounts with no linked Person.

There are no dedicated `/me` endpoints: it consumes `/events`, `/auth/me`, `/events/:id/attendance`. The
`MeEvent`/`MeEventDetail` types live in `libs/shared/interfaces/me/`.

---

## Pinyes module — key domain concepts

### Concepts

| Concept | Description |
|---------|-------------|
| FigureTemplate / FigureNode | Reusable blueprint + nodes (PINYA, TRONC, BASE, directions, DECORATION) |
| Rengla | Radial sequence of pinya nodes per cordó |
| Composition / CompositionEntry | Reusable multi-figure composition |
| FigureInstance | A template/composition placed in a segment; lightweight until the 1st assignment |
| InstanceNode | Immutable copy of a FigureNode (lazy snapshot); may be `isAdHoc` |
| NodeAssignment | Person → InstanceNode, **never** to FigureNode |
| EventSegment | Time block of an event |

### Instance lifecycle

1. **Pre-snapshot** — `FigureInstance { snapshotted: false }`. Canvas reads live `FigureNode`s from the
   template.
2. **First assignment** — triggers automatic snapshot in a transaction: copies all `FigureNode`s into
   `InstanceNode`s, sets `snapshotted = true`. Subsequent template changes do NOT affect the instance.
3. **Post-snapshot** — canvas reads `InstanceNode`s (immutable). Assignments always point to `InstanceNode`,
   never to `FigureNode`.
4. Cordon selector and ad-hoc nodes mutate the instance (reversible via reset).
5. Deletion: CASCADE instance → InstanceNodes + NodeAssignments.

All nodes (PINYA, TRONC, BASE, directions) live in `figure_nodes` per template. `FigureNode.id` is stable
across saves (upsert by ID, not delete+recreate). `originNodeId` (optional) traces lineage when nodes are
duplicated or derived from another template.

### Invariants

1. `NodeAssignment` always points to an `InstanceNode`, never to a `FigureNode`.
2. Once `snapshotted`, `InstanceNode`s are unaffected by template changes.
3. `FigureInstance` has either `figureTemplate` **or** `composition` (XOR).
4. A person cannot hold two assignments in the same segment (unique `[segment, person]`) nor twice in the
   same instance (unique `[figureInstance, person]`).
5. TRONC/BASE: `x`/`width` in relative units; PINYA: pixels.

### Key components

**`SegmentWorkspaceComponent`** (`components/segment-workspace/`) is the unified per-segment workspace:
5 tabs (Pinyes, Troncs, Distribució, Nodes extra, Previsualitza) backed by `SegmentWorkspaceStateService`
(provided per workspace instance), composing the root `AssignmentStateService` for selection/assignment
state. `?tab=` and `?figure=` query params drive deep-linking; `UndoRedoService` is provided at the workspace
level so undo history spans tabs. The Previsualitza tab embeds `ProjectionViewComponent`
(`[embedded]="true"`) rather than duplicating projection rendering. There is no separate distribution
route — the Distribució tab covers it.

**`TroncViewComponent`** uses CSS Grid with a doubled internal grid (`x*2`, `width*2`) to support 0.5u steps.
Modes: `editor` | `assignment` | `projection`.

**`FigureCanvasComponent`** Konva modes: `editor` | `assignment` | `segment-assignment` | `readonly` |
`composition`. `segment-assignment` renders multiple figures (slots) on one canvas with assignment
interactions.

**`AssignmentStateService`** holds global canvas state via signals: `selectedNodeId`, `selectedPersonId`,
`activeInstanceId`, `assignments`, `confirmedPersons`, `pendingOperations`.

**Figure placement** (`utils/figure-placement.util.ts`) — `placeFigures` is a deterministic space-optimizing
layout: figures are packed into rows (segment order = reading order), choosing the row partition that
maximizes the fit-to-screen zoom for a reference screen; tronc panels are then placed near their own figure
by candidate scoring.

### Pinyes routes

```
/pinyes                                                     → TemplateListComponent
/pinyes/templates/new|:id/edit                              → TemplateEditorComponent (canDeactivate)
/pinyes/compositions/new|:id/edit                           → CompositionEditorComponent
/pinyes/events/:eventId/segments/:segmentId/assign[/:id]    → SegmentWorkspaceComponent (:id preselects)
/pinyes/events/:eventId/segments/:segmentId/project[/:id]   → ProjectionViewComponent (:id filters)
```

---

## Data model

Source of truth: `apps/api/src/modules/database/entities.ts`. Full detail in
[docs/DATA_MODEL.md](docs/DATA_MODEL.md).

| Entity | Table | Notes |
|--------|-------|-------|
| User | `users` | email, role, invite/reset tokens, OneToOne Person |
| Person | `persons` | provisional alias (`~`), gender, availabilityStatus, onboardingStatus, height; M:N Tag (`person_positions`) |
| PersonDelegate | `person_delegates` | user → person delegation (unique `[user, person]`) |
| Tag | `positions` | position/role labels (module `tag`) |
| Season | `seasons` | date range, no overlap |
| Event | `events` | EventType, attendanceSummary |
| Attendance | `attendances` | AttendanceStatus (unique `[person, event]`) |
| RefreshToken | `refresh_tokens` | rotation, SHA-256 hash, cron cleanup |
| FigureTemplate | `figure_templates` | name, slug, direction, `figureMode` |
| FigureNode | `figure_nodes` | zone, positionType, ringLevel, renglaId/Position, originNodeId, x/y |
| Rengla | `rengles` | radial node sequence per cordó |
| Composition / CompositionEntry | `compositions` / `composition_entries` | reusable composition |
| EventSegment | `event_segments` | time block of an event |
| FigureInstance | `figure_instances` | `snapshotted`, numberOfCordons, cordonsObertsEnabled, projection + distribution fields |
| InstanceNode | `instance_nodes` | immutable FigureNode copy; `isAdHoc`, sourceNodeId, originNodeId |
| NodeAssignment | `node_assignments` | Person → InstanceNode; denormalized `segment` FK |

**Enums (`@muixer/shared`):** `UserRole` · `AttendanceStatus` (PENDENT/ANIRE/NO_VAIG/ASSISTIT) ·
`AvailabilityStatus` · `OnboardingStatus` · `EventType` (ASSAIG/ACTUACIO) ·
`FigureMode` (COMPLETA/PEU/REMAT/NETA) · `FigureZone` · `NodeShape` · `Gender` ·
`ClientType` (dashboard/pwa) · `SegmentMoveConflictResolution`.

---

## Authentication

Login (email+password) → 15min JWT access token (in memory/signal) + 7d refresh token (httpOnly cookie with
rotation and reuse detection). On 401 the interceptor refreshes and retries. `logout` revokes the token,
`logout-all` revokes them all. `/auth` throttle: 10 req/60s. A cron job cleans expired refresh tokens.
**Invites do not send email yet** (`user.service` only logs the token).

Frontend: `AuthService` (signals `currentUser`, `isAuthenticated`, `userRole`, `hasLinkedPerson`),
`authGuard`, `rolesGuard(...)`, `AuthInterceptor`. Bootstrap silent refresh is gated by the
`muixer_has_session` localStorage hint (avoids the console 401 on the login screen).

Detail: [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md) · SSE: [docs/SSE_AUTH.md](docs/SSE_AUTH.md).

---

## Language conventions

- **Code** (variables, functions, classes, endpoints, DB columns, commits): **English**
- **UI text** (buttons, labels, messages, placeholders): **Catalan**
- **Domain terms:** `Person` (not Casteller), `Membre` (gender-neutral), `Xicalla` (children, not canalla)

---

## Testing conventions

- Backend: Jest, co-located `.spec.ts` files. Integration tests via testcontainers
  (`nx run api:test-integration`).
- Frontend: Vitest, co-located `.spec.ts` files.
- Coverage thresholds (enforced in CI via `--configuration=ci`): API 75/70/78/76
  (statements/branches/functions/lines), dashboard 40/35/40/40.
- Test a single backend file: `nx test api --testFile=<path>`.
- Playwright e2e + responsive audit suite: [docs/AUDIT_SUITE.md](docs/AUDIT_SUITE.md).

---

## Status and open work

- Phases and project status → [docs/ROADMAP.md](docs/ROADMAP.md)
- Technical debt and open findings → [docs/DEBT.md](docs/DEBT.md)

## Development guidelines

Always read the TDD skill (`.agents/skills/test-driven-development/`) and apply it when writing code. Read
and apply any other relevant skill before you start.

## Documentation map

[docs/MAP.md](docs/MAP.md) is an Obsidian vault (open `docs/` as the vault) that indexes every doc with
wikilinks and a generated map of the codebase. Check it before a broad architecture question — it's cheaper
than exploring the tree from scratch. There is no automation keeping it in sync (a deliberate choice, not an
oversight): **you are the maintenance mechanism.**

- After adding/removing an API module, a dashboard/PWA feature, or editing a `.entity.ts` file, run
  `pnpm run docs:map` and `pnpm run docs:model` and include the diff in your commit. These only touch the
  `<!-- BEGIN:AUTO -->…<!-- END:AUTO -->` sections of `docs/MAP.md` and `docs/DATA_MODEL.md` — never edit
  inside those markers by hand.
- After creating a new doc under `docs/`, give it YAML frontmatter with a `tags: [domini|infra|qa|hub]`
  (see existing docs for the pattern — this is what colors Obsidian's graph view), a `*Veïns: [[...]]*`
  footer linking its 2–4 closest neighbors, and a row in the relevant table of `docs/MAP.md`.
- After resolving an item in [docs/DEBT.md](docs/DEBT.md), delete its row — don't mark it "✅ Resolved".
  The git log is the history; the doc only tracks what's still open.
