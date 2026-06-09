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
nx run api:migrate-tronc-to-family   # P5.7 migration
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
- `figure` — `FigureTemplate`, `FigureFamily`, `FigureNode` (PINYA zone), `FigureFamilyNode` (TRONC/BASE zone)
- `composition` — `CompositionTemplate` + `CompositionSlot`
- `event-segment` — `EventSegment`, `FigureInstance`, `InstanceNode`, `ProjectionService`
- `node-assignment` — assignment logic, lazy snapshot, bulk import, lock, history
- `reference-element` — `ReferenceElement` entity for projection (internal service, REST controller removed in P5.12)
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
2. **First assignment** — triggers automatic snapshot in a transaction: copies all `FigureNode`s + `FigureFamilyNode`s into `InstanceNode`s, sets `snapshotted = true`. Subsequent template changes do NOT affect the instance.
3. **Post-snapshot** — canvas reads `InstanceNode`s (immutable). Assignments always point to `InstanceNode`, never to `FigureNode`.
4. ~~**Upgrade**~~ — removed. The `sourceVariantOrder` and `originNodeId` columns remain for historical data but no endpoint uses them.

Node split by zone (transparent to frontend):
- `PINYA` nodes live in `figure_nodes` (per template)
- `TRONC`/`BASE` nodes live in `figure_family_nodes` (shared across all variants in a family)
- `GET /figure-templates/:id` merges both; `PUT` splits them back automatically

`FigureNode.id` is stable across saves (upsert by ID, not delete+recreate). `originNodeId` always points to the root ancestor within the family, not the immediate previous variant.

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

## P5.12 — Pinyes Refactor & Code Review (completed)

Full audit of the pinyes module across 4 phases + 10 code review findings. Key outcomes:
- **Phase 1**: Fixed 2 critical bugs (snapshot race condition, composition slot sync) + 14 HIGH bugs
- **Phase 2**: Shared types — 9 interface groups moved to `@muixer/shared`
- **Phase 3**: Dead code cleanup — removed `SegmentCanvasComponent`, reference-element REST controller, `upgradeInstance`, 6+ dead methods
- **Phase 4**: Frontend quality — `takeUntilDestroyed` on 48 subscriptions, `figure-canvas` decomposed into `KonvaStageService` + 4 renderers, `FloatingPanelDragDirective`, `CdkTrapFocus` on 11 modals
- **Code Review (F1-F10)**: Person uniqueness per instance, `checkEventLock` throws on missing data, `bulkImport` catch discriminates error types, history queries optimized (count vs join), dead vars removed, `as any` casts replaced with proper types
- Tracking: `docs/PINYES_REFACTOR_TRACKING.md` | Review: `docs/PINYES_REFACTOR_REVIEW.md`
