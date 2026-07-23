# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Tests
nx test api                # Jest — backend unit tests
nx test dashboard          # Vitest — frontend unit tests
nx test api --testFile=apps/api/src/modules/person/person.service.spec.ts   # single file
nx run api:test-integration  # Jest — backend integration tests against real Postgres (testcontainers)
pnpm run ci:local          # lint + test + build (all, excludes e2e)

# Lint
nx lint api
nx lint dashboard

# Build
nx build api
nx build dashboard

# Database — migrations (synchronize: false; auto-run in dev via migrationsRun)
nx run api:migration-run             # Apply pending migrations
nx run api:migration-generate        # Generate migration from entity changes
nx run api:migration-revert          # Revert last migration
nx run api:reset-figure-data         # Dev reset: wipe instances/nodes/assignments
nx run api:migrate-tronc-units       # P5.6 one-off script

# Docker
pnpm run docker:down       # Stop (keeps data)
pnpm run docker:clean      # Stop + wipe volumes
pnpm run docker:psql       # Interactive SQL console
pnpm run docker:prod:up    # Production stack
pnpm run docker:pre:up     # Pre-production stack
```

---

## Architecture

### Monorepo layout

```
apps/api/          → NestJS 11 REST API (port 3000)
apps/dashboard/    → Angular 21 SPA admin (port 4200)
apps/pwa/          → Angular 21 PWA for members (implemented: login, agenda, attendance confirmation)
libs/shared/       → Shared enums, constants, interfaces — import via @muixer/shared
docs/              → Specs, architecture docs, roadmap
.cursor/rules/     → Agent coding rules (important patterns)
```

### Backend (`apps/api/src`)

Global guards registered in `app.module.ts`: `JwtAuthGuard` (all routes by default) + `RolesGuard`. Mark public endpoints with `@Public()`.

Modules under `src/modules/`:
- `auth` — JWT (15min) + httpOnly refresh token (7d), Passport, token rotation, invite accept, bootstrap
- `user` — admin/member accounts (`users`), roles, invite provisioning; OneToOne `Person`
- `person` — CRUD + soft delete via `isActive` boolean; delegation via `managedBy`/`mentor`
- `event` + `season` + attendance
- `figure` — `FigureTemplate`, `FigureNode`, `Rengla`
- `composition` — `Composition` + `CompositionEntry`
- `event-segment` — `EventSegment`, `FigureInstance`, `InstanceNode`, distribution + `ProjectionService`
- `node-assignment` — assignment logic, lazy snapshot, ad-hoc nodes
- `tag` — CRUD of position/role labels; entity maps to the `positions` table (M:N with Person)
- `sync` — SSE strategy pattern for legacy data import
- `me` — empty stub (not wired); PWA `MeEvent` types live in `libs/shared`

DB uses TypeORM **migrations** (`apps/api/src/migrations/`), `synchronize: false`, auto-run in dev. No seed script — data enters via `sync`.

**TypeORM conventions:** UUID primary keys, `createdAt`/`updatedAt` always present, soft delete = `isActive: boolean` (not `@DeleteDateColumn`), enums imported from `@muixer/shared`, table names plural snake_case.

**API response envelope:** list endpoints return `{ data: T[], meta: { total, page, limit } }`. Single resource returns the object directly. Soft deletes return 204.

**Filter/sort DTOs:** always use `@IsIn(SORT_FIELDS)` whitelist — never trust raw `sortBy` in `ORDER BY`. Numeric query params need `@Type(() => Number)`.

### Frontend (`apps/dashboard/src/app`)

All components are standalone + `OnPush` + Signals. No NgRx. No `@Input()`/`@Output()` — use `input()` / `output()`.

Routes (all behind `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`):
- `/home` → `HomeComponent`
- `/persons` → `PersonListComponent`
- `/rehearsals`, `/performances` → events feature (list + sync)
- `/events/:id` → `EventDetailComponent`, `/events/:id/confirmation` → `AttendanceConfirmationComponent`
- `/pinyes` → Pinyes module (see below)
- `/sync` → legacy sync SSE UI
- `/config` → `ConfigComponent`, with `/config/users`, `/config/tags`, `/config/seasons`

**Shared components** (`shared/components/`): compose list pages with `app-page-header`, `app-data-table`, `app-filter-bar`, `app-active-filters`, `app-column-toggle`, `app-pagination`, `app-empty-state`, `app-confirm-dialog`, `app-toast`. Never build raw table/pagination HTML.

**Styling:** DaisyUI v4 + Tailwind CSS v3. No `@angular/material`. No `.scss` files unless animations are needed. No `@apply`. Dynamic Tailwind classes must use static maps (not template literals). Theme generated via `generateCollaTheme(primaryHex)` in `tailwind.config.js`.

**Canvas:** Konva 10.x used imperatively — not `ng2-konva` (incompatible with Angular 20+).

### Pinyes module — key domain concepts

The figures module has a non-obvious lifecycle:

1. **Pre-snapshot** — `FigureInstance { snapshotted: false }`. Canvas reads live `FigureNode`s from the template.
2. **First assignment** — triggers automatic snapshot in a transaction: copies all `FigureNode`s into `InstanceNode`s, sets `snapshotted = true`. Subsequent template changes do NOT affect the instance.
3. **Post-snapshot** — canvas reads `InstanceNode`s (immutable). Assignments always point to `InstanceNode`, never to `FigureNode`.

All nodes (PINYA, TRONC, BASE, directions) live in `figure_nodes` per template.

`FigureNode.id` is stable across saves (upsert by ID, not delete+recreate). `originNodeId` (optional) traces lineage when nodes are duplicated or derived from another template.

**Pinyes routes:**
```
/pinyes                                                    → TemplateListComponent
/pinyes/templates/:id/edit                                 → TemplateEditorComponent
/pinyes/compositions/:id/edit                              → CompositionEditorComponent
/pinyes/events/:eventId/segments/:segmentId/assign         → SegmentWorkspaceComponent
/pinyes/events/:eventId/segments/:segmentId/assign/:id     → SegmentWorkspaceComponent (:id preselects a figure)
/pinyes/events/:eventId/segments/:segmentId/project        → ProjectionViewComponent
/pinyes/events/:eventId/segments/:segmentId/project/:id    → ProjectionViewComponent (filtered to one figure)
```

There is no separate distribution route — `SegmentWorkspaceComponent`'s Distribució tab covers it.

**`SegmentWorkspaceComponent`** (`components/segment-workspace/`) is the unified per-segment workspace: 5 tabs (Pinyes, Troncs, Distribució, Nodes extra, Previsualitza) backed by `SegmentWorkspaceStateService` (provided per workspace instance), composing the root `AssignmentStateService` for selection/assignment state. `?tab=` and `?figure=` query params drive deep-linking; `UndoRedoService` is provided at the workspace level so undo history spans tabs. The Previsualitza tab embeds `ProjectionViewComponent` directly (`[embedded]="true"`) rather than duplicating projection rendering.

**`TroncViewComponent`** uses CSS Grid with doubled internal grid (`x*2`, `width*2`) to support 0.5u steps. Modes: `editor` | `assignment` | `projection`.

**`FigureCanvasComponent`** Konva modes: `editor` | `assignment` | `segment-assignment` | `readonly` | `composition`. `segment-assignment` renders multiple figures (slots) on one canvas with assignment interactions, used by the segment workspace tabs.

**`AssignmentStateService`** holds global canvas state via signals: `selectedNodeId`, `selectedPersonId`, `activeInstanceId`, `assignments`, `confirmedPersons`, `pendingOperations`.

**Figure placement** (`utils/figure-placement.util.ts`) — `placeFigures` is a deterministic space-optimizing layout: figures are packed into rows (segment order = reading order), choosing the row partition that maximizes the fit-to-screen zoom for a reference screen; tronc panels are then placed near their own figure by candidate scoring.

---

## Language conventions

- **Code** (variables, functions, classes, endpoints, DB columns, commits): **English**
- **UI text** (buttons, labels, messages, placeholders): **Catalan**
- **Domain terms:** `Person` (not Casteller), `Membre` (gender-neutral), `Xicalla` (children, not canalla)

---

## Testing conventions

- Backend: Jest, co-located `.spec.ts` files
- Frontend: Vitest, co-located `.spec.ts` files
- Coverage threshold (enforced in CI via `--configuration=ci`): API 75/70/78/76 (statements/branches/functions/lines), dashboard 40/35/40/40
- Test a single backend file: `nx test api --testFile=<path>`

## Development guidelines

Always read the TDD skill and apply it when writing code. Read and apply any other relevant skills before you start.

