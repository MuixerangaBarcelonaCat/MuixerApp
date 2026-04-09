# P4.1: Auth Layer — JWT + Passport + User/Person Refactor + Dashboard Login

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Full authentication layer for Dashboard (TECHNICAL/ADMIN) and foundation for PWA (MEMBER). Includes User entity refactor, refresh token DB storage with rotation and revocation, role-based guards, Angular auth infrastructure, and onboarding flow from Person → User.
**Depends on:** P0–P3 (complete)

---

## 1. Context

The application is ready for deployment but the entire API is publicly accessible — any HTTP client can read, write, or delete data. This spec implements the full security layer before going live.

P1 created `User` and `Person` entities intentionally without a login system. The model was designed for this moment: `User` holds credentials and role, `Person` holds real-world member data. They are decoupled by design so that a `Person` can exist without a `User` account (needed for figure planning before members onboard).

The migration from the legacy system has already populated hundreds of `Person` records. The onboarding path is therefore **Person-first**: admins identify people, create accounts for technicians immediately, and send invite links to members later (P6).

### What this slice covers

- `User` entity refactor: add `email`, `OneToOne Person`, clean up unused imports
- `Person` entity refactor: add `OneToOne User` back-ref, remove `isMainAccount`
- New `RefreshToken` entity for DB-backed token storage, rotation, and revocation
- TypeORM migration for all schema changes
- `AuthModule` (NestJS): LocalStrategy, JwtStrategy, guards, role hierarchy
- 5 auth endpoints: login, refresh, logout, logout-all, invite accept
- Setup endpoint for bootstrapping the first TECHNICAL user
- `JwtAuthGuard` applied globally; `@Public()` decorator to opt out
- `RolesGuard` with `ADMIN ⊃ TECHNICAL ⊃ MEMBER` hierarchy
- Angular Dashboard: `AuthService` (signals), `authInterceptor`, `authGuard`, `roleGuard`, login page
- "Logout from all devices" from the Dashboard profile
- Foundation for P6 member invite flow (`POST /auth/invite/accept` endpoint)

### What this slice does NOT cover

- Dashboard UI for managing users (P4.2)
- Sending invite emails (P6 — requires email service)
- Password recovery / forgot password flow (P6)
- MEMBER-role login on PWA (P6)
- Multi-tenant isolation / `collaId` claim in JWT (future P8)
- Two-factor authentication (not planned)
- OAuth / social login (not planned)

---

## 2. Architecture Overview

```
┌──────────────────────┐         ┌───────────────────────────────────────┐
│  Angular Dashboard   │         │           NestJS API                   │
│  (TECHNICAL/ADMIN)   │         │                                         │
│                      │  login  │  POST /auth/login                       │
│  LoginComponent ─────┼────────►│    LocalStrategy (email+password)       │
│                      │◄────────┼─── access JWT (15min) + refresh cookie  │
│  AuthService         │         │                                         │
│  signal(currentUser) │  Bearer │  All protected endpoints                │
│  ──────────────────  │────────►│    JwtStrategy → JwtAuthGuard (global)  │
│  authInterceptor     │         │    RolesGuard (@Roles decorator)        │
│  adds Bearer header  │         │                                         │
│  handles 401 → retry │  cookie │  POST /auth/refresh                     │
│  ──────────────────  │────────►│    reads httpOnly cookie                │
│  authGuard           │◄────────┼─── new access JWT + rotated cookie      │
│  roleGuard           │         │                                         │
└──────────────────────┘         │  POST /auth/logout                      │
                                  │  POST /auth/logout-all                  │
┌──────────────────────┐         │  GET  /auth/me                          │
│  Angular PWA         │         │  POST /auth/invite/accept               │
│  (MEMBER — P6)       │         │  POST /auth/setup/technical             │
│  [same auth layer,   │         └───────────────────────────────────────┘
│   different TTL]     │                          │
└──────────────────────┘                          │ TypeORM
                                                   ▼
                                  ┌────────────────────────────┐
                                  │       NeonDB (PostgreSQL)   │
                                  │                             │
                                  │  users (refactored)         │
                                  │  persons (refactored)       │
                                  │  refresh_tokens (NEW)       │
                                  └────────────────────────────┘
```

---

## 3. Data Model Changes

### 3.1 `User` entity refactor

