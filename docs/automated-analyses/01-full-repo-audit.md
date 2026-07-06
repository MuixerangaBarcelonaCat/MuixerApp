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


| Section                   | 🔴          | 🟠            | 🟡                 | 🔵           | Total              |
| ------------------------- | ----------- | ------------- | ------------------ | ------------ | ------------------ |
| 1. Security               | 2 (2 ✅)     | 11 (10 ✅)     | 4 (1 ✅, 1 🚫)       | 1 (1 ✅)      | 18 (14 ✅, 1 🚫)     |
| 2. Bugs & correctness     | 2 (2 ✅)     | 9 (7 ✅)       | 10 (5 ✅)           | 1            | 22 (14 ✅)          |
| 3. Architecture           | —           | 3 (2 ✅)       | 8 (2 ✅)            | —            | 11 (4 ✅)           |
| 4. Code smells            | —           | 1 (1 ✅)       | 11 (3 ✅)           | 3            | 15 (4 ✅)           |
| 5. Frontend (dashboard)   | —           | 2             | 11                  | 3            | 16                 |
| 6. Dependencies & tooling | 1 (1 ✅)     | —             | 2 (2 ✅)            | 1 (1 ✅)      | 4 (4 ✅)            |
| 7. Tests                  | —           | 3 (1 ✅)       | 3                   | 2            | 8 (1 ✅)            |
| **Total**                 | **5 (5 ✅)** | **29 (21 ✅)** | **49 (13 ✅, 1 🚫)** | **11 (2 ✅)** | **94 (41 ✅, 1 🚫)** |


