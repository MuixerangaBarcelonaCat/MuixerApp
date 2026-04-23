---
name: P0-P1-P2 Implementation Plan
overview: "Detailed implementation plan for the first vertical slice of MuixerApp: Nx monorepo scaffold, Person/Position/User entities with CRUD API, Angular dashboard shell (Spartan UI + Tailwind CSS + CDK) with person list, and legacy data import via NestJS seed command."
todos:
  - id: t01-nx-monorepo
    content: "T01: Create Nx monorepo workspace at repo root"
    status: completed
  - id: t02-nestjs-api
    content: "T02: Generate NestJS API app (apps/api)"
    status: completed
  - id: t03-angular-dashboard
    content: "T03: Generate Angular dashboard app + Tailwind CSS 4 + Angular CDK + Spartan UI"
    status: completed
  - id: t04-angular-pwa
    content: "T04: Generate Angular PWA app (empty scaffold)"
    status: completed
  - id: t05-shared-lib
    content: "T05: Create shared lib (libs/shared) with path alias"
    status: completed
  - id: t06-typeorm-neondb
    content: "T06: Configure TypeORM + NeonDB connection"
    status: completed
  - id: t07-env-tooling
    content: "T07: Configure env, .gitignore, ESLint, Prettier, verify api serves"
    status: completed
  - id: t08-shared-enums
    content: "T08: Create shared enums (UserRole, Gender, AvailabilityStatus, OnboardingStatus, FigureZone)"
    status: completed
  - id: t09-position-crud
    content: "T09: Position entity + module + service + controller + DTOs"
    status: completed
  - id: t10-user-entity
    content: "T10: User entity + module + minimal service (no controller)"
    status: completed
  - id: t11-person-crud
    content: "T11: Person entity + module + service (filters, pagination) + controller + DTOs"
    status: completed
  - id: t12-response-interceptor
    content: "T12: Global API response transform interceptor"
    status: completed
  - id: t13-dashboard-shell
    content: "T13: Dashboard layout shell (Spartan sidebar/header, Tailwind theming, responsive)"
    status: completed
  - id: t14-dashboard-api
    content: "T14: Dashboard API service + person feature service"
    status: completed
  - id: t15-person-list
    content: "T15: Person list view (Spartan table + CDK sort, search, filters, responsive cards <lg)"
    status: completed
  - id: t16-person-detail
    content: "T16: Person detail view (read-only, responsive grid)"
    status: completed
  - id: t17-run-extractor
    content: "T17: Run Python extractor to get castellers.json"
    status: completed
  - id: t18-seed-module
    content: "T18: Create seed module with nest-commander"
    status: completed
  - id: t19-import-logic
    content: "T19: Implement import logic (field mapping, position upsert, idempotent)"
    status: completed
  - id: t20-e2e-verify
    content: "T20: End-to-end verification with real data"
    status: completed
  - id: rules-typeorm
    content: "Create cursor rule: typeorm-patterns.mdc"
    status: completed
  - id: rules-api-response
    content: "Create cursor rule: api-response-format.mdc"
    status: completed
  - id: rules-nx-workspace
    content: "Create cursor rule: nx-workspace.mdc"
    status: completed
  - id: rules-spartan-tailwind
    content: "Create cursor rule: spartan-tailwind.mdc"
    status: pending
  - id: docs-update
    content: Update NEXT_STEPS.md and spec doc to replace Angular Material references with Spartan UI + Tailwind
    status: pending
isProject: false
---

# P0+P1+P2 Implementation Plan: Persons Vertical Slice

## Current State

- **Repo has**: docs, specs, cursor rules, Python extractor script. **Zero application code.**
- **Spec approved**: [docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md](docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md)
- **Extractor exists but not run yet**: [scripts/appsistencia_extractor.py](scripts/appsistencia_extractor.py) (outputs to `data/extracted/`)
- **NeonDB**: remote Postgres, connection via `DATABASE_URL` env var

---

## Phase 0: Scaffold (P0)

### T01 — Create Nx monorepo

```bash
npx create-nx-workspace@latest muixer-app --preset=ts --pm=npm
```

Move contents to repo root (or init in-place). Configure `nx.json` and root `tsconfig.base.json`.

### T02 — Generate NestJS API app

```bash
npx nx g @nx/nest:app api --directory=apps/api
```

Produces `apps/api/` with NestJS bootstrap. Configure `apps/api/src/main.ts` with global prefix `/api`, `ValidationPipe`, and CORS.

### T03 — Generate Angular dashboard app + Tailwind + Spartan UI

```bash
npx nx g @nx/angular:app dashboard --directory=apps/dashboard --style=scss --standalone --routing
```