```typescript
// BEFORE (P1)                       // AFTER (P4.1)
class User {                          class User {
  id: uuid                              id: uuid
  passwordHash: string                  email: string          // ← ADD (unique, login credential)
  role: UserRole                        passwordHash: string
  isActive: boolean                     role: UserRole
  inviteToken: string | null            isActive: boolean
  inviteExpiresAt: Date | null          person: Person | null  // ← ADD (OneToOne, nullable)
  resetToken: string | null             inviteToken: string | null
  resetExpiresAt: Date | null           inviteExpiresAt: Date | null
  createdAt: Date                       resetToken: string | null
  updatedAt: Date                       resetExpiresAt: Date | null
  // import OneToMany unused ←REMOVE    createdAt: Date
}                                       updatedAt: Date
                                      }
```

`User.person` is **nullable** by design. An admin/dev user who is not a physical colla member can exist without a linked `Person`.

### 3.2 `Person` entity refactor

```typescript
// Changes only:
class Person {
  // ... all existing fields unchanged ...

  user: User | null          // ← ADD (OneToOne back-ref, nullable)
                             //   null = Person exists but has no account yet
                             //   set = Person has completed onboarding

  // isMainAccount: boolean  ← REMOVE (replaced by User.person OneToOne)
}
```

### 3.3 New entity: `RefreshToken`

```typescript
@Entity('refresh_tokens')
class RefreshToken {
  id: uuid (PK)
  userId: uuid              // FK → users.id (cascade delete)
  tokenHash: string         // SHA-256 of the actual token — never store plaintext
  family: uuid              // groups all rotations of a single login session
  clientType: ClientType    // 'dashboard' | 'pwa' — determines TTL
  expiresAt: Date
  usedAt: Date | null       // null = still valid; set = consumed by rotation
  revokedAt: Date | null    // null = active; set = explicitly revoked
  createdAt: Date

  // Indexes: userId, tokenHash (unique), family
}
```

**Why store hashed tokens?**
If the DB is breached, attackers cannot use the raw token values. The hash is computed on every refresh request and compared against stored hashes.

### 3.4 TypeORM Migration

One migration file (`AddAuthLayer`) covering all changes atomically:

```sql
-- users
ALTER TABLE users ADD COLUMN email VARCHAR UNIQUE NOT NULL;
ALTER TABLE users ADD COLUMN person_id UUID REFERENCES persons(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX users_person_id_unique ON users(person_id) WHERE person_id IS NOT NULL;

-- persons
ALTER TABLE persons ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE persons DROP COLUMN is_main_account;
CREATE UNIQUE INDEX persons_user_id_unique ON persons(user_id) WHERE user_id IS NOT NULL;

-- refresh_tokens (new table)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR NOT NULL UNIQUE,
  family UUID NOT NULL,
  client_type VARCHAR NOT NULL CHECK (client_type IN ('dashboard', 'pwa')),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family);
```

> **Note on existing data:** There are no existing `User` records with `isMainAccount` data in production, so the column drop is safe. The `email` column is `NOT NULL` — the migration only runs once the first user is created via the setup endpoint.

---

## 4. Backend — AuthModule

### 4.1 Module structure

```
apps/api/src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── token.service.ts              ← refresh token CRUD + rotation logic
├── strategies/
│   ├── local.strategy.ts         ← email + password validation
│   └── jwt.strategy.ts           ← JWT payload extraction + user loading
├── guards/
│   ├── jwt-auth.guard.ts         ← global guard (extends AuthGuard('jwt'))
│   └── roles.guard.ts            ← role hierarchy enforcement
├── decorators/
│   ├── public.decorator.ts       ← @Public() to bypass JwtAuthGuard
│   ├── roles.decorator.ts        ← @Roles(...UserRole[])
│   └── current-user.decorator.ts ← @CurrentUser() param decorator
├── entities/
│   └── refresh-token.entity.ts
├── dto/
│   ├── login.dto.ts              ← { email, password, clientType }
│   ├── accept-invite.dto.ts      ← { token, password }
│   ├── setup-technical.dto.ts    ← { email, password, personId? }
│   └── auth-response.dto.ts      ← { accessToken, user: UserProfileDto }
└── constants/
    └── auth.constants.ts         ← TTLs, cookie name, etc.
```

### 4.2 JWT Payload