*(✅ counts reflect fixes applied so far in this branch; 🚫 marks findings deliberately closed as won't-fix, with reasoning inline; both are updated as findings are resolved.)*

**Fix first — ranked across every section, not just by original discovery order:**


| #   | Finding                                                                                                                                                                                                       | Where                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | 🔴✅ [SEC-1](#-sec-1--hardcoded-fallback-jwt-secrets-change-me--fixed) Fallback JWT secret `'change-me'` — silent full-auth bypass if the env var is ever missing — **FIXED**                                  | `auth.module.ts`, `jwt.strategy.ts` |
| 2   | 🔴✅ [BUG-1](#-bug-1--patch-usersgrant-role-can-never-work-missing-id-in-route--fixed) `PATCH /users/grant-role` endpoint can never work (route bug) — **FIXED**                                               | `user.controller.ts:62`             |
| 3   | 🔴✅ [BUG-2](#-bug-2--promoting-a-provisional-person-always-fails--fixed) Provisional-person promotion always fails (`managedBy` never loaded) — **FIXED**                                                     | `person.service.ts:250`             |
| 4   | 🔴✅ [SEC-2](#-sec-2--xlsx-sheetjs-0185-with-known-cves-used-to-parse-external-data--fixed) `xlsx` 0.18.5 with known CVEs, used to parse external data — **FIXED**                                             | `legacy-api.client.ts`              |
| 5   | 🟠✅ [SEC-7](#-sec-7--technical-users-can-modify-and-deactivate-admin-accounts--fixed) TECHNICAL users can deactivate/edit ADMIN accounts — **FIXED**                                                          | `user.service.ts`                   |
| 6   | 🟠✅ [SEC-14](#-sec-14--production-image-installs-unpinned-dependencies--fixed) Prod Docker image installs unpinned deps (`--no-lockfile`) — **FIXED**                                                         | `apps/api/Dockerfile`               |
| 7   | 🟠✅ [TEST-1](#7-tests) Backend auth guards & strategies at **0% coverage** — the entire authz enforcement layer is untested — **FIXED**                                                                       | `auth/guards`, `auth/strategies`    |
| 8   | 🟠✅ [SEC-8](#-sec-8--no-trust-proxy--per-ip-throttling-is-broken-behind-the-reverse-proxy--fixed) Missing `trust proxy` → rate limiting shared by all users behind Caddy — **FIXED**                          | `main.ts`                           |
| 9   | 🟠✅ [BUG-19](#-bug-19--deactivatemissingpersons-trusts-the-legacy-fetch-blindly--fixed) Sync can mass-deactivate the census on a partial legacy response — **FIXED**                                          | `person-sync.strategy.ts`           |
| 10  | 🟠✅ [SEC-3](#-sec-3--setup-endpoint-non-constant-time-token-comparison-unlimited-use--fixed) Setup endpoint mints ADMIN accounts forever while `SETUP_TOKEN` is set — **FIXED**                               | `auth.controller.ts`                |
| 11  | 🟠✅ [BUG-17](#-bug-17--lazy-snapshot-has-a-check-then-act-race-duplicate-instance-nodes--fixed) Lazy-snapshot race duplicates instance nodes under concurrent first-assignment — **FIXED**                   | `node-assignment.service.ts:340`    |
| 12  | 🟠✅ [BUG-11](#-bug-11--applycomposition-sortorder-computed-outside-the-transaction--duplicated-orders--fixed) `applyComposition` gives every figure the same `sortOrder` (cross-connection read inside a transaction) — **FIXED** | `figure-instance.service.ts`        |
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

### 🔴✅ SEC-2 — `xlsx` (SheetJS) 0.18.5 with known CVEs, used to parse external data — FIXED

`package.json` pinned `"xlsx": "^0.18.5"`. The npm-published package has been abandoned since 2022 and has unfixed vulnerabilities on npm:

- **CVE-2023-30533** — Prototype pollution when parsing crafted files.
- **CVE-2024-22363** — ReDoS.

It was used to parse data downloaded from the legacy server (`apps/api/src/modules/sync/legacy-api.client.ts:3`), i.e. external input. Fixed versions (≥0.19.3 / ≥0.20.2) are only distributed via `https://cdn.sheetjs.com`, which has its own downsides (not on the npm registry, so it bypasses `npm audit`/Dependabot/Renovate tracking, requires a hardcoded tarball URL, and depends on a third-party CDN's uptime for every install).

**Fix applied:** replaced `xlsx` with the actively-maintained `exceljs` (npm registry) in `legacy-api.client.ts`'s `getAssistenciesXlsx`. The `xlsx` dependency was removed from `package.json`. Covered by a new characterization test in `legacy-api.client.spec.ts` that builds a real xlsx buffer and asserts the parsed attendance rows, verified green against the old implementation before the migration and again after.

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

### 🟠✅ SEC-6 — Invite tokens: stored in plaintext and printed to logs — PARTIALLY FIXED (storage)

- ✅ `user.entity.ts:33` — `inviteToken` is stored as-is; `AuthService.acceptInvite` looks it up by plaintext equality. Refresh tokens are correctly stored as SHA-256 hashes, invite tokens are not. A DB dump/backup leak allows takeover of every pending account. (Same will apply to `resetToken` when implemented.)
- `user.service.ts:165-170` — `sendInvitationEmail` is a stub that `console.log`s the email + invite token, so live tokens land in server logs. **Deliberately left as-is** — see note below.

**Recommendation:** store `sha256(inviteToken)`, look up by hash; never log the token (log the user id instead).

**Fix applied (storage only):** added a shared `hashToken()` util (`common/utils/hash-token.util.ts`, SHA-256 hex digest, mirroring `TokenService`'s existing private `hash()` for refresh tokens). `UserService.sendInvite` now stores `hashToken(inviteToken)` in the `inviteToken` column instead of the raw value; `AuthService.acceptInvite` now looks it up via `where: { inviteToken: hashToken(dto.token) } }` instead of plaintext equality. A DB dump no longer yields usable invite tokens. Covered by new specs in `hash-token.util.spec.ts`, `user.service.spec.ts` (asserts the stored value is the hash, not the raw token handed to the email step), and `auth.service.spec.ts` (asserts the lookup uses the hash).

**Logging — explicitly not fixed, per product decision:** the recommendation to stop logging the raw token was **not** applied. `sendInvitationEmail` is a stub standing in for a real mailer that doesn't exist yet (`// TODO implement`); until it's built, the `console.log` line is the only way to retrieve a usable invite link in development/staging. It still prints the raw token, now with a comment flagging it must be removed once real email sending ships. This is a conscious, temporary exception — the token no longer touches the database in plaintext (the part that mattered for a DB-leak scenario), only ephemeral server logs during this bootstrapping period.

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

### 🟠✅ SEC-8 — No `trust proxy` ⇒ per-IP throttling is broken behind the reverse proxy — FIXED

Production runs behind Caddy (`docker-compose.pre.yml` / prod), but `main.ts` never sets Express `trust proxy`. `@nestjs/throttler` keys on `req.ip`, which will always be the proxy's IP:

- All users share one 100 req/min bucket → self-inflicted DoS as soon as a few people use the dashboard simultaneously.
- The stricter 10 req/min limit on `/auth/`* is shared by the whole colla, and an attacker brute-forcing login throttles *everyone* while their own attempts blend into the shared bucket (no per-attacker limit).

**Recommendation:** `app.set('trust proxy', 1)` (via `app.getHttpAdapter().getInstance()`), make sure Caddy sets `X-Forwarded-For`, and verify the throttler sees real client IPs.

**Fix applied:** added `configureTrustProxy(app)` (`apps/api/src/common/utils/configure-trust-proxy.util.ts`), called from `bootstrap()` in `main.ts` right after the Nest app is created. It sets `trust proxy: 1` on the underlying Express instance, so `req.ip` (and therefore `ThrottlerGuard`) resolves the real client IP from `X-Forwarded-For` set by Caddy instead of Caddy's own address. Covered by `configure-trust-proxy.util.spec.ts`, which boots a real Nest/Express app and asserts `req.ip` matches a spoofed `X-Forwarded-For` header once `configureTrustProxy` runs — a real end-to-end check of the Express setting rather than a mock. Note this only trusts a *single* hop; that was only safe once [SEC-9](#-sec-9--pre-production-compose-publishes-postgresql-and-the-api-to-the-host-fixed) bound the API's port to loopback, since a client that could reach the API directly (bypassing Caddy on a publicly exposed `3000:3000`) would otherwise be able to spoof its own `X-Forwarded-For`.

### 🟠✅ SEC-9 — Pre-production compose publishes PostgreSQL (and the API) to the host — FIXED

`docker-compose.pre.yml`:

```yaml
postgres:
  ports:
    - '5432:5432'
```

On a VPS this exposes Postgres to the Internet unless an external firewall intervenes — and Docker's iptables rules famously bypass UFW. The API is also published directly on `3000:3000` even though Caddy is the intended entrypoint. The prod compose gets it right for Postgres (no ports) but still publishes the API on `3000:3000`.

**Recommendation:** remove the `ports` mapping for postgres in pre (containers reach it over the internal network), or bind to loopback (`127.0.0.1:5432:5432`); same for the API unless it must be reachable without Caddy.

**Fix applied:** debugging access to both ports is still needed, so instead of removing the mappings entirely, `docker-compose.pre.yml` now binds them to loopback only — `127.0.0.1:5432:5432` and `127.0.0.1:3000:3000` — and `docker-compose.prod.yml`'s API port gets the same treatment (`127.0.0.1:3000:3000`; Postgres there already had no `ports` mapping). Docker still won't punch a hole through UFW for these, but they stay reachable via `psql -h 127.0.0.1` / `curl localhost:3000` on the host itself, or over an SSH tunnel from a workstation. `dashboard`'s `80`/`443` mappings are left as-is since Caddy is meant to be the public entrypoint.

### 🟡🚫 SEC-10 — Swagger UI exposed in production — WON'T FIX

`main.ts` sets up Swagger unconditionally at `/api/docs`. `SwaggerModule` serves its UI/JSON outside the global guards, so the full API surface (routes, DTOs, roles) is publicly readable in prod — useful recon material.

**Recommendation:** gate it behind `NODE_ENV !== 'production'` (or basic auth).

**Won't fix — reasoning:** this project is open source, so the route surface, DTOs and role requirements are already fully readable in the repo itself; gating Swagger doesn't remove that information, it only makes a determined reader clone the repo instead of opening a URL. The one thing a live Swagger UI adds beyond public source is convenience for *low-effort* recon: automated scanners specifically probe for `/api/docs`/`/swagger-json` on public IPs, and it ships a ready-made "try it out" client, both of which a repo checkout doesn't hand you as directly. Also note pre already leaves it exposed regardless (SEC-18 is about pre being an accessible-by-IP, real-user-data environment), so gating only prod wouldn't close that path. Given the real vulnerability surface is behind auth either way (all routes are `JwtAuthGuard`-protected by default), the residual risk here is bot-tier recon convenience, not exploitable exposure — not worth the added `NODE_ENV` branching in `main.ts` for this project's threat model. Revisit if the API ever handles more sensitive data or the source stops being public.

### 🟡 SEC-11 — No security headers (`helmet`)

No `helmet` (or equivalent) in `main.ts`. The API mostly serves JSON, but Swagger UI is HTML, and default headers (`X-Content-Type-Options`, `Strict-Transport-Security` if TLS terminates at Caddy but is misconfigured, etc.) are cheap defense-in-depth.

### 🟡✅ SEC-12 — Deactivating a user does not revoke their sessions — FIXED

`UserService.deactivateUser` only flips `isActive`. Existing refresh tokens are *effectively* dead (refresh re-checks `isActive`) but the current **access token stays valid until expiry** (default 15 min) since `JwtStrategy.validate` never touches the DB. Combined with SEC-7 this window matters.

**Recommendation:** call `tokenService.revokeAllUserTokens(userId)` on deactivation; optionally check `isActive` in the JWT strategy for sensitive endpoints.

**Fix applied:** `UserService` now injects `TokenService` (exported from `AuthModule`, which `UserModule` now imports — no circular dependency, since `AuthModule` reaches `User`/`Person` directly via `TypeOrmModule.forFeature`, not via `UserModule`) and calls `tokenService.revokeAllUserTokens(userId)` after flipping `isActive` to `false` — in **both** places that can deactivate an account: `deactivateUser` and `updateUser` (`dto.isActive === false`), since the generic `PATCH /users/:id` can deactivate a user too and would otherwise have left the same gap open. This still doesn't touch the *current* access token (unchanged from the finding — that requires the JWT strategy to hit the DB, a bigger tradeoff not undertaken here), but it closes the refresh-token side immediately instead of relying on the next refresh call to notice `isActive: false`. Covered by new specs in `user.service.spec.ts` asserting `revokeAllUserTokens` is called with the target `userId` on both paths, and that `updateUser` does *not* call it when `isActive` isn't part of the update.

### 🔵✅ SEC-13 — User enumeration via login timing — FIXED

`AuthService.validateUser` only runs `bcrypt.compare` when the email exists — a measurable timing difference. Classic mitigation: compare against a dummy hash when the user is not found. Low priority given throttling.

**Fix applied:** added a `dummyPasswordHash` (bcrypt hash of a fixed string, same `BCRYPT_ROUNDS` cost as real password hashes) computed once per `AuthService` instance. `validateUser` now always calls `bcrypt.compare` exactly once — against `user?.passwordHash ?? dummyPasswordHash` — before checking existence/`isActive`/validity, so the (deliberately slow) bcrypt call always runs regardless of whether the email is registered. Covered by a new test asserting `bcrypt.compare` is still invoked when `userRepo.findOne` resolves `null`.

### 🟠✅ SEC-14 — Production image installs unpinned dependencies — FIXED

`apps/api/Dockerfile:29-30`:

```dockerfile
RUN pnpm install --prod --no-lockfile && \
    pnpm add pg tslib bcrypt typeorm dotenv --no-lockfile
```

The final image explicitly bypasses `pnpm-lock.yaml`, so every build resolves **whatever the latest matching versions are that day** — the production `typeorm`/`pg`/`bcrypt` can differ from what CI tested, and a compromised or broken upstream release lands straight in prod. Generate the dist `package.json` with exact pinned versions (or copy the workspace lockfile and use `--frozen-lockfile`).

**Fix applied:** Nx's `generatePackageJson` (webpack `NxAppWebpackPlugin`) already pins every statically-imported dependency to its exact resolved version in `dist/apps/api/package.json` — the only reason the Dockerfile fell back to an unpinned `pnpm add` was that `pg` is required dynamically by typeorm (driver lookup by the `type: 'postgres'` string), so Nx's static scan never saw it and never pinned it. Added `import 'pg'` in `database.module.ts` so Nx's dependency scan picks it up like every other package, with the exact version resolved from the workspace lockfile (verified: `pg@8.20.0`, matching `pnpm-lock.yaml`). The Dockerfile's stage 3 now reduces to a single deterministic `pnpm install --prod` — no lockfile needed since every dependency in the generated `package.json` is an exact pin, not a semver range. Verified by building the actual production image end-to-end and confirming the installed `typeorm`/`pg` versions match the workspace lockfile exactly, and that the app boots and attempts a real Postgres connection (no missing-module errors).

### 🟡 SEC-15 — `rejectUnauthorized: false` for SSL DB connections

`database.module.ts:50` and `data-source.ts:11`: when `DB_SSL=true` (managed Postgres), TLS is used **without certificate validation** — the connection is encrypted but MITM-able. Supply the provider CA (`ssl: { ca }`) or at least make this an explicit, documented exception.

### 🟠✅ SEC-16 — Sync endpoints: state-changing GETs, no concurrency guard — FIXED

`sync.controller.ts` — `GET /sync/persons|events|all` are **GET requests with heavy side effects** (bulk upserts + mass deactivation). Because they're SSE they also authenticate via `?token=` (SEC-4), so the URL that triggers a full data-mutation lands in access logs. There is **no lock**: two admins (or a reconnecting EventSource — browsers auto-reconnect SSE by re-issuing the GET!) run the same sync concurrently, racing alias-uniqueness checks and upserts. An in-process mutex (or advisory lock) that rejects a second concurrent sync would remove the whole class.

**Fix applied:** new `SyncLockService` — a simple in-process mutex (`tryAcquire()`/`release()`) — shared by all four `/sync` endpoints via a `runLocked()` wrapper in `SyncController`. If a sync is already running, the second call gets an immediate `{ type: 'error', message: 'Ja hi ha una sincronització en curs' }` SSE event and completes without touching any strategy; the lock is released via RxJS `finalize()` so it's freed whether the stream completes, errors, or is unsubscribed (e.g. the client navigating away). This covers `/sync/persons`, `/sync/events`, `/sync/events/:eventId/attendance`, and `/sync/all` uniformly, including cross-endpoint races (e.g. `/sync/all` no longer able to start while `/sync/persons` is running) that the previous per-strategy `isSyncing` flags didn't catch. Covered by `sync-lock.service.spec.ts` and new `sync.controller.spec.ts` tests asserting the second concurrent call is rejected without invoking the strategy, that the lock is released on completion, and that the lock is shared across different endpoints.

### 🟠✅ SEC-17 — Assignment lock (`ASSIGNMENT_LOCK_DAYS`) is bypassable — FIXED

The lock (`checkEventLock`) protects `assign`, `swap`, `unassign`, `resetSnapshot`, `bulkImport` and the ad-hoc node CRUD in `node-assignment.service.ts`. But other mutations of locked data skip it:

- `FigureInstanceService.update` (`figure-instance.service.ts:114-135`): changing `figureMode` to `REMAT`/`NETA` **deletes pinya assignments** with no lock check — a destructive bypass of the lock.
- `NodeAssignmentService.updateCordons` (`node-assignment.service.ts:957`) — mutates locked instances.
- `FigureInstanceService.remove` — deleting a whole instance (cascades all its assignments) is not lock-checked either.

If the lock is meant to freeze historical events (it throws `ForbiddenException`, so it is an access-control rule), it must cover every mutation path of instance/assignment data for that event.

**Fix applied:** `NodeAssignmentService.checkEventLock` was made public (previously `private`) so it can be reused instead of re-implemented, and is now also called from `NodeAssignmentService.updateCordons` (before touching `numberOfCordons`) and from `FigureInstanceService.update`/`remove` — `FigureInstanceService` gets `NodeAssignmentService` injected (already available via `NodeAssignmentModule`, imported by `EventSegmentModule`, with no circular dependency). In `update()`, the check runs whenever `figureMode` is provided at all (not just for `REMAT`/`NETA`), before any mutation; in `remove()`, it runs before the instance (and its cascaded assignments) is deleted. Plain metadata edits (label/sortOrder with no `figureMode` change) are intentionally left unlocked, since they don't touch assignment data. Covered by new specs in `node-assignment.service.spec.ts` (`updateCordons` throws `ForbiddenException` and never saves when locked) and `figure-instance.service.spec.ts` (`update`/`remove` throw and perform no deletion/removal when locked; a plain label update does not trigger the lock check at all).

### 🟠✅ SEC-18 — Pre-production runs over plain HTTP with session cookies — FIXED

`apps/dashboard/Caddyfile` listens on `:80` only ("HTTP accessible per IP"), and the API's cookie code has an escape hatch for exactly this (`COOKIE_SECURE=false` in `auth.controller.ts:53`). The result on a public VPS: login credentials, bearer tokens and the refresh cookie travel **in cleartext**. Caddy makes HTTPS nearly free (the Caddyfile comment even explains how) — pre environments with real user data deserve it. Note also the dashboard `Dockerfile` hardcodes `--configuration=pre`, so the same image can't serve the prod build (`docker-compose.prod.yml` currently ships no dashboard service at all).

**Fix applied:** `pre.muixerapp.cat` DNS isn't pointed at the pre server yet, so hardcoding the domain into the Caddyfile now would have broken the currently-working HTTP-by-IP setup (Caddy would attempt real ACME issuance against a domain that doesn't resolve). Instead, `apps/dashboard/Caddyfile:4` now reads the site address from a `SITE_ADDRESS` env var with a `:80` default (`{$SITE_ADDRESS::80}`), and `docker-compose.pre.yml`'s `dashboard` service now loads `env_file: .env.pre` (previously it got no env vars at all) so that var reaches the container. HTTPS activation is now a one-line env change on the server — no code/image change — once DNS is live: set `SITE_ADDRESS=pre.muixerapp.cat` and `COOKIE_SECURE=true` in `.env.pre`, redeploy the `dashboard` service, restart the `api` service. `docs/DEPLOY_PRE.md` (variable reference table + "Habilitar HTTPS" section) was updated to match this new procedure. Verified with `caddy validate` in both the default (`:80`, no auto-HTTPS) and `SITE_ADDRESS` set (auto HTTP→HTTPS redirect + cert provisioning enabled) cases. The dashboard `Dockerfile`/`docker-compose.prod.yml` gap noted above is a separate deployment issue, not addressed here.

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

### 🔴✅ BUG-2 — Promoting a provisional person always fails — FIXED

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

**Fix applied:** `PersonService.update`'s initial `findOne` now includes `'managedBy'` in `relations`, so an already-linked manager is visible to the promotion check. The `managedById` handling block (resolve the `User`, throw `NotFoundException` if missing, assign or clear `person.managedBy`) was moved from after the `isProvisional` block to *before* it, so a `managedById` supplied in the same promotion request is applied to `person.managedBy` before the `!person.managedBy` check runs — a person can now be promoted and given a manager in one call. Covered by two new specs in `person.service.spec.ts`: one asserting `findOne` is called with `relations: ['positions', 'mentor', 'managedBy']`, another asserting promotion succeeds when `managedById` is passed for a person with no prior manager. Full `nx test api` suite (636/636) and `nx lint api` pass.

### 🟠✅ BUG-3 — Sorting users by `alias` generates invalid SQL — FIXED

`user-sort.constants.ts:14` maps `alias → 'user.person.alias'`, but the query in `UserService.findAll` joins the relation under the alias `person`. TypeORM will not resolve the three-segment path `user.person.alias`; it passes it through to SQL where Postgres reads it as `schema.table.column` and errors (500) on `GET /users?sortBy=alias`.

**Fix:** map it to `'person.alias'` (the join alias). The `Partial<Record<...>>` type of the map also silently tolerates missing keys — a plain `Record` would catch this at compile time.

**Fix applied:** `user-sort.constants.ts:14` now maps `alias → 'person.alias'`, matching the join alias used in `UserService.findAll`'s `leftJoinAndSelect('user.person', 'person')`. Also tightened `USER_SORT_COLUMN_MAP`'s type from `Partial<Record<UserSortByField, string>>` to `Record<UserSortByField, string>`, so a future missing/mistyped sort key fails at compile time instead of silently falling through to the default sort. Covered by a new spec in `user.service.spec.ts` asserting `orderBy` is called with `'person.alias'` (not the invalid three-segment path) when sorting by alias. Full suite: 620/620 passing, lint clean.

### 🟠✅ BUG-4 — `sendInvite`: floating promise + `throw` inside `.catch` — FIXED

`user.service.ts:160-163`:

```ts
this.sendInvitationEmail(user.email, inviteToken).catch((err) => {
  throw new BadRequestException('Failed to send invite email');
});
```

The promise is not awaited, and throwing inside `.catch` of a floating promise produces an **unhandled promise rejection** (process-fatal in Node by default) instead of a 400 — the HTTP response has typically already been sent. Today the stub can't reject, but the moment a real mailer lands here this becomes a crash vector.

**Fix:** `await` it (and decide whether a mail failure should roll back the invite fields).

**Fix applied:** added `await` in front of the `sendInvitationEmail(...).catch(...)` chain (`user.service.ts:160`) — the only change requested, no rollback of invite fields added. The rejection now propagates as a normal `BadRequestException` through `sendInvite`'s `async` call stack instead of becoming an unhandled rejection. Verified with a new spec that mocks `sendInvitationEmail` to reject and asserts `sendInvite(...)` itself rejects with `BadRequestException` — before the fix this test crashed the Jest worker process with an uncaught `BadRequestException` (the exact failure mode the finding described), confirming the bug was real.

### 🟠✅ BUG-5 — Refresh cookie TTL derived from role instead of the token's stored `clientType` — FIXED

`auth.controller.ts:99-103`: on refresh, the cookie max-age is chosen by `role === 'MEMBER' ? PWA : DASHBOARD`. But `clientType` is already persisted on the `RefreshToken` row (and embedded in the JWT payload). A TECHNICAL/ADMIN user logged in from the PWA gets a token valid 7 days in the DB but a cookie that dies after 8 h (and vice versa) — silent forced logouts / TTL mismatch.

**Fix:** return `clientType` from `TokenService.rotateRefreshToken` (it reads the stored row anyway) and use that.

**Fix applied:** `TokenService.rotateRefreshToken` now returns the stored `clientType` alongside `newRawToken`/`userId`. `AuthService.refresh` threads it through instead of re-deriving anything from role. `AuthController.refresh` now sets the cookie from that returned `clientType` directly — the `role === 'MEMBER' ? PWA : DASHBOARD` guess is gone entirely.

**Scope addition (per explicit request):** while fixing this, also added a role gate on **login** (not just refresh): `AuthService.login` now rejects with `UnauthorizedException` when `clientType === DASHBOARD` and the user's role isn't `ADMIN`/`TECHNICAL` — MEMBER accounts can only ever authenticate via the PWA client. This closes the gap BUG-5 was symptomatic of: previously nothing stopped a MEMBER from requesting a `DASHBOARD` session at login, which is exactly the divergence (role implies one clientType, the stored token says another) that made the old role-guessing logic wrong in the first place. `acceptInvite` already self-selected `clientType` from role (MEMBER→PWA, else→DASHBOARD) and needed no change — it can't produce a MEMBER+DASHBOARD combination by construction. The dashboard frontend always sends `clientType: DASHBOARD` on login, so a MEMBER now gets a clean 401 there instead of the confusing successful-login-then-bounced-to-`/login` behavior described in FE-2 (FE-2's frontend messaging is still open, but its backend root cause is closed).

Covered by TDD: `token.service.spec.ts` asserts the returned `clientType`; `auth.service.spec.ts` gained a `describe('refresh', ...)` block (previously **untested**) plus login-restriction cases (`MEMBER`+`DASHBOARD` rejected, all roles allowed via `PWA`, `ADMIN`/`TECHNICAL` allowed via `DASHBOARD`); `auth.controller.spec.ts` gained a regression test using a deliberately role/clientType-divergent fixture (`TECHNICAL` role, `PWA` session) proving the cookie TTL follows the stored `clientType` and not the role.

### 🟡✅ BUG-6 — Token-cleanup cron: second delete is dead code — FIXED

`token.service.ts:126-138`. The first `delete` removes everything with `expiresAt < now-30d`. The second one targets `revokedAt IS NOT NULL AND expiresAt < now-30d` — a strict **subset of what the first query just deleted**; it always affects 0 rows. Per the doc-comment, the intent was "revoked more than 30 days ago", i.e. `revokedAt: LessThan(thirtyDaysAgo)`. Consequence: revoked-but-unexpired tokens linger ~30 days past expiry instead of 30 days past revocation. Harmless in practice, but the code doesn't do what it says.

**Fix applied:** second `delete` now keys off `revokedAt` alone via TypeORM's `And(Not(IsNull()), LessThan(thirtyDaysAgo))`, generating `WHERE revoked_at IS NOT NULL AND revoked_at < now-30d` — matching the doc-comment's actual intent instead of duplicating the first query's `expiresAt` condition. Covered by an updated `token.service.spec.ts` asserting the second `delete` call's criteria has no `expiresAt` key and combines both `revokedAt` conditions via `And`.

### 🟡✅ BUG-7 — `UserProfile.person.email` is always `null` — FIXED

`auth.service.ts:66`: `email: person.managedBy?.email ?? null`, but every caller loads only `relations: ['person']` — `person.managedBy` is never populated, so login/`/auth/me` always return `person.email: null`.

**Fix applied:** all five `userRepository.findOne` calls that feed `toUserProfile` (`validateUser`, `refresh`, `getMe`, `acceptInvite`, `setupUser`) now load `relations: ['person', 'person.managedBy']` instead of just `['person']`. The mapping logic in `toUserProfile` was already correct (`person.managedBy?.email ?? null`) — the only bug was the missing relation, so no mapping changes were needed. Covered by new specs in `auth.service.spec.ts`: one asserting `getMe` requests `person.managedBy` in its `relations`, and one asserting the returned profile's `person.email` reflects `person.managedBy.email` end-to-end instead of `null`.

### 🟡 BUG-8 — `PersonResponseDto.email` doesn't exist on the entity

`person-response.dto.ts:69-70` exposes `email`, but the `Person` entity has no `email` column (contact email apparently lives on the managing `User`). The field is always `undefined` in every person response — dead API surface that the frontend may be blindly trusting.

### 🟡✅ BUG-9 — Manual activate/deactivate of a person overwrites `lastSyncedAt` — FIXED

`person.service.ts:338,358` set `lastSyncedAt = new Date()` on manual (de)activation. That column is the bookkeeping marker of the **legacy sync** (`person-sync.strategy.ts` sets it on every synced/deactivated record). Manually touching it makes a hand-edited person look "just synced", which can confuse any sync logic that reasons about staleness. Semantics mixing; use a different marker (or plain `updatedAt`).

**Fix applied:** `PersonService.deactivate` and `PersonService.activate` no longer touch `lastSyncedAt` at all — it's now written exclusively by `PersonSyncStrategy` (`createPerson`/`updatePerson`), so it reliably means "last time the legacy sync touched this record." `updatedAt` (already present via `@UpdateDateColumn`) covers the "when was this last edited" need for manual actions, with no new column required.

This was originally paired with an explicit `deactivatedManually` flag + migration to stop the legacy sync from silently reactivating a manually-deactivated person on its next run. That approach was replaced by a simpler, more fundamental fix — see **BUG-19** below, which removes the sync's ability to touch `isActive` at all (in either direction), making a separate manual/automatic marker unnecessary. Covered by updated specs in `person.service.spec.ts` asserting `lastSyncedAt` is left untouched by both methods.

### 🟡✅ BUG-10 — Provisional alias truncation can collide; unique violations surface as 500 — FIXED

`person.service.ts:177-204` and the demotion path both build `~` + alias and `.slice(0, 20)`. Two distinct 20-char aliases can truncate to the same value; `createProvisional` pre-checks existence (TOCTOU race aside) but the **demotion path performs no check** — the DB unique constraint then throws and reaches the client as an unhandled 500 instead of a 409. Same for alias conflicts in `update` generally.

**Fix applied:** `PersonService.update` now runs a pre-check whenever the final `alias` to be saved differs from the person's current alias — covering both the demotion-derived `~`-prefixed alias and any plain alias edit in the same method. It looks up an existing person with that alias and throws `ConflictException` if a *different* person (`conflict.id !== person.id`) already has it, before `Object.assign`/`save` runs. This is the same TOCTOU-tolerant pattern already used by `createProvisional` (a pre-check, not a DB-level fix — the race window itself is accepted as low-risk, matching the existing `createProvisional` precedent) — it turns the previously-unhandled `QueryFailedError` → 500 into a clean 409 for both the demotion path and general alias updates via `update`. Covered by three new specs in `person.service.spec.ts`: demotion-collision → `ConflictException` (and `save` never called), plain alias-update collision → `ConflictException`, and a free-alias update still succeeds. Full `nx test api` suite (639/639) and `nx lint api` pass.

### 🟠✅ BUG-11 — `applyComposition`: sortOrder computed outside the transaction → duplicated orders — FIXED

`figure-instance.service.ts:494-522`. Inside the `dataSource.transaction(...)` loop, `MAX(sortOrder)` is queried through `this.instanceRepository` — i.e. on a **different connection** than the transaction's manager. Under READ COMMITTED it cannot see the rows the transaction just inserted, so the max never advances: **every entry of the composition receives the same `sortOrder`**, and the resulting figures render in nondeterministic order. Fix: query the max once via `manager` (or compute `base + i`).

**Fix applied:** the `MAX(sortOrder)` query now runs once, before the transaction starts, and the loop increments a local counter (`nextSortOrder++`) for each entry instead of re-querying per iteration — the `base + i` option from the recommendation, simpler than threading the transaction's `manager` into the query builder and correct since nothing else can concurrently insert instances into this segment while `applyComposition` runs (the transaction still exists to guard the actual inserts alongside the segment-name update). Covered by a new spec in `figure-instance.service.spec.ts` that reproduces the bug's exact symptom — a composition with 3 entries and a query mock that always returns the same stale max, simulating a connection that can't see its own transaction's uncommitted rows — asserting the created instances get sequential `sortOrder` (6, 7, 8) rather than the same value three times. Verified red against the old implementation first (produced `[6, 6, 6]`).

### 🟠 BUG-12 — Two different "pinya capacity" formulas

The same concept is computed with different SQL in two places:

- `event-segment.service.ts:254-292` (`loadPinyaCapacities`, used by segment lists): counts `zone IN ('PINYA')` with `r."sortOrder" <= fi."numberOfCordons"`.
- `figure-instance.service.ts:400-420` (`findOneById`, returned after each instance mutation): counts `zone IN ('PINYA','BASE')` with `r."sortOrder" < $2` (strict).

Same instance, two endpoints, two different capacity numbers (off by the BASE nodes and by one cordon). The dashboard shows whichever it fetched last — inconsistent "assigned/capacity" badges. One definition should exist in one place.

### 🟠✅ BUG-13 — `figureMode` change deletes assignments before saving, non-transactionally — FIXED

`figure-instance.service.ts:124-133`: when switching to `REMAT`/`NETA`, pinya assignments are deleted **first** and the instance is saved **after**, with no transaction. If the save fails (or the request dies in between), assignments are gone but the mode never changed. Wrap both in one transaction (and see SEC-17: no lock check either).

**Fix applied:** for `figureMode` transitions to `REMAT`/`NETA`, the assignment deletion and the instance save now run inside a single `dataSource.transaction`: `deletePinyaAssignments`/`deletePinyaOnlyAssignments` take the transaction's `EntityManager` (instead of querying via `dataSource` directly) and `manager.save(FigureInstance, instance)` persists the mode change in the same transaction, so a failed delete or save rolls back both together. Other `update()` paths (label/sortOrder-only edits, or a `figureMode` change that isn't `REMAT`/`NETA`) keep the plain `instanceRepository.save`, since there's nothing to keep atomic with. Covered by new specs in `figure-instance.service.spec.ts` asserting the delete and the save both go through the same transaction manager, and that a rejected delete leaves neither the delete nor the save persisted (rollback).

### 🟠 BUG-14 — Template node updates can never *clear* `renglaId` / `renglaPosition` / `originNodeId`

`figure-template.service.ts:546-548` (`syncNodes` upsert):

```ts
node.originNodeId = dto.originNodeId ?? node.originNodeId;
node.renglaId = dto.renglaId ?? node.renglaId;
node.renglaPosition = dto.renglaPosition ?? node.renglaPosition;
```

Sending `null`/omitting falls back to the previous value, so detaching a node from a rengla through the editor's save endpoint is silently ignored (the value only ever clears when the whole rengla is deleted via `syncRengles`). Use an explicit `!== undefined` check like the rest of the codebase does.

### 🟡✅ BUG-15 — Duplicating a template twice → 500 — FIXED

`figure-template.service.ts:230-256`: `duplicate()` names the copy `"<name> (còpia)"`; `name` has a unique constraint and, unlike `create`/`update`, this save is **not** wrapped in `handleDbError`. Duplicating the same template twice throws a raw `QueryFailedError` → 500 instead of a 409 (or an auto-suffixed name via the existing `generateUniqueName`).

**Fix applied:** new `generateCopyName(originalName)` helper (parallel to the existing `generateUniqueName`) strips any trailing `(còpia)`/`(còpia N)` suffix from the original name first, then probes `"<base> (còpia)"`, `"<base> (còpia 2)"`, `"<base> (còpia 3)"`... against `templateRepository.findOne` until it finds a free name. `duplicate()` now calls this instead of hardcoding `` `${original.name} (còpia)` ``, so duplicating the same template repeatedly always gets a free name instead of hitting the unique constraint. The stripping step also means duplicating a template that is itself already named `"X (còpia)"` collides with the original on the first probe and correctly lands on `"X (còpia 2)"`, rather than stacking to `"X (còpia) (còpia)"`. Covered by new specs in `figure-template.service.spec.ts`: first duplicate gets `(còpia)`, a second duplicate gets `(còpia 2)`, a third gets `(còpia 3)`, and duplicating an already-`(còpia)`-named template produces `(còpia 2)` instead of stacking.

### 🟡 BUG-16 — Fuzzy search ordering ignores name similarity

`available-persons.service.ts:142-147`: the ORDER BY uses `GREATEST(word_similarity(:rawSearch, alias))` — `GREATEST` with a **single argument**. The WHERE clause matches on alias *or* name similarity, but results that matched via `name` are then ranked only by alias similarity. The second `word_similarity(... person.name)` argument was evidently lost.

### 🟠✅ BUG-17 — Lazy snapshot has a check-then-act race (duplicate instance nodes) — FIXED

`node-assignment.service.ts:340-350` (also `bulkImport`, `createAdHocNode`): `if (!instance.snapshotted) { await this.snapshotInstance(...) }`. Two concurrent first assignments both read `snapshotted = false` and both run the snapshot transaction → **every template node is copied twice** into `instance_nodes` (there is no unique constraint on `(figureInstanceId, sourceNodeId)`). The canvas then renders duplicated nodes. Fix: unique partial index on `(figureInstanceId, sourceNodeId)` + `ON CONFLICT DO NOTHING`, or claim the snapshot atomically (`UPDATE ... SET snapshotted = true WHERE id = $1 AND snapshotted = false` and only the winner copies).

**Fix applied — both of the above, not either/or:** `snapshotInstance()` now opens its transaction with an atomic claim, `manager.update(FigureInstance, { id: instance.id, snapshotted: false }, { snapshotted: true })`, *before* reading the template or building any `InstanceNode` rows. Postgres serializes concurrent `UPDATE`s on the same row (the loser's statement blocks until the winner commits, then re-evaluates its `WHERE snapshotted = false` and correctly sees 0 rows affected), so the loser never builds or inserts anything — it just reads back the winner's already-committed `InstanceNode` rows via `manager.find(InstanceNode, { where: { figureInstance: { id: instance.id } } })` and returns those instead. This was the deciding factor over the `ON CONFLICT DO NOTHING` half of the recommendation on its own: `assign()` immediately does `snapshotNodes.find(n => n.sourceNodeId === dto.nodeId)` and uses that row's `id` to create the `NodeAssignment` — with `orIgnore()`, the loser's in-memory rows would never have been the ones actually persisted (no `RETURNING` for skipped conflicting rows), so it would've needed this same read-back path anyway. `bulkImport` and `createAdHocNode` were unaffected by the change (they either reload the instance from the DB afterward or don't use the snapshot's return value).

As a structural backstop — for any current or future code path that inserts `InstanceNode`s without going through this atomic claim — migration `1782600000000-AddInstanceNodeSourceUniqueIndex` adds a unique partial index on `("figureInstanceId", "sourceNodeId") WHERE "sourceNodeId" IS NOT NULL` (ad-hoc nodes, which have no `sourceNodeId`, are intentionally excluded and unaffected), mirrored on the `InstanceNode` entity via `@Index(..., { unique: true, where: ... })` for schema-truthfulness (synchronize is off; the index itself comes from the migration). The migration also does a best-effort de-dup of any rows the race may have already produced on a live database — keeping the oldest row per `(figureInstanceId, sourceNodeId)` pair and skipping any row still referenced by a `node_assignments` row (which has `ON DELETE RESTRICT`) — so the constraint doesn't fail to create on an already-affected database.

Covered by two new specs in `node-assignment.service.spec.ts`: one asserting the conditional `UPDATE` runs (with the exact criteria) before `manager.save` is called (call-order assertion), and one simulating a lost race (`update` resolves `{ affected: 0 }`) asserting no `InstanceNode` is built/inserted and the template is never even fetched — the returned node comes entirely from the read-back.

### 🟡 BUG-18 — Assignment conflict checks are TOCTOU; segment-level rule has no DB constraint

`assign()` does three read-then-insert conflict checks. The node and person cases are backed by DB unique constraints (`@Unique(['figureInstance','instanceNode'])`, `@Unique(['figureInstance','person'])`) so a race "only" produces a 500 instead of 409. But the third rule — *person may appear only once per segment* — exists **only in application code**: two concurrent assigns into different instances of the same segment can both pass and persist, violating the domain invariant that a person can't be in two figures at once.

### 🟠✅ BUG-19 — `deactivateMissingPersons` trusts the legacy fetch blindly — FIXED

`person-sync.strategy.ts:588-607`: after a sync, every person whose `legacyId` was not in the fetched list is deactivated. The only guard is `legacyIds.length === 0`. If the legacy API ever returns a **partial** list (WAF page for some rows, changed server-side filter, pagination change), the sync mass-deactivates most of the census in one UPDATE. A sanity threshold ("refuse to deactivate more than N% in one run") turns a silent disaster into a visible warning.

**Fix applied — bigger than the original recommendation:** rather than adding a sanity threshold around the risky bulk-deactivation query, `deactivateMissingPersons()` was **removed entirely**, along with its call site and the "desactivades" count in the sync's completion event. The underlying design decision (from the BUG-9 fix, above) is that **the legacy sync must never deactivate — or reactivate — a person; `isActive` is exclusively a manual, human decision** (`PersonService.deactivate`/`softDelete`/`activate`). A partial or empty legacy fetch can therefore no longer mass-deactivate anything, because sync no longer deactivates *anyone*, partial fetch or not — the entire class of failure is gone, not just throttled.

As a consequence, `upsertPerson()` also had to stop reactivating persons on the update path: if a `legacyId` match exists but that person has `isActive: false` (i.e. was manually deactivated in MuixerApp while still present in the legacy census), sync now treats it like a brand-new legacy record — it calls `createPerson()` to create a **fresh, independent, active** person with the same `legacyId` (no unique constraint on that column) rather than reusing/reactivating the deactivated row. The deactivated person is left completely untouched. Covered by new specs in `person-sync.strategy.spec.ts` asserting `personRepository.create()` (not `.save()` on the old record) is called with `isActive: true` when the existing `legacyId` match is inactive, and that the deactivated record itself is never passed to `save()`.

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

### 🟠✅ ARCH-2 — Multi-step DB writes without transactions in user/person flows — FIXED

Examples:

- ✅ `UserService.createWithInvite`: create user → save person.managedBy → sendInvite (3 writes, no transaction). A failure mid-way leaves a user without a linked person or without an invite.
- ✅ `UserService.createUser`: save user → save person → re-fetch.
- ✅ `AuthService.setupUser`: save user → raw SQL update of `person_id` → re-fetch.

The figures module reportedly snapshots inside a transaction (to be verified below), so the pattern is known — it's just not applied consistently.

**Recommendation:** wrap multi-entity mutations in `dataSource.transaction(...)`.

**Fix applied:** all three call sites now inject `DataSource` and wrap their multi-entity writes in `dataSource.transaction(...)`, matching the pattern already used in `node-assignment.service.ts`:

- `UserService.createWithInvite`: user creation and `person.managedBy` linking now happen inside one transaction (via `manager.create`/`manager.save`), so a failure between the two can no longer leave an orphaned user or an unlinked person. `sendInvite` (the invite-token generation + email send) intentionally stays outside the transaction and unchanged — it's a separate, already-idempotent concern with its own error handling (BUG-4), not a case of "leaving inconsistent DB state."
- `UserService.createUser`: the user save (new or upgraded-stub branch), the `person.managedBy` link, and the final reload are now all done through the same transaction `manager`, replacing the previous three separate repository calls.
- `AuthService.setupUser`: the user save, the raw-SQL `person_id` update, and the final reload now all run through the same transaction `manager` (`manager.query(...)` instead of `this.userRepo.query(...)`). The success log line was also moved to after the transaction resolves, so bootstrap is no longer logged as "created" if the person link or reload subsequently fails. The raw SQL itself and its lack of a `personId` existence check are unchanged — that's SM-3's concern, not ARCH-2's, and remains open.

Covered by updated/new specs in `user.service.spec.ts` and `auth.service.spec.ts` using a mocked `DataSource.transaction`/manager (mirroring `node-assignment.service.spec.ts`'s existing pattern), asserting the transaction is invoked exactly once per call and that the relevant writes go through the same manager.

### 🟡✅ ARCH-3 — Refresh tokens are JWTs whose signature is never verified — FIXED

`rotateRefreshToken` looks the raw string up by SHA-256 hash; it never calls `jwtVerify`. The DB row is the actual source of truth (`expiresAt`, `revokedAt`, `usedAt`). So the JWT signing/payload machinery (and the separate `JWT_REFRESH_SECRET`) adds complexity without adding security — an opaque 256-bit random string would be simpler and smaller. Not a vulnerability (unguessable thanks to the `family` UUID + signature), just accidental complexity that invites the false belief that JWT expiry/signature are being enforced.

**Fix applied:** `TokenService.createRefreshToken` now generates the raw token via `randomBytes(32).toString('hex')` instead of `jwtService.signAsync(...)`. `JwtService`/`JWT_REFRESH_SECRET` are no longer part of `TokenService` at all — the constructor only takes the `RefreshToken` repository now. `JWT_REFRESH_SECRET` was removed from the Joi env schema, `.env.example`, CI, and the living docs that documented it (`README.md`, `CONTEXT.md`, `docs/AUTH_FLOW.md`, `docs/DEPLOY_PRE.md`, `docs/codebase/STACK.md`, `docs/codebase/INTEGRATIONS.md`); dated design-proposal docs under `docs/specs/` were left as historical records. The access token is unaffected — it's still a genuinely stateless, signature-verified JWT (`JWT_SECRET`), which is the case where a JWT is actually doing real work. Covered by an updated `token.service.spec.ts`: asserts the raw token matches `/^[0-9a-f]{64}$/` (32 random bytes, hex), that two calls never produce the same token, and that its hash is what gets stored — the `JwtService` mock and the "throws when `JWT_REFRESH_SECRET` is missing" construction test were removed as they no longer apply.

### 🟡 ARCH-4 — `timestamp` (without time zone) everywhere

All entities use `type: 'timestamp'` (e.g. `refresh-token.entity.ts:36`, `user.entity.ts:36`). Comparisons are done against `new Date()` in JS. This works while app and DB share UTC, but any TZ drift (local dev vs VPS) shifts expiries by hours. Postgres best practice is `timestamptz`.

### 🟡 ARCH-5 — Inconsistent 401 vs 403 in the refresh flow

`POST /auth/refresh` throws `ForbiddenException` (403) when the cookie is missing but `UnauthorizedException` (401) for invalid/expired/reused tokens. Clients must special-case both; pick one (401 is conventional for "re-authenticate").

### 🟡 ARCH-6 — Duplicate soft-delete paths on Person

`softDelete` (204, used by `DELETE /persons/:id`) and `deactivate` (200 + DTO, used by `PATCH /persons/:id/deactivate`) do the same thing with a different response shape/status — two code paths to maintain for one concept. (They used to also differ in a `lastSyncedAt` side effect — see BUG-9, now fixed — but that gap is closed; the duplication itself is still open.)

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

### 🟡✅ ARCH-10 — Migrations registered in two places — FIXED

`database.module.ts:71-92` hand-maintains an import list of all 20 migrations, while `data-source.ts:13` (used by the CLI and the prod entrypoint) uses a glob. A migration added to the folder but forgotten in the array runs in prod but **not** in dev (`migrationsRun: isDevelopment`) — silent schema drift between environments. Use the glob (or a shared `migrations/index.ts`) in both.

**Fix applied:** the audit's own snapshot had already drifted — `1782500000000-AddPersonNotesEmoji` existed as a file but was missing from `database.module.ts`'s array, confirming the bug live. Globbing wasn't viable for `database.module.ts` since the API is webpack-bundled for production (`apps/api/webpack.config.js`) and dynamic glob-based `require`s don't survive bundling — that's exactly why that file hand-listed migrations as static imports in the first place. Instead, added `apps/api/src/migrations/index.ts` exporting a single `migrations` array built from static imports of every migration file, and pointed both `database.module.ts` and `data-source.ts` at it — one list, two consumers, no more possibility of divergence. Added `migrations/index.spec.ts`, which reads the migrations directory at test time and asserts every file on disk has a corresponding entry in the array (by reconstructing the expected class name from the filename) — this test fails the moment someone adds a migration file without registering it in `index.ts`.

### 🟡 ARCH-11 — Inconsistent delete-protection policy across the event aggregate

`EventService.remove` refuses to delete an event with attendance records (409), but the same event's **segments, figure instances, snapshots and assignments are silently CASCADE-deleted** (`event_segments.eventId → CASCADE → figure_instances → instance_nodes/node_assignments`). Hours of pinya-assignment work can vanish without warning while a single attendance row blocks deletion. Decide one policy (block on any dependent data, or explicit "delete everything" confirmation) and apply it consistently.

---

## 4. Code smells & bad practices

- 🟡 **SM-1** `user.entity.ts:13-14`: `type PersonRef = any` to dodge a circular import. TypeORM ships `Relation<T>` exactly for this; `import type` also breaks the cycle without `any`.
- 🟡✅ **SM-2** — **FIXED.** `person.service.ts:153,276`: `findByIds()` is deprecated in TypeORM 0.3 (`findBy({ id: In(...) })`), and silently ignores non-existent IDs — a typo'd position UUID just vanishes instead of erroring. **Fix applied:** both call sites now go through a new private `findPositionsOrThrow()` helper, which resolves ids via `positionRepository.findBy({ id: In(positionIds) })` and throws `NotFoundException` when the returned count doesn't match the requested id count — a typo'd/nonexistent position id now errors instead of silently vanishing from the person's positions. Covered by new specs in `person.service.spec.ts` for both `create` and `update` (missing id → `NotFoundException`, `save` never called; valid ids → `findBy` called with `In([...])`).
- 🟡 **SM-3** `auth.service.ts:176-179`: raw SQL `UPDATE users SET person_id = ...` inside an otherwise repository-based service; bypasses entity hooks and `updatedAt`. Also no existence check on `personId` → FK violation → 500.
- 🟡 **SM-4** `main.ts:1-4`: scaffold comment “This is not a production server yet!” on a production API; `const cookieParser = require('cookie-parser')` instead of an ES import.
- 🟡✅ **SM-5** — **FIXED.** `user.service.ts:172-181` (`grantRole`) saves then re-fetches the user (2 extra queries); `updateUser` re-fetches too. Minor, but the pattern repeats. **Fix applied:** both methods now build the `UserResponseDto` from the entity returned by `save()` (TypeORM populates generated columns like `updatedAt` onto that same reference) instead of issuing a redundant third/second `findOne`. `grantRole`'s initial load now includes `relations: ['person']` up front so the relation survives without a refetch. Covered by new specs asserting `findOne` is called exactly once per method for the no-conflict-check path.
- 🟡✅ **SM-6** — **FIXED.** `UserService.createWithInvite` doesn't pre-check email uniqueness → DB unique violation surfaces as 500 instead of 409 (the generic `createUser` *does* check). **Fix applied:** `createWithInvite` now checks `userRepository.findOne({ where: { email: dto.email } })` up front and throws `ConflictException` (409) if a user with that email already exists, before touching the person or creating anything — mirroring `createUser`'s existing check (though without its "upgrade a passwordless stub" branch, which is specific to admin-created accounts and out of scope here). The dashboard's invitation modal (`person-invitation-modal.component.ts:46-49`) already surfaces `err.error.message` as-is, so no frontend change was needed. Covered by a new spec asserting the 409 and that `userRepository.create` is never reached.
- 🔵 **SM-7** `AuthController.login` types `req.user` inline and then casts with `Parameters<typeof this.authService.login>[0]` — noisy; a small `RequestWithUser` interface is clearer.
- 🟠✅  **SM-8** `figure-template.service.ts:405-411`: hand-rolled `generateUUID()` using `Math.random()`. Node's `crypto.randomUUID()` is already used elsewhere in the codebase (`token.service.ts`); `Math.random` is not collision-safe and this duplicate implementation is strictly worse.
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

- 🔴✅ **DEP-1** `xlsx@^0.18.5` — see SEC-2. **FIXED** — replaced with `exceljs`.
- 🟡✅ **DEP-2** `reflect-metadata@^0.1.14` — NestJS 11 supports `^0.2.x`; 0.1 is the legacy line. **FIXED** — bumped to `^0.2.2`.
- 🟡✅ **DEP-3** `@types/node: 20.19.9` pinned to Node 20 API surface while `engines` demands Node ≥22.13 — type definitions don't match the runtime. **FIXED** — bumped to `22.20.0`.
- 🔵✅ **DEP-4** CI is well designed (Nx affected on PRs, frozen lockfile, cache), which made the Dockerfile's `--no-lockfile` (SEC-14) the odd one out. **FIXED** — see SEC-14; the Dockerfile no longer bypasses pinned versions, so CI and the prod image now install the same dependency graph.

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