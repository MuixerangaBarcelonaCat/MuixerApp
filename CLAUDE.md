# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is the **single source of truth for agents**: `README.md` is for humans (setup + product overview) and the topic docs live in `docs/` (navigable index: [docs/MAP.md](docs/MAP.md)).

For exact endpoints always read **Swagger** at `/api/docs` — never a hand-maintained list.

## Commands

```bash
# Setup
pnpm install
cp .env.example .env
pnpm run docker:up         # Start PostgreSQL in Docker (required for dev)

# Dev servers
nx serve api               # http://localhost:3000/api  |  Swagger: /api/docs
nx serve dashboard          # http://localhost:4200  (proxied to API via proxy.conf.json)
nx serve pwa                # Members PWA

# Tests
nx test api                # Jest — backend unit tests
nx test dashboard          # Vitest — dashboard unit tests
nx test pwa                # Vitest — PWA unit tests
nx test api --testFile=apps/api/src/modules/person/person.service.spec.ts   # single file
nx run api:test-integration  # Jest — integration tests against real Postgres (testcontainers)
pnpm run ci:local          # lint + test + build (all, excludes e2e)

# Lint / build / dead code
nx lint api | nx lint dashboard | nx lint pwa
nx build api | nx build dashboard | nx build pwa
pnpm run lint:dead         # knip: files, exports and deps with no consumers

# Database — migrations (synchronize: false; auto-run in dev via migrationsRun)
nx run api:migration-run | api:migration-generate | api:migration-revert
nx run api:reset-figure-data         # Dev reset: wipe instances/nodes/assignments

# Docker
pnpm run docker:down | docker:clean | docker:psql
pnpm run docker:pre:up | docker:prod:up   # Pre-production / production stacks
```

## Domain

**MuixerApp** manages *colles muixerangueres*: people, attendance to rehearsals/performances, and the design and staffing of **figures** (human constructions).

**Roles:** `ADMIN` (≡ TECHNICAL until multi-tenant exists) · `TECHNICAL` (full Dashboard + PWA access) · `MEMBER` (PWA: self-service attendance + read-only views).

**Flow:** Persons → Seasons → Events → Attendance. Per event: Segments → Figures (instances) → Assignment of persons to nodes → Fullscreen projection.

## Architecture

### Monorepo layout

```
apps/api/          → NestJS 11 REST API (port 3000, prefix /api)
apps/dashboard/    → Angular 21 SPA admin (port 4200)
apps/pwa/          → Angular 21 PWA for members
apps/*-e2e/        → Playwright (e2e + responsive audit suite)
libs/shared/       → Shared enums, constants, interfaces — import via @muixer/shared
libs/pinyes-render/→ Shared figure rendering (Konva canvas, tronc panels, projection) — import via
                     @muixer/pinyes-render; consumed by both apps/dashboard and apps/pwa
docs/              → Topic documentation (see docs/MAP.md)
.cursor/rules/     → Agent coding rules (important patterns)
.agents/skills/    → Stack-specific agent skills
```

**Stack:** NestJS 11 · TypeORM 0.3 · PostgreSQL 15+ · Passport/JWT · Swagger · Angular 21 (standalone, OnPush, Signals) · DaisyUI v4 + Tailwind v3.4 · Konva 10 (imperative) · Lucide · Angular CDK · Nx 22 · pnpm · Node 22 · Docker Compose (dev/pre/prod) · GitHub Actions.

### Backend (`apps/api/src`)