```typescript
interface JwtPayload {
  sub: string;        // userId
  email: string;
  role: UserRole;
  // No collaId yet — added when multi-tenant is implemented
}
```

### 4.3 Strategies

**LocalStrategy** (`passport-local`):
- Validates `email` + `password`
- Loads `User` with `person` relation
- Checks `isActive === true`
- Returns `User` on success

**JwtStrategy** (`passport-jwt`):
- Extracts Bearer token from `Authorization` header
- Validates signature + expiry
- Returns `JwtPayload` (no DB query on every request — keeps auth fast)

### 4.4 Global JwtAuthGuard

Applied at `AppModule` level as a global guard:

```typescript
// app.module.ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

All endpoints are protected by default. Use `@Public()` to opt out.

### 4.5 Role Hierarchy

`RolesGuard` implements numeric hierarchy — higher roles can access lower-role-protected endpoints:

```typescript
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.MEMBER]:    1,
  [UserRole.TECHNICAL]: 2,
  [UserRole.ADMIN]:     3,
};

// @Roles(UserRole.TECHNICAL) → accepts TECHNICAL and ADMIN
// @Roles(UserRole.MEMBER)    → accepts all roles
```

Endpoints with no `@Roles()` decorator only require a valid JWT (any role).

### 4.6 Endpoints

#### `POST /auth/login` — `@Public()`

```
Body:    LoginDto { email, password, clientType: 'dashboard' | 'pwa' }
Returns: AuthResponseDto { accessToken, user: UserProfileDto }
Cookie:  Set-Cookie: refresh_token=<jwt>; HttpOnly; SameSite=Strict; Path=/auth;
         Max-Age: 28800 (dashboard 8h) | 604800 (pwa 7d)
