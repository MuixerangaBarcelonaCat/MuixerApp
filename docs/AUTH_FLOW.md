---
tags: [domini]
---

# Auth Flow — MuixerApp

> P4.1 Auth Layer. JWT + Passport. Implementat abril 2026.
> §6-7 actualitzades agost 2026: l'onboarding de membres passa d'invitació per correu
> (mai implementada) a enllaç copiat manualment + registre a la PWA, i s'hi afegeix el
> flux de dependents (xicalla).

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
                                          │   ├─ randomBytes(32) → token opac
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

## 6. Onboarding de membres (enllaç d'invitació, no correu)

No s'envia cap correu: l'admin genera un enllaç des del Dashboard i el reenvia manualment
(WhatsApp). El membre l'obri a la PWA, completa les seues dades i el compte s'activa amb
auto-login.

```
Dashboard (admin)                         Backend
──────────────────                        ───────
POST /users/invite-link             →     UserController.createInviteLink()
{ personId }                              UserService.createOrRefreshInviteLink()
                                          ├─ person.user inexistent? → crea User
                                          │   (email: null, isActive: false, role: MEMBER)
                                          │   i degrada el delegat primari si n'hi ha
                                          ├─ person.user actiu? → 400 (ja té compte)
                                          ├─ genera token (randomBytes) + SHA-256 hash
                                          ├─ inviteExpiresAt = now + INVITE_TOKEN_TTL_HOURS
                                    ←     { inviteUrl, expiresAt }
```