Uses standalone bootstrap, SCSS, routing. Then configure the UI stack:

**1. Tailwind CSS 4:**

```bash
npm install -D tailwindcss @tailwindcss/postcss postcss
```

Create `apps/dashboard/postcss.config.js` and import Tailwind in root stylesheet. Configure `tailwind.config.js` with colla-theming CSS custom properties:

```js
theme: {
  extend: {
    colors: {
      colla: {
        primary: 'var(--colla-primary)',
        secondary: 'var(--colla-secondary)',
        'text-on-primary': 'var(--colla-text-on-primary)',
      }
    }
  }
}
```

**2. Angular CDK:**

```bash
npm install @angular/cdk
```

**3. Spartan UI components** (only what this slice needs):

```bash
npx nx g @spartan-ng/cli:ui table button badge input separator sheet sonner pagination select dialog icon label menu
```

Spartan components are unstyled primitives on top of CDK — all visual styling via Tailwind. This gives full control for P6 canvas toolbars and future colla-theming.

**Rationale:** Angular Material has opinionated styling that's hard to override for custom theming and the P6 canvas module. Spartan UI + Tailwind + CDK gives headless primitives with full Tailwind control, better for multi-colla theming and the future canvas editor UI.

### T04 — Generate Angular PWA app (empty scaffold)

```bash
npx nx g @nx/angular:app pwa --directory=apps/pwa --style=scss --standalone --routing
```

No further work on PWA in this slice. Just exists for the monorepo structure.

### T05 — Create shared library

```bash
npx nx g @nx/js:lib shared --directory=libs/shared --unitTestRunner=jest
```

Structure:

- `libs/shared/src/enums/` — all shared enums
- `libs/shared/src/interfaces/` — DTO interfaces
- `libs/shared/src/index.ts` — barrel export

Configure `tsconfig.base.json` path alias: `@muixer/shared` -> `libs/shared/src/index.ts`

### T06 — Configure TypeORM + NeonDB

In `apps/api/`:

- Install: `typeorm`, `@nestjs/typeorm`, `pg`
- Create `apps/api/src/modules/database/database.module.ts` with `TypeOrmModule.forRootAsync()` reading `DATABASE_URL` from env
- SSL config: `{ rejectUnauthorized: false }` for NeonDB
- `synchronize: true` in dev only

Create `.env.example` at root:

```
DATABASE_URL=postgresql://user:pass@ep-xxx.region.neon.tech/muixer?sslmode=require
NODE_ENV=development
```

Add `.env` to `.gitignore`.

### T07 — Configure environment and tooling

- Root `.gitignore` (node_modules, dist, .env, data/extracted/)
- ESLint + Prettier config (Nx defaults + project overrides)
- `apps/api/src/app.module.ts` imports `DatabaseModule`
- Verify `nx serve api` starts and connects to NeonDB

---

## Phase 1: Entities + CRUD (P1)

### T08 — Shared enums

Create in `libs/shared/src/enums/`:

- `user-role.enum.ts` — ADMIN, TECHNICAL, MEMBER
- `gender.enum.ts` — MALE, FEMALE, OTHER
- `availability-status.enum.ts` — AVAILABLE, TEMPORARILY_UNAVAILABLE, LONG_TERM_UNAVAILABLE
- `onboarding-status.enum.ts` — COMPLETED, IN_PROGRESS, LOST, NOT_APPLICABLE
- `figure-zone.enum.ts` — PINYA, TRONC, FIGURE_DIRECTION, XICALLA_DIRECTION

Export all from `libs/shared/src/index.ts`.

### T09 — Position entity + module + CRUD

- `apps/api/src/modules/position/position.entity.ts` — as per spec (uuid PK, name, slug, shortDescription, longDescription, color, zone)
- `apps/api/src/modules/position/position.module.ts`
- `apps/api/src/modules/position/position.service.ts` — findAll, create, update
- `apps/api/src/modules/position/position.controller.ts` — GET /api/positions, POST, PATCH /:id
- DTOs: `create-position.dto.ts`, `update-position.dto.ts`
- **No pagination** (small dataset, ~12-15 records)

### T10 — User entity + module (minimal)

- `apps/api/src/modules/user/user.entity.ts` — as per spec (uuid PK, passwordHash, role, isActive, invite/reset tokens, managedPersons relation)
- `apps/api/src/modules/user/user.module.ts` — exports `UserService`
- `apps/api/src/modules/user/user.service.ts` — create, findByPerson (just enough for seed)
- **No controller yet** (no auth endpoints in this slice)

### T11 — Person entity + module + CRUD