```

Flow:
1. LocalStrategy validates credentials
2. `TokenService.createRefreshToken(user, clientType)`:
   - Generates UUID family
   - Signs refresh JWT with `{ sub, family, clientType }` and appropriate TTL
   - Stores SHA-256 hash in `refresh_tokens` table
3. Signs access JWT (15min)
4. Returns access token in body + refresh token in httpOnly cookie

#### `POST /auth/refresh` — `@Public()`

```
Cookie:  refresh_token (httpOnly)
Returns: AuthResponseDto { accessToken, user: UserProfileDto }
Cookie:  New rotated refresh_token (same TTL as original clientType)
```

Flow:
1. Read `refresh_token` cookie, verify JWT signature
2. Look up `RefreshToken` by `tokenHash`
3. If `usedAt` is set → **token reuse detected**:
   - Revoke entire family (`UPDATE refresh_tokens SET revokedAt=now() WHERE family=X`)
   - Return `401 Unauthorized`
4. If `revokedAt` is set → return `401 Unauthorized`
5. If expired → return `401 Unauthorized`
6. Mark current token as `usedAt=now()`
7. Create new `RefreshToken` (same family, same clientType)
8. Return new access token + new refresh cookie

#### `POST /auth/logout` — JWT required

```
Cookie:  refresh_token
Returns: 200 OK
Action:  Sets revokedAt on the current RefreshToken; clears cookie
```

#### `POST /auth/logout-all` — JWT required

```
Returns: 200 OK
Action:  Sets revokedAt=now() on ALL RefreshTokens for the userId; clears cookie
```

Use case: user suspects account compromise, or wants to sign out from all devices.

#### `GET /auth/me` — JWT required

```
Returns: UserProfileDto {
  id, email, role, isActive,
  person: { id, name, firstSurname, alias, email } | null
}
```

#### `POST /auth/invite/accept` — `@Public()`

```
Body:    AcceptInviteDto { token: string, password: string }
Returns: AuthResponseDto (auto-login after accepting)
```

Flow:
1. Find `User` where `inviteToken = token` and `inviteExpiresAt > now()`
2. Hash password with bcrypt (rounds: 12)
3. Set `passwordHash`, `isActive=true`, clear `inviteToken`/`inviteExpiresAt`
4. Auto-login: return access + refresh tokens (clientType derived from User.role)

> This endpoint is built now, used in P6 when invite emails are implemented.

#### `POST /auth/setup/technical` — `@Public()`, protected by `X-Setup-Token` header

```
Headers: X-Setup-Token: <SETUP_TOKEN env var>
Body:    SetupTechnicalDto { email, password, personId?: string }
Returns: UserProfileDto
```

Rules:
- Returns `403` if `SETUP_TOKEN` env var is not set
- Returns `403` if header does not match `SETUP_TOKEN`
- Idempotent: if `email` already exists, returns existing user (no error)
- If `personId` provided: links `User.person` and `Person.user`
- Creates user with `role=TECHNICAL`, `isActive=true`

This endpoint is the **only way** to create users in P4.1. Disabled in production by removing the env var.

### 4.7 CORS update

```typescript
// main.ts
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:4200'],
  credentials: true,  // required for httpOnly cookie
});
```

`.env` example:
```
CORS_ORIGINS=http://localhost:4200,http://localhost:4300,https://dashboard.muixerapp.cat
```

### 4.8 Environment variables

```bash
JWT_SECRET=<strong-random-secret>        # access token signing
JWT_REFRESH_SECRET=<different-secret>    # refresh token signing (different key)
JWT_ACCESS_TTL=900                       # 15 minutes (seconds)
JWT_REFRESH_TTL_DASHBOARD=28800          # 8 hours (seconds)
JWT_REFRESH_TTL_PWA=604800              # 7 days (seconds)
SETUP_TOKEN=<random-uuid>               # remove after first user created
CORS_ORIGINS=http://localhost:4200
REFRESH_TOKEN_COOKIE=muixer_rt           # cookie name
```

---

## 5. Frontend — Angular Dashboard Auth Layer

### 5.1 File structure

```
apps/dashboard/src/app/
├── core/
│   └── auth/
│       ├── guards/
│       │   ├── auth.guard.ts        ← redirects to /login if no valid token
│       │   └── role.guard.ts        ← blocks routes by minimum role
│       ├── interceptors/
│       │   └── auth.interceptor.ts  ← adds Bearer; 401 → refresh → retry
│       ├── services/
│       │   └── auth.service.ts      ← signal-based state: currentUser, isAuthenticated
│       └── models/
│           └── auth.models.ts       ← LoginRequest, AuthResponse, UserProfile interfaces
├── features/
│   └── auth/
│       └── login/
│           ├── login.component.ts
│           ├── login.component.html
│           └── login.component.scss
```

### 5.2 AuthService

Signal-based, no RxJS state:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  // State
  private readonly _currentUser = signal<UserProfile | null>(null);
  private readonly _accessToken = signal<string | null>(null);  // memory only, never localStorage

  // Public API
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAtLeastTechnical = computed(() =>
    [UserRole.TECHNICAL, UserRole.ADMIN].includes(this.userRole()!)
  );

  // Methods
  login(credentials: LoginRequest): Observable<void>
  refresh(): Observable<void>   // called by interceptor on 401
  logout(): Observable<void>
  logoutAll(): Observable<void>
  loadCurrentUser(): Observable<void>  // called on app init via APP_INITIALIZER
}
```

Access token lives **only in memory** (`signal`). Survives navigation but not page refresh. On refresh, the `APP_INITIALIZER` calls `POST /auth/refresh` using the httpOnly cookie — if successful, user is silently re-authenticated.

### 5.3 Auth Interceptor

Functional interceptor (`withInterceptors`):

```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Skip auth endpoints (avoid infinite loops)
  if (req.url.includes('/auth/')) return next(req);

  // 2. Add Bearer token + withCredentials (required for httpOnly cookie cross-origin)
  const token = inject(AuthService).getAccessToken();
  const authReq = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

  // 3. Handle 401: attempt refresh once, then retry
  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        return inject(AuthService).refresh().pipe(
          switchMap(() => next(authReq.clone({
            setHeaders: { Authorization: `Bearer ${inject(AuthService).getAccessToken()}` }
          }))),
          catchError(() => {
            inject(AuthService).clearState();
            inject(Router).navigate(['/login']);
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
```

### 5.4 Guards

```typescript
// auth.guard.ts — protects all dashboard routes
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

// role.guard.ts — blocks MEMBER role from dashboard
export const roleGuard = (minRole: UserRole): CanActivateFn => () => {
  const role = inject(AuthService).userRole();
  if (role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]) return true;
  return inject(Router).createUrlTree(['/login']);
};
```

### 5.5 Routes update