Global guards registered in `app.module.ts`: `JwtAuthGuard` (all routes by default) + `RolesGuard` + `ThrottlerGuard`. Mark public endpoints with `@Public()`, role-restricted ones with `@Roles()`.

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
| `tag` | CRUD of person labels; entity maps to the legacy-named `positions` table (M:N with Person via `person_positions`); `category` **is the group** (PINYA/TRONC/XICALLA/ALTRES); person assignment via `POST/DELETE /tags/:id/persons`. `positionTypes` points at figure-node `positionType`s with no FK, no validation and no server-side filtering — see [docs/TAGS.md](docs/TAGS.md) |
| `me` | member-scoped API consumed by the PWA (own events/attendance, published segments + projection) |
| `legal` | legal documents (terms/privacy) + versioning, consent read/accept |
| `audit` | `AuditLog` entity + service; records sensitive mutations |
| `mail` | `MailService` + provider abstraction; used by `auth` for password reset (invites still don't email — see Authentication) |
| `sync` | SSE strategy pattern for legacy data import; imports no tags at all — only `Person.isXicalla` is still derived from the legacy `posicio` field |
| `push-notification` | Web Push (VAPID) notifications: `PushSubscription` entity, provider abstraction (`console` dev / `web-push` prod via `PUSH_PROVIDER` env), `PushSubscriptionService` (register/unsubscribe/status, max 10/user), `PushNotificationService` (send with target resolution: ALL/EVENT_ATTENDANCE/PERSON, async via `push.requested` event), `PushNotificationCronService` (scheduled news push, stale sub cleanup). Controllers: `me/push-subscriptions` (MEMBER+) + `notifications` (TECHNICAL/ADMIN) + `push-subscriptions/summary`. Requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars. |

**TypeORM conventions:** UUID primary keys · `createdAt`/`updatedAt` always present · soft delete = `isActive: boolean` (not `@DeleteDateColumn`) · enums imported from `@muixer/shared` · table names plural snake_case.

**API response envelope:** list endpoints return `{ data: T[], meta: { total, page, limit } }`. Single resource returns the object directly. Soft deletes return 204.

**Filter/sort DTOs:** always use `@IsIn(SORT_FIELDS)` whitelist — never trust raw `sortBy` in `ORDER BY`. Numeric query params need `@Type(() => Number)`.

**Migrations:** `apps/api/src/migrations/`, `synchronize: false`, auto-run in dev. No seed script — data enters via the `sync` module.

### Frontend dashboard (`apps/dashboard/src/app`)

All components are standalone + `OnPush` + Signals. No NgRx. No `@Input()`/`@Output()` — use `input()` / `output()`.

Routes (all behind `authGuard` + `rolesGuard(TECHNICAL, ADMIN)`):

- `/home` · `/persons` · `/rehearsals`, `/performances` (events feature: list + sync)
- `/events/:id` → `EventDetailComponent`, `/events/:id/confirmation` → `AttendanceConfirmationComponent`
- `/pinyes` → Pinyes module (see below) · `/sync` → legacy sync SSE UI
- `/config` → `ConfigComponent`, with `/config/users`, `/config/tags`, `/config/seasons`, `/config/legal` (ADMIN only)
- `/design-system` → live token/component reference (ADMIN only, see below)

**Shared components** (`shared/components/`): `data/` (page-header, data-table, filter-bar, active-filters, column-toggle, pagination, stat-card) · `forms/` (emoji-picker, person-search-input) · `layout/` (header, tab-nav, user-chip). Compose list pages with these — never build raw table/pagination HTML. Buttons/badges/cards/inputs/modals/toasts/empty-states come from `@muixer/ui` (`lib-button`/`lib-badge`/`lib-card`/`lib-input`/`lib-modal`/`lib-toast-container`/`lib-empty-state`) — see **Design system** below before adding a new one of these by hand.

`app-data-table` has a **responsive card mode** below `lg` (`matchMedia`); flag the title column with `primary: true` in its `ColumnDef`.

**Styling:** DaisyUI v4 + Tailwind CSS v3. No `@angular/material`, no `.scss` unless animations are needed, no `@apply`. Dynamic Tailwind classes must use static maps (not template literals). Theme generated via `generateCollaTheme(shirtHex, sashSpec)` in `libs/ui/src/lib/tokens/theme.ts`.

**Design system:** tokens (color/typography/radius/shadow/motion/z-index) and the shared `libs/ui` component library are documented in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), with a live, real-content reference at `/design-system` (ADMIN only). Reach for `libs/ui` to create any button/badge/card/input/modal/toast/empty-state, use the library components and not the DaisyUI classes. **Any new or touched UI must apply the design system**: use design tokens (never a raw hex code or an arbitrary Tailwind value) and use a `@muixer/ui` component whenever one fits, rather than hand-rolling raw DaisyUI/Tailwind markup — this applies everywhere in the codebase.

**Canvas:** Konva 10.x used imperatively — not `ng2-konva` (incompatible with Angular 20+).

### Members PWA (`apps/pwa`)

Angular 21 + Service Worker (offline cache; **no push yet**), signals + `rxResource`.

**Routes:** `login` (alreadyAuthGuard) · `AppShell` behind `authGuard` + `rolesGuard(MEMBER, TECHNICAL, ADMIN)`: `home`, `events`, `events/:id`, `events/:eventId/segments/:segmentId` (segment projection, lazy), `profile` (placeholder).