This is the core of the slice. Includes:

**Entity** (`person.entity.ts`):

- All fields from spec section 3
- Relations: `@ManyToMany(() => Position)`, `@ManyToOne(() => User)`, self-referencing `@ManyToOne(() => Person)` for mentor

**Service** (`person.service.ts`):

- `findAll(filters: PersonFilterDto)` — paginated, with search (alias/name/surname ILIKE), position filter via join, availability/active/xicalla/member filters
- `findOne(id)` — with positions eager-loaded
- `create(dto)` — with position IDs resolution
- `update(id, dto)` — partial update
- `softDelete(id)` — sets isActive = false

**Controller** (`person.controller.ts`):

- Standard REST endpoints per spec section 4
- Returns `{ data, meta: { total, page, limit } }` envelope

**DTOs**:

- `create-person.dto.ts` — class-validator: alias required (max 20), email optional (IsEmail), shoulderHeight optional (50-250), positionIds optional (UUID array)
- `update-person.dto.ts` — PartialType of create
- `person-filter.dto.ts` — search, positionId, availability, isActive, isXicalla, isMember, page, limit

### T12 — API response interceptor

Global transform interceptor that wraps responses in `{ data, meta? }` format. Applied in `main.ts`.

### T13 — Dashboard layout shell (Spartan + Tailwind, responsive)

In `apps/dashboard/src/app/`:

**Theming** (`styles.scss`):

```css
:root {
  --colla-primary: #1B5E20;
  --colla-secondary: #FDD835;
  --colla-text-on-primary: #FFFFFF;
  --colla-logo-url: url('/assets/logo-mxb.svg');
}
```

Tailwind consumes these via `theme.extend.colors.colla` (configured in T03). All components use `bg-colla-primary`, `text-colla-secondary`, etc. No Angular Material theming layer.

**Layout components** (standalone, OnPush):

- `shared/components/layout/sidebar/sidebar.component.ts`:
  - Desktop (>=lg): fixed sidebar, always visible, Tailwind `hidden lg:flex lg:w-64 lg:flex-col`
  - Mobile (<lg): Spartan Sheet (slide-in drawer) triggered by hamburger menu
  - Nav links: "Persones" active with `bg-colla-primary/10` highlight, others greyed with `opacity-50 pointer-events-none`
  - Touch targets: min 44x44px on all nav items (`min-h-[44px] min-w-[44px]`)
- `shared/components/layout/header/header.component.ts`:
  - Desktop: logo + "MuixerApp" title + future avatar/menu area
  - Mobile: hamburger button (Spartan button) + logo + compact title
  - Hamburger toggles the Spartan Sheet sidebar
  - Responsive: `flex items-center justify-between h-16 px-4`
- `app.component.ts` — shell with sidebar + router-outlet:

```html
  <div class="flex h-screen bg-gray-50">
    <app-sidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <app-header />
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <router-outlet />
      </main>
    </div>
  </div>
  

```

**Routing** (`app.routes.ts`):

```typescript
{ path: '', redirectTo: 'persons', pathMatch: 'full' },
{ path: 'persons', loadChildren: () => import('./features/persons/persons.routes') },
```

**Responsive global requirements** (applied across all dashboard components):

- Mobile-first approach: base styles for mobile, `lg:` prefix for desktop
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px) — Tailwind defaults
- Touch targets: min 44x44px for all interactive elements on mobile
- Sidebar: hidden <lg, visible >=lg
- Tables: card layout <lg, full table >=lg
- Forms: single column <md, multi-column >=md

### T14 — Dashboard API service

- `core/services/api.service.ts` — base HttpClient wrapper, configurable base URL (`http://localhost:3000/api` in dev)
- `features/persons/services/person.service.ts` — getAll(filters), getOne(id), typed with shared interfaces

### T15 — Person list view (Spartan table + CDK, responsive)

`features/persons/components/person-list/person-list.component.ts`

**Desktop (>=lg) — Spartan Table:**

- Spartan UI table component (built on CDK Table) with Tailwind styling
- CDK sort directives (`matSort` -> `cdkSort`) for column sorting
- Spartan Pagination component at bottom
- Columns: Alias, Nom complet, Posicions (badges), Disponibilitat, Actiu

**Mobile/Tablet (<lg) — Card layout:**

- Same data rendered as stacked cards instead of table rows
- Each card shows: alias (bold), name, position badges, availability indicator
- Use `@if` / responsive signal to switch between table and card views (or CSS `hidden lg:block` / `lg:hidden`)
- Cards: `rounded-lg border bg-white p-4 shadow-sm` with min touch target 44px