```typescript
// app.routes.ts
export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [authGuard, roleGuard(UserRole.TECHNICAL)],
    children: [
      { path: '', redirectTo: 'persons', pathMatch: 'full' },
      { path: 'persons', loadChildren: () => import('./features/persons/persons.routes') },
      { path: 'rehearsals', loadChildren: () => import('./features/events/events.routes') },
      { path: 'performances', loadChildren: () => import('./features/events/events.routes') },
    ],
  },
];
```

### 5.6 App initialization

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => auth.loadCurrentUser(),
      deps: [AuthService],
      multi: true,
    },
  ],
};
```

On every app load, `loadCurrentUser()` calls `POST /auth/refresh` → if the httpOnly cookie is valid, the user is silently authenticated and `currentUser` signal is populated.

### 5.7 Login page

Simple, clean form using DaisyUI. Fields: email + password. On submit: calls `AuthService.login()`, redirects to `/`. Shows error toast on failure.

The login page must include the `clientType: 'dashboard'` in the request — this is hardcoded in the Dashboard app's `AuthService.login()`.

### 5.8 Logout from all devices

Available from a user profile menu (header component). Calls `AuthService.logoutAll()` → `POST /auth/logout-all` → clears state → redirects to `/login`.

---

## 6. Onboarding Flow: Person → User

### 6.1 Context

All `Person` records already exist from the legacy migration. The path to a user account is always **Person-first**.

### 6.2 TECHNICAL user creation (P4.1 — now)

```
Admin calls:
  POST /auth/setup/technical
  Headers: X-Setup-Token: <env var>
  Body: { email, password, personId: "<uuid of existing Person>" }

Result:
  - User created (TECHNICAL, isActive=true)
  - User.person ← Person
  - Person.user ← User
  - Admin logs in at /login with the new credentials
```

This flow is used for the initial bootstrap (the first admin) and for adding new technical team members before the user management UI is built in P4.2.

### 6.3 MEMBER invite flow (P6 — infrastructure ready in P4.1)

```
[P4.1 — endpoint exists, not yet triggered by UI]
  POST /auth/invite/accept
  Body: { token, password }

[P6 — full flow]
  1. Technical user selects Person in Dashboard → "Enviar invitació"
  2. API: generates inviteToken (UUID v4), sets inviteExpiresAt (now + 48h)
     Stores on User record (created inactive, no password yet)
  3. Email sent to Person.email with link: /pwa/accept-invite?token=<uuid>
  4. Member opens link → sets password → POST /auth/invite/accept
  5. API: validates token, hashes password, sets isActive=true, clears invite fields
  6. Auto-login response → member lands in PWA authenticated
```

The `User` entity already has `inviteToken` and `inviteExpiresAt` fields from P1 — no schema change needed for this flow.

---

## 7. Security Decisions

| Decision | Rationale |
|---|---|
| Access token in memory (Angular signal), never `localStorage` | Eliminates XSS token exfiltration |
| Refresh token in `httpOnly` cookie with `SameSite=Strict` | Not accessible to JavaScript; `SameSite=Strict` prevents CSRF |
| Separate JWT secrets for access and refresh tokens | Compromise of one secret does not affect the other |
| Refresh token stored as SHA-256 hash in DB | DB breach does not yield usable tokens |
| Token family pattern | Detects refresh token reuse (session hijacking attempt) → revokes entire session |
| Refresh TTL differs by client: 8h (dashboard) vs 7d (pwa) | Dashboard is a management tool — shorter sessions reduce risk window |
| `SETUP_TOKEN` endpoint disabled by removing env var | Bootstrap-only endpoint; zero attack surface in production |
| `CORS_ORIGINS` allowlist | Prevents cross-origin API abuse from unauthorized frontends |
| `withCredentials: true` required on Angular HTTP calls | Ensures the cookie is sent cross-origin in dev/staging |
| bcrypt rounds: 12 | ~300ms hash time; sufficient protection against brute force |
| `MEMBER` role blocked at Dashboard route guard, not API | Separation of concerns: auth system is agnostic to which app the user opens |

---

## 8. Shared Library Changes (`libs/shared`)

New additions to `@muixer/shared`:

```typescript
// enums/client-type.enum.ts
export enum ClientType {
  DASHBOARD = 'dashboard',
  PWA = 'pwa',
}

// interfaces/auth.interfaces.ts
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  person: PersonSummary | null;
}