El botó **"Crea enllaç d'invitació"** no es desactiva mai: repetir la crida regenera el
token (i és l'única manera de "reenviar" un enllaç caducat). Un cop el compte és actiu, el
botó desapareix i es mostra un indicador estàtic "Compte actiu".

```
PWA (membre)                              Backend
─────────────                             ───────
GET /auth/invite/:token             →     AuthController.getInviteContext()
                                          ├─ valida hash + expiresAt
                                    ←     { person (prellenat), expiresAt, legalDocument }

POST /auth/invite/register          →     AuthController.registerViaInvite()
{ token, email, password,                 AuthService.registerViaInvite() — transaccional:
  legalAccepted, name, firstSurname,      ├─ valida token + email no usat
  secondSurname?, gender, phone,          ├─ activa User (email, password, isActive: true)
  birthDate }                             ├─ promou Person (PersonService.update amb manager):
                                          │   isProvisional → false, treu prefix `~` de l'alias
                                          ├─ registra AuditAction.CONSENT_ACCEPTED
                                          ├─ auto-login (access + refresh, clientType PWA)
                                    ←     Set-Cookie + { accessToken, user }
```

El formulari de registre és `PersonRegistrationDataDto` (nom, cognoms, gènere, telèfon E.164
validat amb `libphonenumber-js`, data de naixement) + `email`/`password`/`legalAccepted` —
compartit amb el flux de dependents (§7) via el mateix DTO base.

---

## 7. Dependents (xicalla) pendents de completar

Una xicalla mai té compte propi: es vincula com a `PersonDelegate` primari a un membre ja
registrat (abans o després que este activi el seu propi compte — cap dels dos ordres bloqueja
l'altre). Completar les seues dades és una acció autenticada normal, **no** un segon enllaç
d'invitació.

```
PWA (membre autenticat)                   Backend (@Roles MEMBER, TECHNICAL, ADMIN)
────────────────────────                  ─────────────────────────────────────────
GET /me/pending-dependents           →    MeService.getPendingDependents(userId)
                                          └─ PersonDelegateService
                                               .findProvisionalPrimaryDependents(userId)
                                    ←      PendingDependent[] (personId, alias, prellenat)

POST /me/pending-dependents           →   MeService.completePendingDependent(userId, dto)
{ personId, name, firstSurname,           ├─ re-consulta el set elegible (autorització:
  secondSurname?, gender, phone,          │   rebutja 400 si personId no hi és)
  birthDate }                             ├─ PersonService.update(personId, {…, isProvisional: false})
                                    ←      200
```

La PWA mostra un banner a Inici quan la llista no és buida (alias si n'hi ha 1, recompte si
n'hi ha més) i completa **un dependent alhora**: envia, torna a demanar la llista, i mostra el
següent (o navega a Inici si ja no en queda cap). `PersonDataFieldsComponent` (el subformulari
de dades personals) és exactament el mateix component que useu al registre (§6) — cap
duplicació de camps ni validadors.

---

## Components del sistema

### Backend (`apps/api/src/modules/auth/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `auth.module.ts` | Registra Passport, JWT, ThrottlerModule, entitats |
| `auth.controller.ts` | login, refresh, logout, logout-all, me, `GET invite/:token`, `POST invite/register`, setup/user, forgot/reset-password |
| `auth.service.ts` | Lògica de negoci: validate, login, refresh, logout, `getInviteContext`, `registerViaInvite` (transaccional User+Person), setupUser |
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

**Enllaç d'invitació i dependents** (fora del mòdul `auth`, però part del mateix flux):

| Fitxer | Responsabilitat |
|--------|----------------|
| `modules/user/user.service.ts` | `createOrRefreshInviteLink(personId)` — crea/reutilitza `User`, genera i (re)hasheja el token |
| `modules/person/dto/person-registration-data.dto.ts` | DTO base compartit (registre propi i dependents): nom, cognoms, gènere, telèfon (`IsValidPhoneNumber`), data naixement |
| `modules/person-delegate/person-delegate.service.ts` | `findProvisionalPrimaryDependents(userId)` — dependents provisionals on l'usuari és delegat primari |
| `modules/me/me.service.ts` | `getPendingDependents` / `completePendingDependent` (`GET`/`POST /me/pending-dependents`) |
| `common/validators/is-valid-phone-number.decorator.ts` | `@IsValidPhoneNumber()` — backed by `libphonenumber-js` |

### Frontend (`apps/dashboard/src/app/core/auth/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `services/auth.service.ts` | Signal-based: `currentUser`, `isAuthenticated`, `isReady`, `userRole`. Constructor → silent refresh. `refresh()` dedup via `share()`. `whenReady()` Promise pels guards. |
| `interceptors/auth.interceptor.ts` | Afegeix `Bearer` header. 401 → `refresh()` (dedup) → retry. Refresh fail → redirect `/login` |
| `guards/auth.guard.ts` | `CanActivateFn` async: `await whenReady()` → si no autenticat → redirect `/login` |
| `guards/role.guard.ts` | `rolesGuard(...roles)`: async factory, `await whenReady()` → verifica `userRole()` ∈ allowedRoles |
| `models/auth.models.ts` | Interfaces: `LoginRequest`, `AuthResponse`, `UserProfile`, `PersonSummary` |

### PWA (`apps/pwa/src/app/`)

| Fitxer | Responsabilitat |
|--------|----------------|
| `features/auth/activate/activate.component.ts` | Ruta `/activate?token=`. Prellenat via `getInviteContext`, formulari complet, `registerViaInvite` → auto-login → `/home` |
| `shared/components/person-data-fields/person-data-fields.component.ts` | Subformulari reutilitzat pel registre i pels dependents — pren un `FormGroup` ja construït, no en té estat propi |
| `shared/utils/person-data-form.util.ts` | `buildPersonDataFormGroup`, `combinePhoneNumber`/`splitPhoneNumber` (país + número ↔ E.164 via `libphonenumber-js`), `getCountryOptions` |
| `features/dependents/pending-dependents/pending-dependents.component.ts` | Ruta `/pending-dependents`. Completa **un dependent alhora**, torna a demanar la llista entre cada enviament |
| `core/services/dependents.service.ts` | `getPending()` / `completePending(payload)` |
| `core/auth/services/auth.service.ts` | + `getInviteContext(token)`, `registerViaInvite(payload)` |
| `features/home/home.component.ts` | Banner de dependents pendents (`GET /me/pending-dependents` via `rxResource`) |

### Shared (`libs/shared/src/`)

| Fitxer | Contingut |
|--------|-----------|
| `enums/client-type.enum.ts` | `ClientType.DASHBOARD \| ClientType.PWA` |
| `interfaces/auth.interfaces.ts` | `JwtPayload`, `PersonSummary`, `UserProfile` |
| `interfaces/invite.interfaces.ts` | `InviteLinkResponse`, `PersonRegistrationData`, `RegisterViaInviteRequest`, `InviteRegistrationContext` |
| `interfaces/me/pending-dependent.interface.ts` | `PendingDependent`, `DependentRegistrationRequest` |

---

## Variables d'entorn

| Variable | Exemple | Descripció |
|----------|---------|------------|
| `JWT_SECRET` | `strong-random-64-chars` | Secret per signar access tokens |
| `JWT_ACCESS_TTL` | `900` | Vida access token en segons (15 min) |
| `JWT_REFRESH_TTL_DASHBOARD` | `28800` | Vida refresh token Dashboard en segons (8h) |
| `JWT_REFRESH_TTL_PWA` | `604800` | Vida refresh token PWA en segons (7 dies) |
| `REFRESH_TOKEN_COOKIE` | `muixer_rt` | Nom de la cookie httpOnly |
| `SETUP_TOKEN` | `uuid-aleatori` | Token per al bootstrap endpoint. Eliminar en prod |
| `CORS_ORIGINS` | `http://localhost:4200,http://localhost:4300` | Orígens permesos (comma-separated) |
| `PWA_SITE_ADDRESS` | `localhost:4300` | Host usat per construir `inviteUrl` (`/activate?token=`) |
| `INVITE_TOKEN_TTL_HOURS` | `72` | Vida del token d'invitació en hores |

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

---

*Veïns: [[SSE_AUTH]] · [[DATA_MODEL]] · [[DEBT]] · [[MAP]]*
