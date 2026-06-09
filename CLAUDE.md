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
pnpm run ci:local          # lint + test + build (all, excludes e2e)

# Lint
nx lint api
nx lint dashboard

# Build
nx build api
nx build dashboard

# Database scripts (run from repo root)
nx run api:seed-seasons              # Import seasons seed data
nx run api:reset-figure-data         # Dev reset: wipe instances/nodes/assignments + re-seed
nx run api:migrate-tronc-units       # P5.6 migration

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
apps/api/          → NestJS REST API (port 3000)
apps/dashboard/    → Angular 21 SPA admin (port 4200)
apps/pwa/          → Angular PWA scaffold (P6, not yet implemented)
libs/shared/       → Shared enums only — import via @muixer/shared
docs/              → Specs, architecture docs, roadmap
.cursor/rules/     → Agent coding rules (important patterns)
```

### Backend (`apps/api/src`)

Global guards registered in `app.module.ts`: `JwtAuthGuard` (all routes by default) + `RolesGuard`. Mark public endpoints with `@Public()`.

Modules under `src/modules/`:
- `auth` — JWT (15min) + httpOnly refresh token (7d), Passport, token rotation
- `person` — CRUD + soft delete via `isActive` boolean
- `event` + `season` + attendance
- `figure` — `FigureTemplate`, `FigureNode`, `Rengla`
- `composition` — `CompositionTemplate` + `CompositionSlot`
- `event-segment` — `EventSegment`, `FigureInstance`, `InstanceNode`, `ProjectionService`
- `node-assignment` — assignment logic, lazy snapshot
- `reference-element` — `ReferenceElement` for projection canvas (P5.8.1)
- `sync` — SSE strategy pattern for legacy data import

**TypeORM conventions:** UUID primary keys, `createdAt`/`updatedAt` always present, soft delete = `isActive: boolean` (not `@DeleteDateColumn`), enums imported from `@muixer/shared`, table names plural snake_case.

**API response envelope:** list endpoints return `{ data: T[], meta: { total, page, limit } }`. Single resource returns the object directly. Soft deletes return 204.

**Filter/sort DTOs:** always use `@IsIn(SORT_FIELDS)` whitelist — never trust raw `sortBy` in `ORDER BY`. Numeric query params need `@Type(() => Number)`.

### Frontend (`apps/dashboard/src/app`)

All components are standalone + `OnPush` + Signals. No NgRx. No `@Input()`/`@Output()` — use `input()` / `output()`.

Routes (all behind `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`):
- `/persons` → `PersonListComponent`
- `/rehearsals`, `/performances` → events feature
- `/pinyes` → Pinyes module (see below)
- `/sync` → legacy sync SSE UI

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
/pinyes                                                   → TemplateListComponent
/pinyes/templates/:id/edit                                → TemplateEditorComponent
/pinyes/compositions/:id/edit                             → CompositionEditorComponent
/pinyes/events/:eventId/segments/:segmentId/assign        → AssignmentCanvasComponent
/pinyes/events/:eventId/segments/:segmentId/project       → ProjectionViewComponent (P5.8.1)
/pinyes/events/:eventId/segments/:segmentId/project/:id   → FigureProjectionComponent
```

**`TroncViewComponent`** uses CSS Grid with doubled internal grid (`x*2`, `width*2`) to support 0.5u steps. Modes: `editor` | `assignment` | `projection`.

**`FigureCanvasComponent`** Konva modes: `editor` | `assignment` | `readonly` | `composition`.

**`AssignmentStateService`** holds global canvas state via signals: `selectedNodeId`, `selectedPersonId`, `activeInstanceId`, `assignments`, `confirmedPersons`, `pendingOperations`.

---

## Language conventions

- **Code** (variables, functions, classes, endpoints, DB columns, commits): **English**
- **UI text** (buttons, labels, messages, placeholders): **Catalan**
- **Domain terms:** `Person` (not Casteller), `Membre` (gender-neutral), `Xicalla` (children, not canalla)

---

## Testing conventions

- Backend: Jest, co-located `.spec.ts` files
- Frontend: Vitest, co-located `.spec.ts` files
- Coverage threshold: 70% (enforced in CI via `--configuration=ci`)
- Test a single backend file: `nx test api --testFile=<path>`

---

## P5.8.1 — Projection view (in progress)

Current branch `story/deploy-server-pre` contains work on the fullscreen projection feature. Key additions:
- `FigureInstance` has `projectionX`, `projectionY`, `projectionScale` fields
- `ReferenceElement` entity (RECTANGLE | ARROW) scoped to an event, with `hiddenInSegments` JSONB
- Endpoint `PUT /segments/:id/instances/projection-layout` for batch position updates
- Endpoint `GET /segments/:id/projection` for optimized projection data
- New components: `ProjectionViewComponent`, `SegmentCanvasComponent`, `FigureProjectionComponent`