**Search + Filters:**

- Spartan Input for search (signal-based, debounce 300ms) by alias/name/surname
- Filter bar: Spartan Select for position dropdown, Spartan Button toggles for availability/active/xicalla/member
- Filters wrap responsively: `flex flex-wrap gap-2`
- Active filters shown as Spartan Badge chips with dismiss button

**Position badges:**

- Spartan Badge with dynamic background color from `Position.color`
- Use inline `[style.backgroundColor]` binding or Tailwind arbitrary values `bg-[var(--pos-color)]`
- Text color auto-calculated (white/black) based on badge luminance

**All UI labels in Catalan** ("Persones", "Cerca per nom o alies...", "Posicio", "Disponibilitat", etc.)

### T16 — Person detail view (responsive grid)

`features/persons/components/person-detail/person-detail.component.ts`

**Layout:**

- Desktop (>=lg): 2-column grid `grid grid-cols-1 lg:grid-cols-2 gap-6`
- Mobile (<lg): single column stack

**Content sections** (Tailwind card containers):

- Personal info: nom, cognoms, alias, email, telefon, data naixement
- Colla info: posicions (badges), disponibilitat, isActive, isMember, isXicalla, onboardingStatus
- Physical: shoulderHeight
- Notes: observacions, mentor, shirtDate, joinDate
- Metadata: createdAt, updatedAt, legacyId (col·lapsable/subtle)

**Components used:**

- Spartan Separator between sections
- Spartan Badge for positions and status indicators
- Spartan Button for back navigation
- Spartan Label for field names

**Back navigation:** Spartan Button with arrow icon, navigates to person list

---

## Phase 2: Data Import (P2)

### T17 — Run Python extractor

```bash
cd scripts && python appsistencia_extractor.py
```

Verify `data/extracted/castellers.json` exists with 258 records. Add `data/extracted/` to `.gitignore`.

### T18 — Seed module with nest-commander

Install `nest-commander` in `apps/api`.

- `apps/api/src/modules/database/seeds/seed.module.ts`
- `apps/api/src/modules/database/seeds/seed.command.ts`

Register as Nx target:

```json
"seed": { "executor": "nx:run-commands", "options": { "command": "node dist/apps/api/main.js seed" } }
```

Or use a separate entry point for the CLI command.

### T19 — Implement import logic

In `seed.command.ts`:

1. Read `data/extracted/castellers.json`
2. Extract unique positions, split combined (e.g. "PRIMERES + VENTS" -> ["PRIMERES", "VENTS"])
3. Upsert Position records using the mapping table from spec section 5
4. For each person:
  - Map legacy fields -> Person entity (following field mapping table)
  - Derive `isXicalla` from position containing CANALLA or NENS COLLA
  - Associate positions M:N
  - If has email: create inactive User with random inviteToken
  - Map `tecnica` -> User.role
5. Use `legacyId` for upsert (idempotent)
6. Print summary report

### T20 — End-to-end verification

1. `nx serve api` -- verify API starts, connects to NeonDB
2. `nx run api:seed` -- import 258 persons
3. `GET /api/persons` -- verify paginated response with data
4. `GET /api/positions` -- verify ~12 positions with zones/colors
5. `nx serve dashboard` -- verify person list renders with real data
6. Test search and filters in dashboard

---

## New Cursor Rules to Create

### Rule 1: `typeorm-patterns.mdc`

Glob: `apps/api/**/*.entity.ts`

Conventions:

- UUID primary keys (`@PrimaryGeneratedColumn('uuid')`)
- Always include `@CreateDateColumn()` and `@UpdateDateColumn()`
- Soft delete via `isActive: boolean` (not `@DeleteDateColumn`)
- Enums imported from `@muixer/shared`
- Table names: plural, snake_case (`persons`, `positions`, `person_positions`)
- Column naming: camelCase in TypeScript, auto-mapped to snake_case by TypeORM naming strategy

### Rule 2: `api-response-format.mdc`

Glob: `apps/api/**/*.controller.ts`

Conventions:

- All responses wrapped in `{ data: T, meta?: { total, page, limit } }`
- Pagination defaults: page=1, limit=50, max=100
- Errors: standard NestJS format `{ statusCode, message, error }`
- Soft delete: `DELETE` sets `isActive = false`, returns 204
- Use `ParseUUIDPipe` for `:id` params

### Rule 3: `nx-workspace.mdc`

Always apply.

Conventions:

- Import shared code via `@muixer/shared` alias
- Never import directly from another app (`apps/api` must not import from `apps/dashboard`)
- Nx targets: `serve`, `build`, `test`, `lint`, `seed` (api only)
- New modules: generate with Nx generators, then customize

