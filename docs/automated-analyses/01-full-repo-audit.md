# MuixerApp — Repository Analysis

> Full-stack code audit: bugs, security issues, architecture, code smells, test coverage and documentation drift. Scope: NestJS API, Angular dashboard, Docker/CI configuration. Both test suites were executed with coverage, not just read. Date: 2026-07-05 · Branch: `develop` Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🔵 Suggestion

## Index

1. [Executive summary](#0-executive-summary)
2. [Security](#1-security)
3. [Bugs & correctness](#2-bugs--correctness)
4. [Architecture](#3-architecture)
5. [Code smells & bad practices](#4-code-smells--bad-practices)
6. [Frontend (dashboard)](#5-frontend-dashboard)
7. [Dependencies & tooling](#6-dependencies--tooling)
8. [Tests](#7-tests)
9. [Documentation drift](#8-documentation-drift)

---

## 0. Executive summary

Overall this is a healthy codebase. Backend: consistent module structure, global auth guards with role whitelists on every controller, parameterized SQL everywhere (no injection found), whitelisted sort fields, DB unique constraints backing the critical domain invariants, hashed refresh tokens with rotation + reuse detection, non-root Docker images, migrations run on deploy. Frontend: zoneless Angular with signals + `OnPush` throughout, in-memory access tokens (no `localStorage`), no `innerHTML`/`bypassSecurityTrust*` anywhere, optimistic updates with rollback and a real undo/redo stack in the assignment canvas. Both apps have a real test suite. The findings below are mostly about hardening the last mile — plus a handful of correctness bugs that should be fixed regardless of severity ranking, because they make a shipped feature not work at all.

**Findings by section:**


| Section                   | 🔴          | 🟠           | 🟡           | 🔵           | Total         |
| ------------------------- | ----------- | ------------ | ------------ | ------------ | ------------- |
| 1. Security               | 2 (1 ✅)     | 11 (4 ✅)     | 4            | 1 (1 ✅)      | 18 (6 ✅)      |
| 2. Bugs & correctness     | 2 (1 ✅)     | 9 (2 ✅)      | 10 (1 ✅)     | 1            | 22 (4 ✅)      |
| 3. Architecture           | —           | 3 (1 ✅)      | 8 (1 ✅)      | —            | 11 (2 ✅)      |
| 4. Code smells            | —           | 1            | 11           | 3            | 15            |
| 5. Frontend (dashboard)   | —           | 2            | 11           | 3            | 16            |
| 6. Dependencies & tooling | 1           | —            | 2            | 1            | 5             |
| 7. Tests                  | —           | 3 (1 ✅)      | 3            | 2            | 8 (1 ✅)       |
| **Total**                 | **5 (2 ✅)** | **29 (8 ✅)** | **49 (2 ✅)** | **11 (1 ✅)** | **94** (13 ✅) |


*(✅ counts reflect fixes applied so far in this branch; updated as findings are resolved.)*

**Fix first — ranked across every section, not just by original discovery order:**


| #   | Finding                                                                                                                                                                                                       | Where                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | 🔴✅ [SEC-1](#-sec-1--hardcoded-fallback-jwt-secrets-change-me--fixed) Fallback JWT secret `'change-me'` — silent full-auth bypass if the env var is ever missing — **FIXED**                                  | `auth.module.ts`, `jwt.strategy.ts` |
| 2   | 🔴✅ [BUG-1](#-bug-1--patch-usersgrant-role-can-never-work-missing-id-in-route--fixed) `PATCH /users/grant-role` endpoint can never work (route bug) — **FIXED**                                               | `user.controller.ts:62`             |
| 3   | 🔴 [BUG-2](#-bug-2--promoting-a-provisional-person-always-fails) Provisional-person promotion always fails (`managedBy` never loaded)                                                                         | `person.service.ts:250`             |
| 4   | 🔴 [SEC-2](#-sec-2--xlsx-sheetjs-0185-with-known-cves-used-to-parse-external-data) `xlsx` 0.18.5 with known CVEs, used to parse external data                                                                 | `legacy-api.client.ts`              |
| 5   | 🟠✅ [SEC-7](#-sec-7--technical-users-can-modify-and-deactivate-admin-accounts--fixed) TECHNICAL users can deactivate/edit ADMIN accounts — **FIXED**                                                          | `user.service.ts`                   |
| 6   | 🟠 [SEC-14](#-sec-14--production-image-installs-unpinned-dependencies) Prod Docker image installs unpinned deps (`--no-lockfile`)                                                                             | `apps/api/Dockerfile`               |
| 7   | 🟠✅ [TEST-1](#7-tests) Backend auth guards & strategies at **0% coverage** — the entire authz enforcement layer is untested — **FIXED**                                                                       | `auth/guards`, `auth/strategies`    |
| 8   | 🟠 [SEC-8](#-sec-8--no-trust-proxy--per-ip-throttling-is-broken-behind-the-reverse-proxy) Missing `trust proxy` → rate limiting shared by all users behind Caddy                                              | `main.ts`                           |
| 9   | 🟠 [BUG-19](#-bug-19--deactivatemissingpersons-trusts-the-legacy-fetch-blindly) Sync can mass-deactivate the census on a partial legacy response                                                              | `person-sync.strategy.ts`           |
| 10  | 🟠✅ [SEC-3](#-sec-3--setup-endpoint-non-constant-time-token-comparison-unlimited-use--fixed) Setup endpoint mints ADMIN accounts forever while `SETUP_TOKEN` is set — **FIXED**                               | `auth.controller.ts`                |
| 11  | 🟠 [BUG-17](#-bug-17--lazy-snapshot-has-a-check-then-act-race-duplicate-instance-nodes) Lazy-snapshot race duplicates instance nodes under concurrent first-assignment                                        | `node-assignment.service.ts:340`    |
| 12  | 🟠 [BUG-11](#-bug-11--applycomposition-sortorder-computed-outside-the-transaction--duplicated-orders) `applyComposition` gives every figure the same `sortOrder` (cross-connection read inside a transaction) | `figure-instance.service.ts`        |
| 13  | 🟠 [FE-13](#-fe-13--template-editor-pending-autosave-is-discarded-on-most-exits) Template editor silently drops pending autosave on most exit paths (data loss)                                               | `template-editor.component.ts`      |
| 14  | 🟠 [FE-6](#-fe-6--rotation-handle-breaks-on-touch-devices-and-can-leak-window-listeners) Rotation handle dead on touch devices + leaves the slot permanently un-draggable                                     | `figure-canvas.component.ts:1148`   |
| 15  | 🟠 [TEST-3](#7-tests) Dashboard coverage is bimodal — pinyes core 90%+, but critical modals (incl. role assignment) sit at 0-11%                                                                              | dashboard                           |


The single highest-leverage structural change is **ARCH-1** (centralized, validated config): it eliminates SEC-1, the scattered `process.env` reads, and the import-time env parsing in one move. ✅ **Fixed** — see below.

---

## 1. Security

### 🔴✅ SEC-1 — Hardcoded fallback JWT secrets (`'change-me'`) — FIXED

`apps/api/src/modules/auth/auth.module.ts:20` and `apps/api/src/modules/auth/strategies/jwt.strategy.ts:25`:

```ts
secret: process.env['JWT_SECRET'] ?? 'change-me',
```

and `token.service.ts:57`:

```ts
secret: process.env['JWT_REFRESH_SECRET'] ?? 'change-me-refresh',
```

If `JWT_SECRET` is ever missing from the environment (typo in `.env.production`, forgotten var in a new deploy, CI e2e environment…), the API silently signs **and verifies** access tokens with a publicly known string. Anyone can then forge a token with `role: "ADMIN"` and full access. A missing secret should be a **fatal startup error**, never a silent fallback.

**Recommendation:** validate required env vars at bootstrap (e.g. `@nestjs/config` + Joi/Zod schema, or a manual assert in `main.ts`) and remove every `?? 'change-me*'` fallback. See also ARCH-3.

**Fix applied:** added `requireJwtSecret(envVar)` (`apps/api/src/modules/auth/constants/jwt-secret.util.ts`), which throws instead of falling back when the var is missing/empty. `auth.module.ts`, `jwt.strategy.ts` and `token.service.ts` now use it, so a missing `JWT_SECRET`/`JWT_REFRESH_SECRET` fails app bootstrap instead of silently signing/verifying with a public string. Covered by new specs (`jwt-secret.util.spec.ts`, `jwt.strategy.spec.ts`, and a `TokenService construction` suite in `token.service.spec.ts`). The broader structural fix (centralized/validated config, ARCH-1) has since been applied too — see below.

### 🔴 SEC-2 — `xlsx` (SheetJS) 0.18.5 with known CVEs, used to parse external data

`package.json` pins `"xlsx": "^0.18.5"`. The npm-published package has been abandoned since 2022 and has unfixed vulnerabilities on npm:

- **CVE-2023-30533** — Prototype pollution when parsing crafted files.
- **CVE-2024-22363** — ReDoS.

It *is* used to parse data downloaded from the legacy server (`apps/api/src/modules/sync/legacy-api.client.ts:3`), i.e. external input. Fixed versions (≥0.19.3 / ≥0.20.2) are only distributed via `https://cdn.sheetjs.com`.

**Recommendation:** switch to the official SheetJS CDN distribution or migrate to a maintained alternative (e.g. `exceljs`).

### 🟠✅ SEC-3 — Setup endpoint: non-constant-time token comparison, unlimited use — FIXED

`auth.controller.ts:179`:

```ts
if (setupToken !== expected) throw new ForbiddenException(...);
```

1. `!==` is not constant-time; combined with 10 req/min throttling the practical risk of a timing attack is low, but `crypto.timingSafeEqual` is the correct tool.
2. More important: `POST /api/auth/setup/user` is **not limited to bootstrapping the first user**. As long as `SETUP_TOKEN` is set, anyone holding it can mint unlimited `TECHNICAL`/`ADMIN` accounts (`SetupUserDto.role` allows `ADMIN`). The code comment relies on the operator remembering to remove the env var in production — a fragile, human-dependent control.
3. Idempotent lookup by email returns the existing profile, which also makes it an **email-existence oracle**.

**Recommendation:** refuse setup when `userRepo.count() > 0` (true bootstrap), use `timingSafeEqual`, and log every use of the endpoint.

**Fix applied:**

1. Added `safeCompare()` (`apps/api/src/common/utils/timing-safe-equal.util.ts`, TDD-covered) — compares buffer lengths first (cheap, non-secret), then `crypto.timingSafeEqual`, so mismatched-length tokens return `false` instead of throwing. Wired into `AuthController.setupUser` in place of `!==`.
2. `AuthService.setupUser` now calls `userRepo.count()` **before** touching anything else and throws `ForbiddenException` if any user already exists — this is a true one-time bootstrap, not a standing account-creation endpoint. Since the count check runs first, it also structurally closes point 3: the endpoint never reaches the email lookup once the system is bootstrapped, so it can't be used as an email-existence oracle post-bootstrap. The old idempotent "return existing user by email" branch was removed as dead code (unreachable once the count gate is in place).
3. Both the controller (bad/missing token) and the service (already-bootstrapped refusal, successful creation) now log every use via `Logger`, without logging the password or the token value itself.
4. **Scope addition (per explicit request, not in the original finding):** the endpoint only ever creates an **ADMIN** account now — `SetupUserDto.role` was removed entirely (client can no longer request `TECHNICAL`), and `AuthService.setupUser` hardcodes `role: UserRole.ADMIN`. Rationale: since the endpoint is now single-use, accidentally bootstrapping a `TECHNICAL` account would permanently lock the system out of ADMIN-only features (nothing else can grant the ADMIN role). `nx build api`, `nx lint api` and the full `nx test api` suite (590 tests) pass.

### 🟠✅ SEC-4 — JWT accepted via `?token=` query parameter on every endpoint — FIXED

`jwt.strategy.ts:16-23` registers a query-string extractor globally (added for SSE, which can't set headers). Consequences:

- Access tokens end up in proxy/access logs, browser history and potentially `Referer` headers.
- The extractor applies to **all** endpoints, not just the SSE ones.

**Recommendation:** scope the query extractor to the SSE routes only (separate strategy/guard), or use short-lived single-purpose tokens for SSE, or authenticate SSE via the httpOnly cookie.

**Fix applied:** split into two Passport strategies. The default `JwtStrategy` now only accepts the `Authorization` header (the `?token=` extractor was removed from it entirely). A new `SseJwtStrategy` (`jwt-sse`) carries the query-param extractor — factored into a standalone, unit-tested `extractSseQueryToken()` — and is only reachable via a new `@SseAuth()` decorator. `JwtAuthGuard` (the sole global guard) checks for `@SseAuth()` metadata (same `Reflector` pattern as `@Public()`) and routes those requests to the SSE strategy instead of the default one; every other route can no longer authenticate via query string even if a valid token is passed that way. `SyncController` (the only SSE controller — `/sync/persons`, `/sync/events`, `/sync/events/:id/attendance`, `/sync/all`) is now the only place `@SseAuth()` is applied. Covered by `sse-token-extractor.util.spec.ts`, `jwt-sse.strategy.spec.ts`, and new `JwtAuthGuard` cases proving public/SSE/default requests are routed to the correct strategy and that the default strategy is never invoked for `@SseAuth()` routes.

### 🟠✅ SEC-5 — Refresh token rotation is not atomic (race weakens reuse detection) — FIXED

`token.service.ts:82-108` (`rotateRefreshToken`) does `findOne` → check `usedAt` → `update(...usedAt)` as three separate steps. Two concurrent requests presenting the same refresh token can both pass the `usedAt === null` check and both obtain fresh tokens: the family-revocation reuse detection is bypassed, and a stolen-token replay racing the legitimate client goes unnoticed.

**Recommendation:** atomic claim, e.g.

```sql
UPDATE refresh_tokens SET used_at = now()
WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL
```

and treat `affected === 0` as reuse.

**Fix applied:** `rotateRefreshToken` now marks the token used via a single conditional `update({ id, usedAt: IsNull() }, { usedAt: new Date() })` instead of a separate read-check-write. The prior `stored.usedAt !== null` branch (racy — read from a snapshot that could be stale by the time the write happened) was removed; reuse detection now keys off `claim.affected === 0`, which is true both for a genuinely-already-used token and for a request that loses the race to a concurrent one, so both cases correctly revoke the whole token family. `revokedAt`/`expiresAt` checks still happen from the initial read (no concurrent-double-redeem risk there — only forward-moving state). Covered by an updated `token.service.spec.ts`: one test asserts the exact atomic `WHERE id = ... AND usedAt IS NULL` shape of the claim, another asserts that `affected: 0` triggers family revocation regardless of the reason.

### 🟠 SEC-6 — Invite tokens: stored in plaintext and printed to logs

- `user.entity.ts:33` — `inviteToken` is stored as-is; `AuthService.acceptInvite` looks it up by plaintext equality. Refresh tokens are correctly stored as SHA-256 hashes, invite tokens are not. A DB dump/backup leak allows takeover of every pending account. (Same will apply to `resetToken` when implemented.)
- `user.service.ts:165-170` — `sendInvitationEmail` is a stub that `console.log`s the email + invite token, so live tokens land in server logs.

**Recommendation:** store `sha256(inviteToken)`, look up by hash; never log the token (log the user id instead).

### 🟠✅ SEC-7 — TECHNICAL users can modify and deactivate ADMIN accounts — FIXED

`UserController` is class-guarded with `@Roles(ADMIN, TECHNICAL)`. The role-hierarchy check (`assertCanAssignRole`) only runs when `dto.role` is present. So a TECHNICAL user can, on an **ADMIN** account:

- change its `email` (`PATCH /users/:id`),
- flip `isActive` false→true or true→false (`PATCH /users/:id` and `PATCH /users/:id/deactivate`),
- relink its `person`.

Net effect: a TECHNICAL user can lock every ADMIN out of the system — a privilege-inversion. There was also no self-protection (a user could deactivate themselves).

**Recommendation:** in `updateUser`/`deactivateUser`, reject when `target.role === ADMIN && actor.role !== ADMIN`; consider preventing self-deactivation.

**Fix applied:** both `UserService.updateUser` and `UserService.deactivateUser` (`user.service.ts`) now reject with `ForbiddenException` up front — before touching `email`, `isActive`, `role` or `personId` — whenever `target.role === ADMIN && actorRole !== ADMIN`. This blocks the whole field set in one guard, not just the `role` field. `deactivateUser` previously took no actor at all; its signature now requires `actorRole`, and `UserController.deactivateUser` (`user.controller.ts:72-81`) passes `@CurrentUser().role` through. Covered by new specs in `user.service.spec.ts` (TECHNICAL blocked from editing/deactivating an ADMIN account; ADMIN still allowed) and an updated `user.controller.spec.ts` assertion for the new `deactivateUser` signature.

Self-deactivation is now blocked too (any role, not just ADMIN — including the sole-admin case, on purpose, to avoid ever needing a "last admin" carve-out): both `updateUser` (when `dto.isActive === false`) and `deactivateUser` throw `ForbiddenException` when `userId === actorId`. Both methods now take an `actorId` param; the controller passes `@CurrentUser().sub`. The dashboard needed no change — `UserService.deactivate`'s existing error handler (`user-list.component.ts:362-365`) already surfaces `err.error.message`, so the Catalan `ForbiddenException` message renders as a toast automatically. Admin-on-admin and TECHNICAL-on-TECHNICAL deactivation remain allowed (standard same/higher-tier peer model), consistent with `assertCanAssignRole`'s existing ADMIN-bypass semantics.

Self-*demotion* was the same footgun and was still open after the above: an ADMIN could change their own `role` via `updateUser`, and — since `grantRole` is ADMIN-only at the route level — an ADMIN could also grant themselves a lower role via `PATCH /users/:id/grant-role`, either way locking themselves out of ADMIN-only features with nobody else able to reverse it if they were the only admin. Both paths now reject with `ForbiddenException` when `userId === actorId` and the new role differs from the current one (a same-role no-op call is not blocked). `grantRole` also gained an `actorId` parameter for this check, threaded from `@CurrentUser().sub` in the controller.

### 🟠 SEC-8 — No `trust proxy` ⇒ per-IP throttling is broken behind the reverse proxy

Production runs behind Caddy (`docker-compose.pre.yml` / prod), but `main.ts` never sets Express `trust proxy`. `@nestjs/throttler` keys on `req.ip`, which will always be the proxy's IP:

- All users share one 100 req/min bucket → self-inflicted DoS as soon as a few people use the dashboard simultaneously.
- The stricter 10 req/min limit on `/auth/`* is shared by the whole colla, and an attacker brute-forcing login throttles *everyone* while their own attempts blend into the shared bucket (no per-attacker limit).

**Recommendation:** `app.set('trust proxy', 1)` (via `app.getHttpAdapter().getInstance()`), make sure Caddy sets `X-Forwarded-For`, and verify the throttler sees real client IPs.

### 🟠 SEC-9 — Pre-production compose publishes PostgreSQL (and the API) to the host

`docker-compose.pre.yml`:

```yaml
postgres:
  ports:
    - '5432:5432'
```

On a VPS this exposes Postgres to the Internet unless an external firewall intervenes — and Docker's iptables rules famously bypass UFW. The API is also published directly on `3000:3000` even though Caddy is the intended entrypoint. The prod compose gets it right for Postgres (no ports) but still publishes the API on `3000:3000`.

**Recommendation:** remove the `ports` mapping for postgres in pre (containers reach it over the internal network), or bind to loopback (`127.0.0.1:5432:5432`); same for the API unless it must be reachable without Caddy.

### 🟡 SEC-10 — Swagger UI exposed in production

`main.ts` sets up Swagger unconditionally at `/api/docs`. `SwaggerModule` serves its UI/JSON outside the global guards, so the full API surface (routes, DTOs, roles) is publicly readable in prod — useful recon material.

**Recommendation:** gate it behind `NODE_ENV !== 'production'` (or basic auth).

### 🟡 SEC-11 — No security headers (`helmet`)

No `helmet` (or equivalent) in `main.ts`. The API mostly serves JSON, but Swagger UI is HTML, and default headers (`X-Content-Type-Options`, `Strict-Transport-Security` if TLS terminates at Caddy but is misconfigured, etc.) are cheap defense-in-depth.

### 🟡 SEC-12 — Deactivating a user does not revoke their sessions

`UserService.deactivateUser` only flips `isActive`. Existing refresh tokens are *effectively* dead (refresh re-checks `isActive`) but the current **access token stays valid until expiry** (default 15 min) since `JwtStrategy.validate` never touches the DB. Combined with SEC-7 this window matters.

**Recommendation:** call `tokenService.revokeAllUserTokens(userId)` on deactivation; optionally check `isActive` in the JWT strategy for sensitive endpoints.

### 🔵✅ SEC-13 — User enumeration via login timing — FIXED

`AuthService.validateUser` only runs `bcrypt.compare` when the email exists — a measurable timing difference. Classic mitigation: compare against a dummy hash when the user is not found. Low priority given throttling.

**Fix applied:** added a `dummyPasswordHash` (bcrypt hash of a fixed string, same `BCRYPT_ROUNDS` cost as real password hashes) computed once per `AuthService` instance. `validateUser` now always calls `bcrypt.compare` exactly once — against `user?.passwordHash ?? dummyPasswordHash` — before checking existence/`isActive`/validity, so the (deliberately slow) bcrypt call always runs regardless of whether the email is registered. Covered by a new test asserting `bcrypt.compare` is still invoked when `userRepo.findOne` resolves `null`.

### 🟠 SEC-14 — Production image installs unpinned dependencies

`apps/api/Dockerfile:29-30`:

```dockerfile
RUN pnpm install --prod --no-lockfile && \
    pnpm add pg tslib bcrypt typeorm dotenv --no-lockfile
```

The final image explicitly bypasses `pnpm-lock.yaml`, so every build resolves **whatever the latest matching versions are that day** — the production `typeorm`/`pg`/`bcrypt` can differ from what CI tested, and a compromised or broken upstream release lands straight in prod. Generate the dist `package.json` with exact pinned versions (or copy the workspace lockfile and use `--frozen-lockfile`).

### 🟡 SEC-15 — `rejectUnauthorized: false` for SSL DB connections

`database.module.ts:50` and `data-source.ts:11`: when `DB_SSL=true` (managed Postgres), TLS is used **without certificate validation** — the connection is encrypted but MITM-able. Supply the provider CA (`ssl: { ca }`) or at least make this an explicit, documented exception.

### 🟠 SEC-16 — Sync endpoints: state-changing GETs, no concurrency guard

`sync.controller.ts` — `GET /sync/persons|events|all` are **GET requests with heavy side effects** (bulk upserts + mass deactivation). Because they're SSE they also authenticate via `?token=` (SEC-4), so the URL that triggers a full data-mutation lands in access logs. There is **no lock**: two admins (or a reconnecting EventSource — browsers auto-reconnect SSE by re-issuing the GET!) run the same sync concurrently, racing alias-uniqueness checks and upserts. An in-process mutex (or advisory lock) that rejects a second concurrent sync would remove the whole class.

### 🟠 SEC-17 — Assignment lock (`ASSIGNMENT_LOCK_DAYS`) is bypassable

The lock (`checkEventLock`) protects `assign`, `swap`, `unassign`, `resetSnapshot`, `bulkImport` and the ad-hoc node CRUD in `node-assignment.service.ts`. But other mutations of locked data skip it:

- `FigureInstanceService.update` (`figure-instance.service.ts:114-135`): changing `figureMode` to `REMAT`/`NETA` **deletes pinya assignments** with no lock check — a destructive bypass of the lock.
- `NodeAssignmentService.updateCordons` (`node-assignment.service.ts:957`) — mutates locked instances.
- `FigureInstanceService.remove` — deleting a whole instance (cascades all its assignments) is not lock-checked either.

If the lock is meant to freeze historical events (it throws `ForbiddenException`, so it is an access-control rule), it must cover every mutation path of instance/assignment data for that event.

### 🟠 SEC-18 — Pre-production runs over plain HTTP with session cookies

`apps/dashboard/Caddyfile` listens on `:80` only ("HTTP accessible per IP"), and the API's cookie code has an escape hatch for exactly this (`COOKIE_SECURE=false` in `auth.controller.ts:53`). The result on a public VPS: login credentials, bearer tokens and the refresh cookie travel **in cleartext**. Caddy makes HTTPS nearly free (the Caddyfile comment even explains how) — pre environments with real user data deserve it. Note also the dashboard `Dockerfile` hardcodes `--configuration=pre`, so the same image can't serve the prod build (`docker-compose.prod.yml` currently ships no dashboard service at all).

---

## 2. Bugs & correctness

### 🔴✅ BUG-1 — `PATCH /users/grant-role` can never work (missing `:id` in route) — FIXED

`user.controller.ts:62-70`:

```ts
@Patch('grant-role')
grantRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantUserRoleDto)
```

The route declares **no `:id` path parameter**, yet the handler reads `@Param('id')` through `ParseUUIDPipe`. Every call receives `undefined`, the pipe throws, and the endpoint always returns `400 Validation failed (uuid is expected)`. `GrantUserRoleDto` only carries `role`, so the target user cannot be specified at all. The ADMIN "grant role" feature is dead on arrival (role changes only work through the generic `PATCH /users/:id`).

**Fix:** `@Patch(':id/grant-role')` (declared *before* `@Patch(':id')` to keep route precedence).

**Fix applied:** `user.controller.ts:62` now declares `@Patch(':id/grant-role')`, ahead of the generic `@Patch(':id')` handler so route precedence still resolves correctly. The dashboard's `UserService.grantRole` (`user.service.ts:38`) was updated to match — it now calls `PATCH /users/:id/grant-role` with only `{ role }` in the body instead of `PATCH /users/grant-role` with `{ userId, role }`. Covered by a route-metadata assertion in `user.controller.spec.ts` (fails without the `:id` segment) and an updated `user.service.spec.ts` request-shape test.

### 🔴 BUG-2 — Promoting a provisional person always fails

`person.service.ts:211-255`. The promotion path (provisional → regular) requires the person to have a managing user:

```ts
const person = await this.personRepository.findOne({
  where: { id },
  relations: ['positions', 'mentor'],   // ⟵ managedBy NOT loaded
});
...
if (!person.managedBy) {
  throw new BadRequestException('Cal proporcionar un usuari per promoure...');
}
```

`managedBy` is never in `relations`, so `person.managedBy` is always `undefined` and the check **always throws**, even for persons that do have a manager. Passing `managedById` in the same request doesn't help either, because that field is processed *after* the check (line 296).

**Fix:** load `managedBy` in the `findOne` relations and consider `dto.managedById` in the check (`dto.managedById ?? person.managedBy`).

### 🟠✅ BUG-3 — Sorting users by `alias` generates invalid SQL — FIXED

`user-sort.constants.ts:14` maps `alias → 'user.person.alias'`, but the query in `UserService.findAll` joins the relation under the alias `person`. TypeORM will not resolve the three-segment path `user.person.alias`; it passes it through to SQL where Postgres reads it as `schema.table.column` and errors (500) on `GET /users?sortBy=alias`.

**Fix:** map it to `'person.alias'` (the join alias). The `Partial<Record<...>>` type of the map also silently tolerates missing keys — a plain `Record` would catch this at compile time.

**Fix applied:** `user-sort.constants.ts:14` now maps `alias → 'person.alias'`, matching the join alias used in `UserService.findAll`'s `leftJoinAndSelect('user.person', 'person')`. Also tightened `USER_SORT_COLUMN_MAP`'s type from `Partial<Record<UserSortByField, string>>` to `Record<UserSortByField, string>`, so a future missing/mistyped sort key fails at compile time instead of silently falling through to the default sort. Covered by a new spec in `user.service.spec.ts` asserting `orderBy` is called with `'person.alias'` (not the invalid three-segment path) when sorting by alias. Full suite: 620/620 passing, lint clean.

### 🟠 BUG-4 — `sendInvite`: floating promise + `throw` inside `.catch`

`user.service.ts:160-163`:

```ts
this.sendInvitationEmail(user.email, inviteToken).catch((err) => {
  throw new BadRequestException('Failed to send invite email');
});
```

The promise is not awaited, and throwing inside `.catch` of a floating promise produces an **unhandled promise rejection** (process-fatal in Node by default) instead of a 400 — the HTTP response has typically already been sent. Today the stub can't reject, but the moment a real mailer lands here this becomes a crash vector.

**Fix:** `await` it (and decide whether a mail failure should roll back the invite fields).

### 🟠✅ BUG-5 — Refresh cookie TTL derived from role instead of the token's stored `clientType` — FIXED

`auth.controller.ts:99-103`: on refresh, the cookie max-age is chosen by `role === 'MEMBER' ? PWA : DASHBOARD`. But `clientType` is already persisted on the `RefreshToken` row (and embedded in the JWT payload). A TECHNICAL/ADMIN user logged in from the PWA gets a token valid 7 days in the DB but a cookie that dies after 8 h (and vice versa) — silent forced logouts / TTL mismatch.

**Fix:** return `clientType` from `TokenService.rotateRefreshToken` (it reads the stored row anyway) and use that.

**Fix applied:** `TokenService.rotateRefreshToken` now returns the stored `clientType` alongside `newRawToken`/`userId`. `AuthService.refresh` threads it through instead of re-deriving anything from role. `AuthController.refresh` now sets the cookie from that returned `clientType` directly — the `role === 'MEMBER' ? PWA : DASHBOARD` guess is gone entirely.

**Scope addition (per explicit request):** while fixing this, also added a role gate on **login** (not just refresh): `AuthService.login` now rejects with `UnauthorizedException` when `clientType === DASHBOARD` and the user's role isn't `ADMIN`/`TECHNICAL` — MEMBER accounts can only ever authenticate via the PWA client. This closes the gap BUG-5 was symptomatic of: previously nothing stopped a MEMBER from requesting a `DASHBOARD` session at login, which is exactly the divergence (role implies one clientType, the stored token says another) that made the old role-guessing logic wrong in the first place. `acceptInvite` already self-selected `clientType` from role (MEMBER→PWA, else→DASHBOARD) and needed no change — it can't produce a MEMBER+DASHBOARD combination by construction. The dashboard frontend always sends `clientType: DASHBOARD` on login, so a MEMBER now gets a clean 401 there instead of the confusing successful-login-then-bounced-to-`/login` behavior described in FE-2 (FE-2's frontend messaging is still open, but its backend root cause is closed).

Covered by TDD: `token.service.spec.ts` asserts the returned `clientType`; `auth.service.spec.ts` gained a `describe('refresh', ...)` block (previously **untested**) plus login-restriction cases (`MEMBER`+`DASHBOARD` rejected, all roles allowed via `PWA`, `ADMIN`/`TECHNICAL` allowed via `DASHBOARD`); `auth.controller.spec.ts` gained a regression test using a deliberately role/clientType-divergent fixture (`TECHNICAL` role, `PWA` session) proving the cookie TTL follows the stored `clientType` and not the role.

### 🟡✅ BUG-6 — Token-cleanup cron: second delete is dead code — FIXED

`token.service.ts:126-138`. The first `delete` removes everything with `expiresAt < now-30d`. The second one targets `revokedAt IS NOT NULL AND expiresAt < now-30d` — a strict **subset of what the first query just deleted**; it always affects 0 rows. Per the doc-comment, the intent was "revoked more than 30 days ago", i.e. `revokedAt: LessThan(thirtyDaysAgo)`. Consequence: revoked-but-unexpired tokens linger ~30 days past expiry instead of 30 days past revocation. Harmless in practice, but the code doesn't do what it says.

**Fix applied:** second `delete` now keys off `revokedAt` alone via TypeORM's `And(Not(IsNull()), LessThan(thirtyDaysAgo))`, generating `WHERE revoked_at IS NOT NULL AND revoked_at < now-30d` — matching the doc-comment's actual intent instead of duplicating the first query's `expiresAt` condition. Covered by an updated `token.service.spec.ts` asserting the second `delete` call's criteria has no `expiresAt` key and combines both `revokedAt` conditions via `And`.

### 🟡 BUG-7 — `UserProfile.person.email` is always `null`

`auth.service.ts:66`: `email: person.managedBy?.email ?? null`, but every caller loads only `relations: ['person']` — `person.managedBy` is never populated, so login/`/auth/me` always return `person.email: null`.

### 🟡 BUG-8 — `PersonResponseDto.email` doesn't exist on the entity

`person-response.dto.ts:69-70` exposes `email`, but the `Person` entity has no `email` column (contact email apparently lives on the managing `User`). The field is always `undefined` in every person response — dead API surface that the frontend may be blindly trusting.

### 🟡 BUG-9 — Manual activate/deactivate of a person overwrites `lastSyncedAt`

`person.service.ts:338,358` set `lastSyncedAt = new Date()` on manual (de)activation. That column is the bookkeeping marker of the **legacy sync** (`person-sync.strategy.ts` sets it on every synced/deactivated record). Manually touching it makes a hand-edited person look "just synced", which can confuse any sync logic that reasons about staleness. Semantics mixing; use a different marker (or plain `updatedAt`).

### 🟡 BUG-10 — Provisional alias truncation can collide; unique violations surface as 500

`person.service.ts:177-204` and the demotion path both build `~` + alias and `.slice(0, 20)`. Two distinct 20-char aliases can truncate to the same value; `createProvisional` pre-checks existence (TOCTOU race aside) but the **demotion path performs no check** — the DB unique constraint then throws and reaches the client as an unhandled 500 instead of a 409. Same for alias conflicts in `update` generally.

### 🟠 BUG-11 — `applyComposition`: sortOrder computed outside the transaction → duplicated orders

`figure-instance.service.ts:494-522`. Inside the `dataSource.transaction(...)` loop, `MAX(sortOrder)` is queried through `this.instanceRepository` — i.e. on a **different connection** than the transaction's manager. Under READ COMMITTED it cannot see the rows the transaction just inserted, so the max never advances: **every entry of the composition receives the same `sortOrder`**, and the resulting figures render in nondeterministic order. Fix: query the max once via `manager` (or compute `base + i`).

### 🟠 BUG-12 — Two different "pinya capacity" formulas

The same concept is computed with different SQL in two places:

- `event-segment.service.ts:254-292` (`loadPinyaCapacities`, used by segment lists): counts `zone IN ('PINYA')` with `r."sortOrder" <= fi."numberOfCordons"`.
- `figure-instance.service.ts:400-420` (`findOneById`, returned after each instance mutation): counts `zone IN ('PINYA','BASE')` with `r."sortOrder" < $2` (strict).

Same instance, two endpoints, two different capacity numbers (off by the BASE nodes and by one cordon). The dashboard shows whichever it fetched last — inconsistent "assigned/capacity" badges. One definition should exist in one place.

### 🟠 BUG-13 — `figureMode` change deletes assignments before saving, non-transactionally

`figure-instance.service.ts:124-133`: when switching to `REMAT`/`NETA`, pinya assignments are deleted **first** and the instance is saved **after**, with no transaction. If the save fails (or the request dies in between), assignments are gone but the mode never changed. Wrap both in one transaction (and see SEC-17: no lock check either).

### 🟠 BUG-14 — Template node updates can never *clear* `renglaId` / `renglaPosition` / `originNodeId`

`figure-template.service.ts:546-548` (`syncNodes` upsert):

```ts
node.originNodeId = dto.originNodeId ?? node.originNodeId;
node.renglaId = dto.renglaId ?? node.renglaId;
node.renglaPosition = dto.renglaPosition ?? node.renglaPosition;
```

Sending `null`/omitting falls back to the previous value, so detaching a node from a rengla through the editor's save endpoint is silently ignored (the value only ever clears when the whole rengla is deleted via `syncRengles`). Use an explicit `!== undefined` check like the rest of the codebase does.

### 🟡 BUG-15 — Duplicating a template twice → 500

`figure-template.service.ts:230-256`: `duplicate()` names the copy `"<name> (còpia)"`; `name` has a unique constraint and, unlike `create`/`update`, this save is **not** wrapped in `handleDbError`. Duplicating the same template twice throws a raw `QueryFailedError` → 500 instead of a 409 (or an auto-suffixed name via the existing `generateUniqueName`).

### 🟡 BUG-16 — Fuzzy search ordering ignores name similarity

`available-persons.service.ts:142-147`: the ORDER BY uses `GREATEST(word_similarity(:rawSearch, alias))` — `GREATEST` with a **single argument**. The WHERE clause matches on alias *or* name similarity, but results that matched via `name` are then ranked only by alias similarity. The second `word_similarity(... person.name)` argument was evidently lost.

### 🟠 BUG-17 — Lazy snapshot has a check-then-act race (duplicate instance nodes)

`node-assignment.service.ts:340-350` (also `bulkImport`, `createAdHocNode`): `if (!instance.snapshotted) { await this.snapshotInstance(...) }`. Two concurrent first assignments both read `snapshotted = false` and both run the snapshot transaction → **every template node is copied twice** into `instance_nodes` (there is no unique constraint on `(figureInstanceId, sourceNodeId)`). The canvas then renders duplicated nodes. Fix: unique partial index on `(figureInstanceId, sourceNodeId)` + `ON CONFLICT DO NOTHING`, or claim the snapshot atomically (`UPDATE ... SET snapshotted = true WHERE id = $1 AND snapshotted = false` and only the winner copies).

### 🟡 BUG-18 — Assignment conflict checks are TOCTOU; segment-level rule has no DB constraint

`assign()` does three read-then-insert conflict checks. The node and person cases are backed by DB unique constraints (`@Unique(['figureInstance','instanceNode'])`, `@Unique(['figureInstance','person'])`) so a race "only" produces a 500 instead of 409. But the third rule — *person may appear only once per segment* — exists **only in application code**: two concurrent assigns into different instances of the same segment can both pass and persist, violating the domain invariant that a person can't be in two figures at once.

### 🟠 BUG-19 — `deactivateMissingPersons` trusts the legacy fetch blindly

`person-sync.strategy.ts:588-607`: after a sync, every person whose `legacyId` was not in the fetched list is deactivated. The only guard is `legacyIds.length === 0`. If the legacy API ever returns a **partial** list (WAF page for some rows, changed server-side filter, pagination change), the sync mass-deactivates most of the census in one UPDATE. A sanity threshold ("refuse to deactivate more than N% in one run") turns a silent disaster into a visible warning.

### 🟡 BUG-20 — Legacy session never re-authenticates on expiry

`legacy-api.client.ts`: every fetch does `if (!this.sessionCookie) await this.login()` — but once set, the cookie is assumed valid forever. When the PHP session expires, subsequent calls receive the login page; `extractRows` then throws "Invalid response format" (and detail endpoints silently cast HTML to typed objects). No retry-with-relogin, and `validateStatus: () => true` means non-200s pass through unnoticed in the detail/JSON endpoints.

### 🟡 BUG-21 — Person sync unconditionally overwrites `managedBy`

`person-sync.strategy.ts:462-463`: on every sync, `existing.managedBy = managedByUser ?? null`. Any person↔user link created manually in MuixerApp is silently severed on the next sync if the legacy record has no (or a different) email. Combined with BUG-2 (promotion requires `managedBy`), manual fixes don't survive a sync.

### 🔵 BUG-22 — `swap` re-creates assignments, resetting their timestamps

`node-assignment.service.ts:464-482` deletes and re-inserts both rows (keeping ids) instead of updating `personId`. `createdAt` is reset, so any future auditing/history based on assignment age is distorted. A two-`UPDATE` approach with deferred constraint checking (or a temporary sentinel) keeps history intact.

---

## 3. Architecture

### 🟠✅ ARCH-1 — No centralized/validated configuration — FIXED

`process.env` is read ad-hoc all over (`auth.module.ts`, `token.service.ts`, `main.ts`, constants files, controllers). There is no `@nestjs/config`, no schema validation, no fail-fast on missing values — which is exactly what makes SEC-1 possible. `auth.constants.ts` reads env at *module import time*, before `dotenv/config` might have run in some entrypoints (works today only because `main.ts` imports dotenv first; the CLI scripts must each remember to do the same).

**Recommendation:** adopt `ConfigModule.forRoot({ validationSchema })` (or a single typed `env.ts` with assertions) and inject config instead of reading `process.env` at import time.

**Fix applied:** added a Joi schema (`apps/api/src/config/env.validation.ts`, covered by `env.validation.spec.ts`) validating every known env var — required (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`) vs. optional-with-defaults (`PORT`, `CORS_ORIGINS`, TTLs, `ASSIGNMENT_LOCK_DAYS`, `LEGACY_API_*`, `SETUP_TOKEN`, ...) — and registered it globally via `ConfigModule.forRoot({ isGlobal: true, validationSchema })` in `app.module.ts`. Nest now refuses to finish bootstrapping if any required variable is missing or malformed, before any provider (DB connection, auth strategies, HTTP server) is instantiated.

`auth.controller.ts`, `auth.service.ts` and `main.ts` — the specific files named above — were migrated from raw `process.env` reads to injected `ConfigService`. `auth.constants.ts`, `database.module.ts`, `legacy-api.client.ts` and `node-assignment.service.ts` still read `process.env` directly for non-security-critical values (TTLs, lock days, legacy sync credentials); this was a deliberate scope call, not an oversight — those reads now execute only after `ConfigModule`'s schema validation has already run as part of Nest's module-graph resolution (it's first in `AppModule.imports`), so a missing/malformed value there is still a fatal startup error, and rewriting every call site to inject `ConfigService` would have been pure churn with no additional safety. Revisit if those files grow new config surface.

### 🟠 ARCH-2 — Multi-step DB writes without transactions in user/person flows

Examples:

- `UserService.createWithInvite`: create user → save person.managedBy → sendInvite (3 writes, no transaction). A failure mid-way leaves a user without a linked person or without an invite.
- `UserService.createUser`: save user → save person → re-fetch.
- `AuthService.setupUser`: save user → raw SQL update of `person_id` → re-fetch.

The figures module reportedly snapshots inside a transaction (to be verified below), so the pattern is known — it's just not applied consistently.

**Recommendation:** wrap multi-entity mutations in `dataSource.transaction(...)`.

### 🟡✅ ARCH-3 — Refresh tokens are JWTs whose signature is never verified — FIXED

`rotateRefreshToken` looks the raw string up by SHA-256 hash; it never calls `jwtVerify`. The DB row is the actual source of truth (`expiresAt`, `revokedAt`, `usedAt`). So the JWT signing/payload machinery (and the separate `JWT_REFRESH_SECRET`) adds complexity without adding security — an opaque 256-bit random string would be simpler and smaller. Not a vulnerability (unguessable thanks to the `family` UUID + signature), just accidental complexity that invites the false belief that JWT expiry/signature are being enforced.

**Fix applied:** `TokenService.createRefreshToken` now generates the raw token via `randomBytes(32).toString('hex')` instead of `jwtService.signAsync(...)`. `JwtService`/`JWT_REFRESH_SECRET` are no longer part of `TokenService` at all — the constructor only takes the `RefreshToken` repository now. `JWT_REFRESH_SECRET` was removed from the Joi env schema, `.env.example`, CI, and the living docs that documented it (`README.md`, `CONTEXT.md`, `docs/AUTH_FLOW.md`, `docs/DEPLOY_PRE.md`, `docs/codebase/STACK.md`, `docs/codebase/INTEGRATIONS.md`); dated design-proposal docs under `docs/specs/` were left as historical records. The access token is unaffected — it's still a genuinely stateless, signature-verified JWT (`JWT_SECRET`), which is the case where a JWT is actually doing real work. Covered by an updated `token.service.spec.ts`: asserts the raw token matches `/^[0-9a-f]{64}$/` (32 random bytes, hex), that two calls never produce the same token, and that its hash is what gets stored — the `JwtService` mock and the "throws when `JWT_REFRESH_SECRET` is missing" construction test were removed as they no longer apply.

### 🟡 ARCH-4 — `timestamp` (without time zone) everywhere

All entities use `type: 'timestamp'` (e.g. `refresh-token.entity.ts:36`, `user.entity.ts:36`). Comparisons are done against `new Date()` in JS. This works while app and DB share UTC, but any TZ drift (local dev vs VPS) shifts expiries by hours. Postgres best practice is `timestamptz`.

### 🟡 ARCH-5 — Inconsistent 401 vs 403 in the refresh flow

`POST /auth/refresh` throws `ForbiddenException` (403) when the cookie is missing but `UnauthorizedException` (401) for invalid/expired/reused tokens. Clients must special-case both; pick one (401 is conventional for "re-authenticate").

### 🟡 ARCH-6 — Duplicate soft-delete paths on Person

`softDelete` (204, used by `DELETE /persons/:id`) and `deactivate` (200 + DTO, used by `PATCH /persons/:id/deactivate`) do the same thing with different side effects (`lastSyncedAt`, see BUG-9) — two code paths to maintain for one concept.

### 🟡 ARCH-7 — No graceful shutdown

`main.ts` never calls `app.enableShutdownHooks()`. Under Docker, SIGTERM will kill the process without letting NestJS close the TypeORM pool / in-flight requests — relevant with `restart: unless-stopped` and healthchecks in prod compose.

### 🟠 ARCH-8 — Query patterns that won't scale: cartesian joins and N+1 loops

- `node-assignment.service.ts:574-593` (`getHistory`): one query `leftJoinAndSelect`s `assignments` × `instanceNodes` per instance — a **cartesian product** (an instance with 80 assignments and 100 nodes yields 8 000 joined rows, × 20 instances per page). Same shape in `getEventAssignmentSummary`, which additionally runs it **per segment** in a loop.
- `bulkImport` (`node-assignment.service.ts:748+`): per source assignment it runs 3 conflict queries and then calls `assign()`, which itself re-runs the lock check, instance fetch, person fetch and the same 3 conflict checks plus a reload — ~10 queries × N assignments, i.e. ~1 000 queries to import a full pinya. It is also **not transactional**, so a crash mid-import leaves a half-imported figure.
- `ProjectionService.getProjection` awaits `getInstanceNodes` + `getByInstance` sequentially per instance.
- `AttendanceService.recalculateSummary` loads all attendances (with persons) into memory and filters the array 7 times, instead of one `GROUP BY` query; concurrent attendance writes race on the denormalized `event.attendanceSummary` (last write wins with stale data).

None of this is wrong at ~200 persons/colla scale, but these are the endpoints that will degrade first, and `bulkImport`'s non-atomicity is a correctness issue too.

### 🟡 ARCH-9 — Duplicated business rules

- Conflict rules (node occupied / person in instance / person in segment) implemented twice: in `assign()` and again inline in `bulkImport()`.
- Event-lock logic duplicated between `getLockStatus` and `checkEventLock`.
- Pinya capacity duplicated with diverging formulas (BUG-12).
- `slugify()` in `figure-template.service.ts` exists twice in the same file (`generateSlug` and `slugify`, identical bodies except one `-+` collapse).

### 🟡 ARCH-10 — Migrations registered in two places

`database.module.ts:71-92` hand-maintains an import list of all 20 migrations, while `data-source.ts:13` (used by the CLI and the prod entrypoint) uses a glob. A migration added to the folder but forgotten in the array runs in prod but **not** in dev (`migrationsRun: isDevelopment`) — silent schema drift between environments. Use the glob (or a shared `migrations/index.ts`) in both.

### 🟡 ARCH-11 — Inconsistent delete-protection policy across the event aggregate

`EventService.remove` refuses to delete an event with attendance records (409), but the same event's **segments, figure instances, snapshots and assignments are silently CASCADE-deleted** (`event_segments.eventId → CASCADE → figure_instances → instance_nodes/node_assignments`). Hours of pinya-assignment work can vanish without warning while a single attendance row blocks deletion. Decide one policy (block on any dependent data, or explicit "delete everything" confirmation) and apply it consistently.

---

## 4. Code smells & bad practices

- 🟡 **SM-1** `user.entity.ts:13-14`: `type PersonRef = any` to dodge a circular import. TypeORM ships `Relation<T>` exactly for this; `import type` also breaks the cycle without `any`.
- 🟡 **SM-2** `person.service.ts:153,276`: `findByIds()` is deprecated in TypeORM 0.3 (`findBy({ id: In(...) })`), and silently ignores non-existent IDs — a typo'd position UUID just vanishes instead of erroring.
- 🟡 **SM-3** `auth.service.ts:176-179`: raw SQL `UPDATE users SET person_id = ...` inside an otherwise repository-based service; bypasses entity hooks and `updatedAt`. Also no existence check on `personId` → FK violation → 500.
- 🟡 **SM-4** `main.ts:1-4`: scaffold comment “This is not a production server yet!” on a production API; `const cookieParser = require('cookie-parser')` instead of an ES import.
- 🟡 **SM-5** `user.service.ts:172-181` (`grantRole`) saves then re-fetches the user (2 extra queries); `updateUser` re-fetches too. Minor, but the pattern repeats.
- 🟡 **SM-6** `UserService.createWithInvite` doesn't pre-check email uniqueness → DB unique violation surfaces as 500 instead of 409 (the generic `createUser` *does* check).
- 🔵 **SM-7** `AuthController.login` types `req.user` inline and then casts with `Parameters<typeof this.authService.login>[0]` — noisy; a small `RequestWithUser` interface is clearer.
- 🟠 **SM-8** `figure-template.service.ts:405-411`: hand-rolled `generateUUID()` using `Math.random()`. Node's `crypto.randomUUID()` is already used elsewhere in the codebase (`token.service.ts`); `Math.random` is not collision-safe and this duplicate implementation is strictly worse.
- 🟡 **SM-9** Pervasive `(x as any)` casts to reach `Person` fields (`node-assignment.service.ts:182-187,602,611,720,813` …) — a consequence of `type`-only imports erasing entity types. Fixing the entity typing (TypeORM `Relation<T>`) removes the need for every cast.
- 🟡 **SM-10** `figure-template.service.ts` `handleDbError`: any non-unique-violation DB error becomes a bare 500 "Unexpected database error" **without logging the original error** — undiagnosable in production.
- 🟡 **SM-11** Template editor saves (`update` → `syncNodes` + `syncRengles`) and `saveFromInstance` run multiple dependent writes **without a transaction** — a failure mid-save leaves the template half-updated (nodes updated, deletions skipped, rengles inconsistent).
- 🟡 **SM-12** `available-persons.service.ts:80-89`: manual re-coercion of `isXicalla`/`excludeAssigned` from strings, duplicating (and admitting distrust of) the `@Transform` logic already present in `AvailablePersonsQueryDto`. Dead code — the DTO delivers real booleans.
- 🟡 **SM-13** `EventService.remove` checks attendance count with a separate query instead of relying on FK behavior, while figure data cascades (see ARCH-10) — the protection level is accidental, not designed.
- 🔵 **SM-14** `FigureTemplateService.create` silently renames duplicates (`"Nom 2"`) while `update` throws 409 for the same situation — inconsistent duplicate-name policy between create and edit.
- 🔵 **SM-15** `AttendanceService.update` overwrites `respondedAt` on every edit, including notes-only edits — the "responded" timestamp loses its meaning.

---

## 5. Frontend (dashboard)

The Angular app is in good shape: standalone components + signals + OnPush throughout, **zoneless** (no `zone.js` polyfill — the modern setup, consistently paired with signal-driven CD), no NgRx ceremony, in-memory access token with silent refresh and a shared in-flight refresh observable (`share()`), guards that await `whenReady()`, no `innerHTML`/`bypassSecurityTrust`* anywhere, optimistic updates with snapshot rollback and a real undo/redo stack in the assignment canvas, and consistent use of the shared table/filter components. Findings:

### 🟡 FE-1 — Interceptor scopes by substring and attaches the token to *any* URL

`auth.interceptor.ts:19`: `req.url.includes('/auth/')` — substring matching to skip auth endpoints, and the Bearer header is added to **every other request regardless of host**. Today all calls go to `environment.apiUrl`, but the first integration with an external HTTP API will silently leak access tokens. Scope both checks to `req.url.startsWith(environment.apiUrl)`.

### 🟡 FE-2 — Non-TECHNICAL/ADMIN login loops back to the login page with no message

`app.routes.ts:11` guards the entire app with `rolesGuard(TECHNICAL, ADMIN)`; `rolesGuard` redirects failures to `/login`; `LoginComponent` navigates to `/` on success. A MEMBER user logging into the dashboard therefore authenticates successfully and lands back on the login form with no explanation. Show a "no access" state (and consider that `rolesGuard` redirecting an *authenticated* user to `/login` is the wrong destination in general).

### 🟡 FE-3 — God components in the pinyes feature

`figure-canvas.component.ts` (2 070 lines), `assignment-canvas.component.ts` (1 979 lines + 789-line template), `template-editor.component.ts` (1 073 lines). Some state is already extracted (`AssignmentStateService`, `template-editor-state.service`), but the components still mix Konva scene management, drag logic, API orchestration and UI state. This is where every future bug in the flagship feature will hide. Extracting the Konva layer/node management into plain (testable) classes would pay off quickly.

### 🟡 FE-4 — Route-scoped state in a root singleton

`AssignmentStateService` is `providedIn: 'root'` but holds per-canvas state, relying on components calling `reset()` at the right moments. Any exit path that skips `reset()` (error navigation, deep-link) leaks the previous segment's selections into the next. Providing it at the route/component level gives automatic scoping and disposal.

### 🟠 FE-6 — Rotation handle breaks on touch devices and can leak window listeners

`figure-canvas.component.ts:1148-1188` (`makeRotationHandle`): the handle listens on `'mousedown touchstart'`, immediately sets `slotGroup.draggable(false)`, then registers **only** `window mousemove/mouseup` listeners. On a touch device (`touchstart`) no touch-move/touch-end handlers exist, so `onUp` never fires: the rotation never happens **and the slot stays permanently un-draggable**. The projection/distribution views are exactly the screens most likely to run on a tablet. Additionally, if the component is destroyed mid-rotation, the `window` listeners are never removed (cleanup only happens in `onUp`).

### 🟡 FE-7 — Canvas rendering strategy: full scene rebuild on every state change

Every tracked signal change (`selectedNodeId`, `assignments`, `attendanceMap`, `highlightedNodeIds`…) triggers `pinyaLayer.destroyChildren()` + reconstruction of **all** Konva groups (`renderNodes`/`renderAssignmentNodes`, `figure-canvas.component.ts:751,1218`). Clicking a node rebuilds the whole scene; `emitStageTransform()` additionally calls `renderGrid()` — which destroys and recreates every grid line — **on every mousemove during panning**. Fine at ~100 nodes on desktop, but it's O(n) object churn per interaction and will be the first thing to hurt on weaker hardware (projection screens, tablets). Konva supports targeted updates (`findOne(#id)` + attr changes) — worth it at least for selection highlight and the pan-time grid.

### 🟡 FE-8 — `effect()` dependency omission: badges rendered from untracked signals

The assignment-mode render effect (`figure-canvas.component.ts:303-321`) tracks `nodes/assignments/attendanceMap/…` but `renderAssignmentNodes` also reads `this.personDetailsMap()` and `this.isPast()` **inside `untracked()`**. `personDetailsMap` arrives asynchronously (built from the confirmed-persons load): if persons resolve after the assignments render, the observation badges / notes emojis / hover data are missing until some *other* tracked signal happens to change. Classic stale-render from an unregistered dependency — add them to the tracked reads (`isPast` is set once from the URL, so it's only `personDetailsMap` that bites).

### 🟡 FE-9 — Error-handling of HTTP calls is inconsistent; several subscribes fail silently

There is no global HTTP error interceptor/toast: each of the ~140 `.subscribe()` sites decides for itself. In `assignment-canvas.component.ts` (37 subscribes) the important mutations do roll back optimistic state and toast (`error:` at 1104-1114 is exemplary) — but several loads have **no error callback at all**: `getLockStatus` (l. 361 — if it fails, the lock silently doesn't apply in the UI), `refreshInstanceNodes` (l. 1119, nested subscribe without error), tab loads at 609/625. A failed load leaves spinners/state frozen with no message. A small `handleError` helper (or a global interceptor for non-401s) would make failure behavior uniform.

### 🟡 FE-10 — Nested-subscribe pyramids and hand-rolled Observable wrappers

Same file: sequential flows are built by nesting `.subscribe()` inside `next:` (e.g. `refreshInstanceNodes` l. 1119→1136), and undo/redo actions re-wrap calls as `new Observable((sub) => { obs.subscribe({...}) })` — the pattern repeats 6× (l. 858, 1092, 1251, 1700, 1769, 1818). The wrapper drops unsubscription propagation and is equivalent to `obs.pipe(map(() => void 0))`. `switchMap`/`concatMap` would also give cancellation on rapid tab switching, which today relies on ad-hoc `activeInstanceId() === instanceId` guards.

### 🟡 FE-11 — Route params read once via `snapshot`

`assignment-canvas.component.ts:349-356` (and other routed components) read `route.snapshot.params` in `ngOnInit` and never subscribe to param changes. If the router ever navigates between two segments on the same route (prev/next segment navigation already exists in the projection view), the component instance is reused and keeps rendering the **old** segment. Subscribe to `route.params`/use `input()` route bindings (`withComponentInputBinding`) instead.

### 🔵 FE-12 — Assignment canvas a11y & small correctness notes

- `Tab` is globally hijacked (`preventDefault` on every keydown, l. 409-413) to mean "next empty node" — keyboard users can never reach the toolbar buttons. Consider scoping it to when the canvas has focus.
- Optimistic ids built from `Date.now()` (`temp-${Date.now()}`, `op-${Date.now()}`, l. 1044,1063) collide on fast double actions; `crypto.randomUUID()` is right there (an unused `uuid.util.ts` even exists).
- `getContrastColor` (`figure-canvas.component.ts:2040`) assumes 6-digit hex; a named/`rgb()` color yields `NaN` luminance → always white text.

### 🟠 FE-13 — Template editor: pending autosave is discarded on most exits

`template-editor.component.ts`: edits schedule a **2-second debounced autosave** (`scheduleAutosave`). The flush-before-leave logic exists only in `goBack()` (cancel timer → `save(() => navigate)`). Every other exit path — browser back, sidebar navigation, deep link, logout — goes through `ngOnDestroy`, which just `clearTimeout`s the pending save: **the last ~2 s of edits are silently lost**. There is also no `canDeactivate` guard and no `beforeunload` listener for tab-close while a save is pending or in flight. Flush in `ngOnDestroy` too (or a `CanDeactivate` guard + `beforeunload` when `saveStatus() !== 'idle'`).

### 🟡 FE-14 — Pagination `@for` uses a duplicated track key

`pagination.component.ts:41,92-98`: `pageNumbers()` inserts the ellipsis sentinel `-1` **twice** (before and after the current window, e.g. page 5 of 10 → `[1, -1, 4, 5, 6, -1, 10]`), but the template iterates with `track p`. Duplicate track keys make Angular throw **NG0955** and fall back to degraded list reconciliation on exactly the pages where both ellipses show. Use `track $index` here (or unique sentinels).

### 🟡 FE-15 — Person search: debounce without cancellation → stale results race

`person-search-input.component.ts:37-59`: the 300 ms `setTimeout` debounce dedupes typing bursts, but once two requests are actually in flight (keystrokes >300 ms apart on a slow network) nothing cancels the first — an out-of-order response overwrites the newer results. The idiomatic fix (`Subject` + `debounceTime` + `switchMap`) removes both the manual timer and the race. Also `searchText` is a plain mutable field in an otherwise signal-based zoneless component — it works (event-driven CD) but breaks the house style.

### 🔵 FE-16 — Two parallel undo/redo implementations in the same feature

The assignment canvas uses the command-based `UndoRedoService` (execute/undo observables), while the template editor ships its own snapshot-based stack (`undoStack: signal<TemplateSnapshot[]>`, `template-editor.component.ts:140-152`). Two mental models, two sets of edge cases, one feature. Note also `UndoRedoService.run()` sets `isBusy` **eagerly** but returns a cold observable — if a caller ever forgets to subscribe, the action is popped off the stack, never executed, and `isBusy` stays `true`.

### 🔵 FE-17 — Misc

- `person-sync.component.ts:67`: `JSON.parse(event.data)` in the SSE handler without try/catch — one malformed event kills the stream handler.
- `person-sync.component.ts:126`, `event-sync.component.ts:133`: `window.location.reload()` to refresh data after sync — a full app reload in an SPA; re-fetching the affected stores achieves the same without losing state.
- 39 `setTimeout(...)` calls (mostly scroll/focus nudges) and 9 stray `console.`* calls in production code.
- 143 `.subscribe(` vs 19 `takeUntilDestroyed` — most are one-shot HTTP calls (fine), but the long-lived ones (polling, `interval`, router events) deserve an audit pass.

---

## 6. Dependencies & tooling

- 🔴 **DEP-1** `xlsx@^0.18.5` — see SEC-2.
- 🟡 **DEP-2** `reflect-metadata@^0.1.14` — NestJS 11 supports `^0.2.x`; 0.1 is the legacy line.
- 🟡 **DEP-3** `@types/node: 20.19.9` pinned to Node 20 API surface while `engines` demands Node ≥22.13 — type definitions don't match the runtime.
- 🔵 **DEP-4** CI is well designed (Nx affected on PRs, frozen lockfile, cache), which makes the Dockerfile's `--no-lockfile` (SEC-14) the odd one out.

---

## 7. Tests

*(both suites were executed for this audit — numbers below are measured, not estimated)*

**Measured coverage (2026-07-05):**


| Suite              | Tests                   | Statements | Branches | Functions | Lines  | Enforced threshold | Documented |
| ------------------ | ----------------------- | ---------- | -------- | --------- | ------ | ------------------ | ---------- |
| API (Jest)         | 542, all pass           | 66.8 %     | 68.1 %   | 69.4 %    | 67.4 % | **55/50/55/55**    | "70 %"     |
| Dashboard (Vitest) | 53 spec files, all pass | 53.2 %     | 57.0 %   | 49.0 %    | 57.3 % | **40/35/40/40**    | "70 %"     |


The CLAUDE.md claim "Coverage threshold: 70 % (enforced in CI)" is wrong on both counts (see §8). The API threshold sits 12 points below actual coverage, so coverage can erode silently for a long time before CI complains.

**What's genuinely good:**

- The API's domain core is well tested: event-segment **89.7 %**, composition **90.6 %**, figure **86.9 %**, node-assignment **84.7 %** statements — services, controllers, sync strategies, even DTO-validation specs.
- Dashboard spec quality in the pinyes feature is high: `assignment-canvas.component.spec.ts` (1 350 lines) and `tronc-view.component.spec.ts` (1 163 lines) use proper TestBed setups with typed stub child components via `overrideComponent`, exercising real behavior. `figure-canvas.component.ts` reaches **98.9 %** without a spec of its own because the editor/composition/distribution specs render the **real Konva canvas** as a child.
- Frontend auth guards *are* tested (`auth.guard.spec`, `role.guard.spec`) — unlike their backend counterparts.

**Gaps (ordered by risk):**

- 🟠✅ **TEST-1** — **FIXED.** Backend `auth/guards` and `auth/strategies` are at **0 %** — `JwtAuthGuard` (the `@Public()` bypass), `RolesGuard`, `JwtStrategy` (including the `?token=` extractor, SEC-4) and `LocalStrategy` have no tests at all. These four files are the entire authorization enforcement layer. Same for `AuthController`/`UserController` (auth module overall: 57 %) — a trivial controller test would have caught BUG-1 (the dead `grant-role` route).
**Fix applied:** added `jwt-auth.guard.spec.ts` (Public bypass + Passport delegation), `roles.guard.spec.ts` (no-roles/empty-roles/no-user/role-match/role-mismatch), `local.strategy.spec.ts` (valid/invalid credentials), `auth.controller.spec.ts` (all 7 routes: login, refresh, logout, logout-all, getMe, acceptInvite, setupUser incl. the SETUP_TOKEN gate), and `user.controller.spec.ts` (all 6 routes). `JwtStrategy` was already covered as part of SEC-1. Guards, strategies and both controllers are now at 100% statement coverage. Note: these are unit tests calling controller methods directly, so they do **not** exercise NestJS's route-path parameter binding — they wouldn't have caught BUG-1 (the dead `grant-role` route needed `:id` in the path). BUG-1 has since been fixed separately, with its own route-metadata assertion added to `user.controller.spec.ts` (see above) rather than a full HTTP-level/e2e test (still tracked under TEST-2/TEST-6).
- 🟠 **TEST-2** Everything is unit-tested against mocked repositories; there are **no integration tests against a real Postgres**. The bugs found in this audit that unit tests structurally *cannot* catch are precisely the SQL/transaction ones (BUG-3 invalid ORDER BY path, BUG-11 cross-connection MAX inside a transaction, BUG-12 diverging capacity SQL, BUG-17 snapshot race). A small testcontainers-style suite for the raw-SQL services would close this class.
- 🟠 **TEST-3** Dashboard coverage is bimodal: next to the 90 %+ pinyes core sit near-zero areas — `event-detail.component.ts` **5.9 %** (its spec cleverly tests only pure helpers via `Object.create(prototype)`, never the component behavior), `template-editor.component.ts` **28.9 %**, `projection-view.component.ts` **40.9 %**, and every modal at 0-11 % (`user-form-modal` 4.3 %, `attendance-edit-modal` 5.4 %, `save-as-template-dialog` 2.5 %, `already-assigned-dialog` 5.7 %). The **user-form-modal** is where roles are assigned in the UI.
- 🟡 **TEST-4** `projection-layout.util.ts` — 523 lines of pure layout math, the ideal unit-test target — is at **27 %** (lines 129-438 untouched). Likewise the trivially testable `date.util`, `uuid.util`, `slugify.util` and `fit-to-bounds.util` are at **0 %**.
- 🟡 **TEST-5** The shared component kit that every list page relies on is half-tested: `data-table` 51 %, `pagination` 44 % (page-navigation logic in l. 32-60 uncovered), `person-search-input` **8.6 %**, `user-chip` 23 %, toast component 47 %. There is also no spec for `authInterceptor` (the 401-refresh-retry flow) or `ApiService`.
- 🟡 **TEST-6** Playwright e2e projects exist (`dashboard-e2e`) but are excluded from CI and `ci:local` — dead scaffolding until wired up. With zero e2e, nothing ever exercises frontend + API + Postgres together (TEST-2's gap squared).
- 🔵 **TEST-7** API `collectCoverageFrom` includes `src/migrations/`** (0 %, pure DDL) — it dilutes the global number by several points and makes the 55 % gate softer than it looks for actual application code. Exclude migrations (and consider raising the gate to match the real ~72-75 % that the app code likely has).
- 🔵 **TEST-8** Most big `.html` templates report 0 % (e.g. `assignment-canvas.component.html`, 789 lines, despite its 1 350-line spec rendering the component). Template-level regressions (bindings, `@if`/`@for` branches) are effectively unmeasured — worth checking whether the `@angular/build:unit-test` coverage mapping is attributing template code correctly.

---

## 8. Documentation drift

`CLAUDE.md` (the agent/developer entry point) no longer matches the tree:

- It documents a `reference-element` module, a `ReferenceElement` entity and related endpoints — the feature was **removed**; migration `1781000000000` now *drops* the `reference_elements` table, and no such module exists under `apps/api/src/modules/`.
- It says work happens on branch `story/deploy-server-pre` (P5.8.1 section) — stale.
- It documents `nx run api:seed-seasons`, but no `seed-seasons` target exists in `apps/api/project.json` (only `reset-figure-data` and `migrate-tronc-units`).
- It claims "Coverage threshold: 70 % (enforced in CI via `--configuration=ci`)" — the actual enforced thresholds are **55/50/55/55** (API, `jest.config.ts`) and **40/35/40/40** (dashboard, `vitest.config.ts`), and neither suite currently reaches 70 %.
- `main.ts` still opens with the scaffold comment "This is not a production server yet!" while the repo ships production Docker stacks.

Stale docs are worse than no docs for both humans and coding agents — worth a 15-minute sweep.