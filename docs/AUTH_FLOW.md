# Auth Flow — MuixerApp

> P4.1 Auth Layer. JWT + Passport. Implementat abril 2026.

---

## Resum

Autenticació basada en **JWT access token** (memòria) + **refresh token** (httpOnly cookie amb rotació + detecció de reutilització). Dues strategies de Passport: `local` (login) i `jwt` (protecció global).

---

## 1. Login

```
Client (Dashboard/PWA)                    Backend (NestJS)
─────────────────────                     ────────────────
POST /auth/login                    →     LocalStrategy.validate()
{ email, password, clientType }           ├─ findOne(email) + bcrypt.compare
                                          ├─ return User (amb Person rel)
                                          │
                                          AuthService.login(user, clientType)
                                          ├─ signAccessToken(user) → JWT {sub, email, role}
                                          ├─ tokenService.createRefreshToken(user, clientType)
                                          │   ├─ sign JWT refresh (sub, family, clientType)
                                          │   ├─ SHA-256 hash → DB (refresh_tokens)
                                          │   └─ return rawToken
                                          │
                                    ←     Set-Cookie: muixer_rt=<rawToken> (httpOnly)
                                          { accessToken, user: UserProfile }
```

**Emmagatzematge al client:**
- `accessToken` → signal en memòria (`_accessToken` signal, mai localStorage)
- `refreshToken` → cookie httpOnly `muixer_rt` (el browser la gestiona)

**Silent refresh al bootstrap:**
- `AuthService` constructor crida `POST /auth/refresh` automàticament
- `isReady` signal (+ `whenReady()` Promise) indica quan la init ha acabat
- Guards async esperen `whenReady()` abans de decidir → zero parpellejos
- No es bloqueja el renderitzat de l'app (no `APP_INITIALIZER` bloquejant)

---

## 2. Request autenticat

```
Client                                    Backend
──────                                    ───────
GET /api/persons                    →     JwtAuthGuard (global)
Authorization: Bearer <accessToken>       ├─ @Public()? → skip guard
                                          ├─ JwtStrategy.validate(payload)
                                          │   └─ ExtractJwt.fromAuthHeaderAsBearerToken()
                                          ├─ RolesGuard (global)
                                          │   └─ @Roles()? → check user.role ∈ allowedRoles
                                    ←     200 OK / 401 / 403
```

**Angular interceptor** (`authInterceptor`): afegeix `Authorization: Bearer` a totes les requests fora de `/auth/`.

---

## 3. Refresh (rotació de token)

```
Client                                    Backend
──────                                    ───────
POST /auth/refresh                  →     AuthController.refresh()
Cookie: muixer_rt=<oldToken>              ├─ llegir cookie
                                          ├─ tokenService.rotateRefreshToken(oldToken)
                                          │   ├─ SHA-256(oldToken) → buscar a DB
                                          │   ├─ ⚠ usedAt != null? → REVOCAR FAMÍLIA
                                          │   ├─ revokedAt != null? → 401
                                          │   ├─ expiresAt < now? → 401
                                          │   ├─ marcar oldToken com used
                                          │   └─ crear nou token (mateixa família)
                                          ├─ signAccessToken(user)
                                    ←     Set-Cookie: muixer_rt=<newToken>
                                          { accessToken, user: UserProfile }
```

**Flux automàtic al Dashboard**: si una request rep 401, l'interceptor crida `/auth/refresh`, actualitza l'access token i reintenta la request original. Si el refresh falla → `clearState()` + redirect a `/login`.

---

## 4. Logout

```
POST /auth/logout       →  revocar token actual + clearCookie
POST /auth/logout-all   →  revocar TOTS els tokens del user + clearCookie
```

---

## 5. Setup inicial (bootstrap)

```
POST /auth/setup/user                   →     AuthController.setupUser()
Headers: X-Setup-Token: <SETUP_TOKEN>         ├─ validar SETUP_TOKEN env
Body: { email, password, role?, personId? }   ├─ crear User (isActive: true)
                                              ├─ link a Person (per personId o per email match)
                                        ←     UserProfile
```

> Endpoint per crear el primer user TECHNICAL sense auth prèvia. Eliminar `SETUP_TOKEN` de `.env` en producció després del primer ús.

---

## 6. Accept invite (onboarding membres)

```
POST /auth/invite/accept                →     AuthController.acceptInvite()
{ token, password }                           ├─ findOne(inviteToken)
                                              ├─ validar expiresAt
                                              ├─ bcrypt hash password
                                              ├─ activar user (isActive: true)
                                              ├─ netejar invite token
                                              ├─ auto-login (access + refresh)
                                        ←     Set-Cookie + { accessToken, user }
```

---

## Components del sistema