### Rule 4: `spartan-tailwind.mdc`

Glob: `apps/dashboard/**/*.ts, apps/dashboard/**/*.html, apps/pwa/**/*.ts, apps/pwa/**/*.html`

Conventions:

- UI library: Spartan UI components (headless, CDK-based) + Tailwind CSS for all styling
- NO Angular Material. Never import `@angular/material/*`
- All visual styling via Tailwind utility classes — no component-level SCSS except for complex animations
- Colla theming: use `bg-colla-primary`, `text-colla-secondary` etc. (mapped to CSS custom properties)
- Responsive: mobile-first. Base = mobile, `lg:` = desktop. Breakpoints: sm/md/lg/xl (Tailwind defaults)
- Tables: Spartan Table (CDK-based) on >=lg, card layout on <lg
- Forms: Spartan Input/Select/Label. Single column <md, multi-column >=md
- Modals/drawers: Spartan Dialog and Spartan Sheet
- Touch targets: min 44x44px on mobile (`min-h-[44px] min-w-[44px]`)
- Notifications: Spartan Sonner (toast)
- Icons: Spartan Icon (wraps lucide-angular or similar)

Example:

```typescript
// GOOD — Spartan + Tailwind
import { HlmButtonDirective } from '@spartan-ng/ui-button-helm';
// template: <button hlmBtn variant="outline" class="min-h-[44px]">Cerca</button>

// BAD — Angular Material
import { MatButtonModule } from '@angular/material/button';
```

---

## Documentation Updates

### Docs to update before coding

**[NEXT_STEPS.md](NEXT_STEPS.md)** line 24:

- Change: `Angular Material, tema amb CSS variables` -> `Spartan UI + Tailwind CSS + Angular CDK, tema amb CSS custom properties`

**[docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md](docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md)** line 535:

- Change: `Angular Material mat-table with mat-paginator and mat-sort` -> `Spartan UI table (CDK-based) with Spartan pagination and CDK sort directives`

**[TEAM_KICKOFF.md](TEAM_KICKOFF.md)**: No changes — references are historical (option evaluation context).

**[PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)**: No changes — no Material references.

---

## Dependency Graph

```mermaid
flowchart TD
    T01[T01: Nx monorepo] --> T02[T02: NestJS api]
    T01 --> T03[T03: Angular dashboard]
    T01 --> T04[T04: Angular PWA scaffold]
    T01 --> T05[T05: Shared lib]
    T02 --> T06[T06: TypeORM + NeonDB]
    T06 --> T07[T07: Env + tooling]
    T05 --> T08[T08: Shared enums]
    T08 --> T09[T09: Position entity + CRUD]
    T08 --> T10[T10: User entity minimal]
    T09 --> T11[T11: Person entity + CRUD]
    T10 --> T11
    T11 --> T12[T12: API response interceptor]
    T03 --> T13[T13: Dashboard layout shell]
    T13 --> T14[T14: API service]
    T14 --> T15[T15: Person list view]
    T15 --> T16[T16: Person detail view]
    T11 --> T18[T18: Seed module]
    T17[T17: Run extractor] --> T19[T19: Import logic]
    T18 --> T19
    T12 --> T20[T20: E2E verification]
    T16 --> T20
    T19 --> T20
```



## Execution Strategy

**Parallel tracks** after T01:

- **Track A (Backend)**: T02 -> T06 -> T07 -> T09 -> T10 -> T11 -> T12
- **Track B (Shared)**: T05 -> T08 (feeds into Track A)
- **Track C (Frontend)**: T03 -> T13 -> T14 -> T15 -> T16
- **Track D (Data)**: T04 (trivial), T17 (run extractor), T18 -> T19

In practice, working solo: T01 -> T02+T03+T04+T05 (scaffold batch) -> T06+T07 -> T08 -> T09 -> T10 -> T11 -> T12 -> T13+T14 -> T15 -> T16 -> T17 -> T18 -> T19 -> T20

**Estimated tasks**: 20 implementation tasks. Each task produces a verifiable artifact.

---

## Testing Strategy (per task)

- **Entities**: Unit tests for entity creation, validation
- **Services**: Unit tests with mocked repositories (Jest)
- **Controllers**: Integration tests with supertest
- **Seed command**: Integration test with test DB or mocked repo
- **Dashboard components**: Component tests with TestBed, mock HTTP. Spartan components import their `*Helm` directives in test imports
- **Responsive**: Manual verification at mobile (375px), tablet (768px), desktop (1280px) viewports
- **E2E**: Manual verification against NeonDB with real data