**Features:** login, home (next rehearsal/performance), event agenda, event detail (with a **Segments** list for published segments — titles auto-derived the same way as the Dashboard, via `computeSegmentDisplayName` in `@muixer/shared`, plus a muted "on sou" one-line summary per segment via `formatOwnPositionSummary`, e.g. «Vent (C1) a Roscana»), **segment projection** (`SegmentProjectionComponent`: fetches via `/me/events/:eventId/segments/:segmentId/projection`, renders `<lib-pinya-projection>` full-bleed with a back/prev/next HUD, passing `highlightPersonId` (the caller's own `Person.id`) so `PinyaProjectionComponent` can show the "you are here" ring/chevron overlay (`OwnPositionMarkerComponent`) and sentence banner (`OwnPositionBannerComponent`, both in `@muixer/pinyes-render`) and fly the camera to the caller's placement on arrival or on tap — inert (`null`) for the Dashboard's own use of the same component; `LayoutService.isFullscreen` hides the bottom tab bar and shell chrome while it's open), and **attendance confirmation** (`AttendanceButton`: Vinc/No vinc → ANIRE/NO_VAIG; ASSISTIT locked). `no-person-banner` for accounts with no linked Person. TECHNICAL/ADMIN accounts also see a **Passa llista** link after their own attendance buttons on the event detail screen, shown only on the day of the event (mark any attendee's attendance via the same staff `/events/:id/attendance*` endpoints the Dashboard uses).

**Design system:** shares the same token/component library (`@muixer/ui`) as the dashboard — see [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md); the dashboard's `/design-system` route is the canonical live reference for both apps. New or touched PWA UI should apply design-system tokens and reach for a `@muixer/ui` component whenever one fits, the same rule as the dashboard — don't hand-roll a raw button/card/modal when a shared primitive already covers it.

Member-scoped data comes from the `me` API module (`@Roles(MEMBER, TECHNICAL, ADMIN)`): `GET /me/events` (filters `type`/`timeFilter`/`limit`, returns `MeEvent` with caller's own `myAttendance`), `GET /me/events/:id` (`MeEventDetail`), `PUT /me/events/:id/attendance` (upsert own attendance, person derived from JWT — no `personId` in the body), `GET /me/events/:eventId/segments` (published segments only, `MeSegment[]` incl. `instances` for title derivation and `myPlacements` — the caller's own `nodeLabel`/`cordon`/`figureName`/`figureMode` per placement; person derived from the JWT by default, optional `personId` query param for TECHNICAL/ADMIN (unrestricted) or MEMBER (restricted to managed persons)), `GET /me/events/:eventId/segments/:segmentId/projection` (`ProjectionData`, 404s for an unpublished segment). Auth still uses `/auth/me`. Types live in `libs/shared/interfaces/me/`. The `me` module reuses `SeasonService`/`AttendanceService`/`EventSegmentService`/`ProjectionService` (the latter's `onlyPublished` option scopes both the segment lookup and prev/next navigation); never exposes the admin `/events` CRUD to members.

## Pinyes module — key domain concepts

Full detail (endpoints, frontend architecture, error handling, guide for new work): [docs/PINYES_MODULE.md](docs/PINYES_MODULE.md).

| Concept | Description |
|---------|-------------|
| FigureTemplate / FigureNode | Reusable blueprint + nodes (PINYA, TRONC, BASE, directions, DECORATION) |
| Rengla | Radial sequence of pinya nodes per cordó |
| Composition / CompositionEntry | Reusable multi-figure composition |
| FigureInstance | A template/composition placed in a segment; lightweight until 1st assignment |
| InstanceNode | Immutable copy of a FigureNode (lazy snapshot); may be `isAdHoc` |
| NodeAssignment | Person → InstanceNode, **never** to FigureNode |
| EventSegment | Time block of an event |

**Instance lifecycle:** pre-snapshot (`snapshotted: false`, canvas reads live `FigureNode`s) → first assignment snapshots all `FigureNode`s into `InstanceNode`s in a transaction (`snapshotted = true`; later template edits no longer affect the instance) → post-snapshot, canvas + assignments read `InstanceNode`s only. Cordon selector / ad-hoc nodes mutate the instance (reversible via reset). Deletion cascades instance → InstanceNodes + NodeAssignments.

**Invariants:**
1. `NodeAssignment` always points to an `InstanceNode`, never a `FigureNode`.
2. Once `snapshotted`, `InstanceNode`s are unaffected by template changes.
3. `FigureInstance` has either `figureTemplate` **or** `composition` (XOR).
4. `NodeAssignment` uniqueness is per node only (`[figureInstance, instanceNode]`) — a person may legally hold ≥2 assignments in the same segment/instance since Fase 5; duplicates surface as soft conflicts (`TRONC_TRONC` / `TRONC_PINYA` / `PINYA_PINYA`, `classifyPlacementKind` in `@muixer/shared`), never rejected.
5. TRONC/BASE: `x`/`width` in relative units; PINYA: pixels.

**Key components:** `SegmentWorkspaceComponent` — unified per-segment workspace: 5 tabs (Pinyes, Troncs, Distribució, Nodes extra, Previsualitza) backed by `SegmentWorkspaceStateService` (per-instance), composing the root `AssignmentStateService`. Previsualitza embeds `ProjectionViewComponent` (`[embedded]="true"`) — no separate distribution route. `FigureCanvasComponent` Konva modes: `editor` | `assignment` | `segment-assignment` | `readonly` | `composition`. `placeFigures` (`utils/figure-placement.util.ts`) is a deterministic space-optimizing layout packing figures into rows.

**Routes:**
```
/pinyes                                                     → TemplateListComponent
/pinyes/templates/new|:id/edit                              → TemplateEditorComponent (canDeactivate)
/pinyes/compositions/new|:id/edit                           → CompositionEditorComponent
/pinyes/events/:eventId/segments/:segmentId/assign[/:id]    → SegmentWorkspaceComponent (:id preselects)
/pinyes/events/:eventId/segments/:segmentId/project[/:id]   → ProjectionViewComponent (:id filters)
```

## Data model

Source of truth: `apps/api/src/modules/database/entities.ts`. Full entity/field table + relations: [docs/DATA_MODEL.md](docs/DATA_MODEL.md) (regenerate with `pnpm run docs:model`).

Core entities: User, Person, PersonDelegate, Tag, Season, Event, Attendance, RefreshToken, FigureTemplate, FigureNode, Rengla, Composition, CompositionEntry, EventSegment, FigureInstance, InstanceNode, NodeAssignment, LegalDocument, AuditLog.

**Enums (`@muixer/shared`):** `UserRole` · `AttendanceStatus` (PENDENT/ANIRE/NO_VAIG/ASSISTIT) · `AvailabilityStatus` · `OnboardingStatus` · `EventType` (ASSAIG/ACTUACIO) · `FigureMode` (COMPLETA/PEU/REMAT/NETA) · `FigureZone` · `NodeShape` · `TagCategory` (PINYA/TRONC/XICALLA/ALTRES) · `Gender` · `ClientType` (dashboard/pwa) · `SegmentMoveConflictResolution`.

## Authentication

Login (email+password) → 15min JWT access token (in memory/signal) + 7d refresh token (httpOnly cookie with rotation and reuse detection). On 401 the interceptor refreshes and retries. `logout` revokes the token, `logout-all` revokes them all. `/auth` throttle: 10 req/60s. A cron job cleans expired refresh tokens. **Invites do not send email yet** (`user.service` only logs the token) — but `auth.service` does use `MailService` for password reset.

Frontend: `AuthService` (signals `currentUser`, `isAuthenticated`, `userRole`, `hasLinkedPerson`), `authGuard`, `rolesGuard(...)`, `AuthInterceptor`. Bootstrap silent refresh is gated by the `muixer_has_session` localStorage hint (avoids the console 401 on the login screen).

Detail: [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md) · SSE: [docs/SSE_AUTH.md](docs/SSE_AUTH.md).

## Language conventions

- **Code** (variables, functions, classes, endpoints, DB columns, commits): **English**
- **UI text** (buttons, labels, messages, placeholders): **Catalan**
- **Domain terms:** `Person` (not Casteller), `Membre` (gender-neutral), `Xicalla` (children, not canalla)
- **Style guide**: Read the skill language-rules (`.agents/skills/language-rules/`) before writing any text that may be visible to the user

## Testing conventions

- Backend: Jest, co-located `.spec.ts` files. Integration tests via testcontainers (`nx run api:test-integration`).
- Frontend: Vitest, co-located `.spec.ts` files.
- Coverage thresholds (enforced in CI via `--configuration=ci`): API 75/70/78/76 (statements/branches/functions/lines), dashboard 40/35/40/40.
- Test a single backend file: `nx test api --testFile=<path>`.
- Playwright e2e + responsive audit suite: [docs/AUDIT_SUITE.md](docs/AUDIT_SUITE.md).
- Phases/status → [docs/ROADMAP.md](docs/ROADMAP.md); open technical debt → [docs/DEBT.md](docs/DEBT.md).
- Always read the TDD skill (`.agents/skills/test-driven-development/`) and any other relevant skill before writing code.

## Documentation map

[docs/MAP.md](docs/MAP.md) is an Obsidian vault (open `docs/` as the vault) that indexes every doc with wikilinks and a generated map of the codebase. Check it before a broad architecture question — cheaper than exploring the tree from scratch. No automation keeps it in sync (deliberate): **you are the maintenance mechanism.**

- After adding/removing an API module, a dashboard/PWA feature, or editing a `.entity.ts` file, run `pnpm run docs:map` and `pnpm run docs:model` and include the diff in your commit. These only touch the `<!-- BEGIN:AUTO -->…<!-- END:AUTO -->` sections of `docs/MAP.md` and `docs/DATA_MODEL.md` — never edit inside those markers by hand.
- After creating a new doc under `docs/`, give it YAML frontmatter with a `tags: [domini|infra|qa|hub]`, a `*Veïns: [[...]]*` footer linking its 2–4 closest neighbors, and a row in the relevant table of `docs/MAP.md`.
- After resolving an item in [docs/DEBT.md](docs/DEBT.md), delete its row — don't mark it "✅ Resolved". The git log is the history; the doc only tracks what's still open.