export interface PersonSummary {
  id: string;
  name: string;
  firstSurname: string;
  alias: string;
  email: string | null;
}
```

These interfaces are shared between the API (response types) and the Dashboard (model types), avoiding duplication.

---

## 9. Testing Plan

### Backend (Jest)

| Test | Type | What to verify |
|------|------|----------------|
| `POST /auth/login` — valid credentials | Integration | Returns 200, access token, sets cookie |
| `POST /auth/login` — wrong password | Integration | Returns 401 |
| `POST /auth/login` — inactive user | Integration | Returns 401 |
| `POST /auth/refresh` — valid cookie | Integration | Returns new access token, rotates cookie |
| `POST /auth/refresh` — reused token | Integration | Returns 401, revokes family |
| `POST /auth/refresh` — revoked token | Integration | Returns 401 |
| `POST /auth/logout` | Integration | Marks token revoked, clears cookie |
| `POST /auth/logout-all` | Integration | All user tokens revoked |
| `GET /auth/me` | Integration | Returns user profile with person |
| `JwtAuthGuard` — no token | Integration | Returns 401 on protected endpoint |
| `RolesGuard` — MEMBER on TECHNICAL endpoint | Integration | Returns 403 |
| `RolesGuard` — ADMIN on TECHNICAL endpoint | Integration | Returns 200 (hierarchy) |
| `POST /auth/setup/technical` — wrong setup token | Integration | Returns 403 |
| `POST /auth/setup/technical` — idempotent | Integration | Second call returns existing user |
| `POST /auth/invite/accept` — valid token | Integration | Activates user, returns tokens |
| `POST /auth/invite/accept` — expired token | Integration | Returns 401 |
| `TokenService.rotateRefreshToken` | Unit | Hash comparison, family preservation |

### Frontend (Vitest / Jest)

| Test | Type | What to verify |
|------|------|----------------|
| `AuthService.login` | Unit | Sets `currentUser` signal, stores token in memory |
| `AuthService.logout` | Unit | Clears signal state |
| `authInterceptor` — adds Bearer | Unit | Request has Authorization header |
| `authInterceptor` — 401 → refresh → retry | Unit | Retry with new token after successful refresh |
| `authInterceptor` — 401 refresh fails | Unit | Navigates to /login, clears state |
| `authGuard` — authenticated | Unit | Returns true |
| `authGuard` — not authenticated | Unit | Returns UrlTree to /login |
| `roleGuard(TECHNICAL)` — ADMIN user | Unit | Returns true (hierarchy) |
| `roleGuard(TECHNICAL)` — MEMBER user | Unit | Returns UrlTree to /login |
| `LoginComponent` — submit | Component | Calls AuthService.login, navigates on success |
| `LoginComponent` — error | Component | Shows error message in Catalan |

---

## 10. Package Dependencies

New packages to install:

```bash
# NestJS API
npm install @nestjs/passport @nestjs/jwt passport passport-local passport-jwt bcrypt
npm install -D @types/passport-local @types/passport-jwt @types/bcrypt

# Angular Dashboard (no new packages needed — uses HttpClient + RxJS already present)
```

---

## 11. Implementation Order

This spec is implemented as a single feature branch `feat/p4-1-auth-layer`. Suggested task order:

1. Install dependencies
2. Schema migration (`AddAuthLayer`)
3. Update `User` + `Person` entities
4. Create `RefreshToken` entity
5. Create `TokenService` (hash, store, rotate, revoke)
6. Create `LocalStrategy` + `JwtStrategy`
7. Create `AuthService` (login, refresh, logout logic)
8. Create `AuthController` with all 6 endpoints
9. Apply global `JwtAuthGuard` + `RolesGuard` in `AppModule`
10. Add `@Roles` decorators to existing controllers (PersonController, EventController, etc.)
11. Update `main.ts` CORS config
12. Add `ClientType` enum + auth interfaces to `libs/shared`
13. Angular: `AuthService` (signals)
14. Angular: `authInterceptor` (functional)
15. Angular: `authGuard` + `roleGuard`
16. Angular: update `app.config.ts` (interceptor + APP_INITIALIZER)
17. Angular: update `app.routes.ts` (protected routes)
18. Angular: `LoginComponent` (3 files)
19. Tests (backend + frontend)
20. Update `.env.example` with new variables