### Backend (`apps/api/src/modules/auth/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `auth.module.ts` | Registra Passport, JWT, ThrottlerModule, entitats |
| `auth.controller.ts` | 7 endpoints (login, refresh, logout, logout-all, me, invite/accept, setup/user) |
| `auth.service.ts` | Lògica de negoci: validate, login, refresh, logout, acceptInvite, setupUser |
| `token.service.ts` | CRUD de refresh tokens: create, rotate (reuse detection), revoke |
| `strategies/local.strategy.ts` | Passport Local: email + password via bcrypt |
| `strategies/jwt.strategy.ts` | Passport JWT: extract Bearer token, validate payload |
| `guards/jwt-auth.guard.ts` | Guard global (APP_GUARD). Respecta `@Public()` |
| `guards/roles.guard.ts` | Guard global (APP_GUARD). Respecta `@Roles()` — llista plana, sense jerarquia |
| `decorators/public.decorator.ts` | `@Public()` — exclou endpoint del JwtAuthGuard |
| `decorators/roles.decorator.ts` | `@Roles(UserRole.TECHNICAL)` — restringeix per rol |
| `decorators/current-user.decorator.ts` | `@CurrentUser()` — extreu `JwtPayload` del request |
| `entities/refresh-token.entity.ts` | Entitat TypeORM: hash, family, clientType, expiresAt, usedAt, revokedAt |
| `constants/auth.constants.ts` | TTLs (env-configurable), cookie name, claus metadata |

### Frontend (`apps/dashboard/src/app/core/auth/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `services/auth.service.ts` | Signal-based: `currentUser`, `isAuthenticated`, `isReady`, `userRole`. Constructor → silent refresh. `refresh()` dedup via `share()`. `whenReady()` Promise pels guards. |
| `interceptors/auth.interceptor.ts` | Afegeix `Bearer` header. 401 → `refresh()` (dedup) → retry. Refresh fail → redirect `/login` |
| `guards/auth.guard.ts` | `CanActivateFn` async: `await whenReady()` → si no autenticat → redirect `/login` |
| `guards/role.guard.ts` | `rolesGuard(...roles)`: async factory, `await whenReady()` → verifica `userRole()` ∈ allowedRoles |
| `models/auth.models.ts` | Interfaces: `LoginRequest`, `AuthResponse`, `UserProfile`, `PersonSummary` |

### Shared (`libs/shared/src/`)

| Fitxer | Contingut |
|--------|-----------|
| `enums/client-type.enum.ts` | `ClientType.DASHBOARD \| ClientType.PWA` |
| `interfaces/auth.interfaces.ts` | `JwtPayload`, `PersonSummary`, `UserProfile` |

---

## Variables d'entorn

| Variable | Exemple | Descripció |
|----------|---------|------------|
| `JWT_SECRET` | `strong-random-64-chars` | Secret per signar access tokens |
| `JWT_REFRESH_SECRET` | `different-strong-secret` | Secret per signar refresh tokens (separat!) |
| `JWT_ACCESS_TTL` | `900` | Vida access token en segons (15 min) |
| `JWT_REFRESH_TTL_DASHBOARD` | `28800` | Vida refresh token Dashboard en segons (8h) |
| `JWT_REFRESH_TTL_PWA` | `604800` | Vida refresh token PWA en segons (7 dies) |
| `REFRESH_TOKEN_COOKIE` | `muixer_rt` | Nom de la cookie httpOnly |
| `SETUP_TOKEN` | `uuid-aleatori` | Token per al bootstrap endpoint. Eliminar en prod |
| `CORS_ORIGINS` | `http://localhost:4200,http://localhost:4300` | Orígens permesos (comma-separated) |

---

## Seguretat

- **bcrypt cost 12+** per hashing de passwords
- **SHA-256** per hashing de refresh tokens a DB (mai guardat en clar)
- **Rotació obligatòria**: cada ús de refresh token genera un de nou i invalida l'anterior
- **Detecció de reutilització**: si un token ja marcat com `used` es presenta, tota la família es revoca
- **Rate limiting**: `@nestjs/throttler` als endpoints auth (10 req/60s per IP)
- **Cookie segura**: `httpOnly`, `sameSite: lax`, `secure` en producció, `path: /api/auth`
  - `lax` (no `strict`) permet que el browser enviï la cookie en navegacions top-level des d'enllaços externs (WhatsApp → PWA)
- **Access token en memòria**: mai `localStorage`, es perd al tancar pestanya (per disseny)
- **Silent refresh**: al bootstrap, `AuthService` crida `/auth/refresh` automàticament. Un signal `isReady` i `whenReady()` Promise coordinen els guards perquè no redirigixin a `/login` abans que el refresh acabi.
- **Refresh dedup**: crides concurrents a `refresh()` comparteixen un únic HTTP request via `share()`, evitant detecció de reutilització al backend.
