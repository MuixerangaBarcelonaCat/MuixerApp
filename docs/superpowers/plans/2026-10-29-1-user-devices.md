# Dispositius de l'usuari (sessions + subscripcions push) — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un ADMIN pot veure, per a qualsevol compte, les sessions obertes (refresh tokens) i els dispositius subscrits a push; pot fer expirar una sessió o totes, eliminar una subscripció i enviar una notificació de prova a un dispositiu.

**Architecture:** Backend: endpoints nous sota `users/:id/…` a `UserController` (ADMIN), que deleguen en `TokenService` (sessions = famílies de refresh token) i `PushSubscriptionService`. Una migració afig `userAgent` a `refresh_tokens` (sense això les sessions no es distingeixen) i tres valors a `audit_action_enum`. Frontend: un modal standalone `app-user-devices-modal` obert des de dos llocs: acció de fila «Dispositius» a `/config/users` i fila de `/communication/notifications/devices`.

**Tech Stack:** NestJS 11, TypeORM 0.3, Jest; Angular 21 (standalone, OnPush, Signals), `@muixer/ui` (`lib-modal`, `lib-button`, `lib-badge`, `lib-alert`, `lib-empty-state`), Vitest.

**Spec:** cap document separat; les decisions són a §Decisions (venen de la petició de l'usuari del 2026-10-29).

## Decisions

- **On viu:** el modal és per compte d'usuari (les sessions són del `User`, no de la `Person`). Entrada principal: `/config/users`, acció de fila «Dispositius» (només ADMIN, com «Assignar rol»). Entrada secundària: la pantalla existent «Dispositius subscrits» (Comunicació) obri el mateix modal en clicar una fila; per a això `DeviceSummary` guanya `userId`.
- **Sessió = família** de refresh tokens (`family`). Activa ≡ té alguna fila amb `revokedAt IS NULL AND usedAt IS NULL AND expiresAt > now()`.
- **Fer expirar** = revocar la família (o totes). El JWT d'accés (15 min) **no** es talla: `JwtStrategy` no consulta la BD. La UI ho diu. `ponytail:` si cal tall immediat, afegir `users.tokensValidAfter` i comprovar-lo a `JwtStrategy.validate` (una consulta per petició).
- **Eliminar subscripció** = `isActive=false` (el patró existent; el navegador la pot tornar a registrar si el membre reactiva les notificacions a la PWA).
- **Prova** = `PushSenderService.send` directe a eixa subscripció, síncron, per a retornar si ha funcionat. Si el servei de push respon `gone`, es desactiva.
- Només ADMIN (dades de seguretat). Auditat.

## Global Constraints

- Textos de UI en valencià: imperatiu 2a singular per a botons («Fes expirar», «Elimina», «Envia una prova»), «vós» per a missatges (`.agents/skills/language-rules/SKILL.md`). Codi i commits en anglés.
- Components standalone + OnPush + Signals; `input()`/`output()`. Només `@muixer/ui` i tokens; cap hex ni valor arbitrari de Tailwind.
- Endpoints: `@Roles(UserRole.ADMIN)` explícit al mètode (la classe `UserController` admet també TECHNICAL).
- Llistes: aquí no cal paginació (màxim 10 subscripcions per usuari; sessions actives poques) — retornen arrays directes.
- Sense `Co-Authored-By` als commits.
- Migració nova: `apps/api/src/migrations/1786800000000-AddRefreshTokenUserAgent.ts`, registrada a `migrations/index.ts`.
- Manual: `docs/manual/` pàgines de `/config/users` (`grep -rl "rutes:.*/config/users" docs/manual`) i `docs/manual/18-comunicacio.md`; captures amb `pnpm run docs:manual-shots`.

## Review Focus

- Revocar una sessió d'un **altre** usuari passant un `family` que no és seu: 404, no revoca res.
- Esborrar/provar una subscripció d'un altre usuari pel seu `id`: 404.
- L'admin fa expirar totes les seues pròpies sessions: el dashboard actual continua fins al pròxim refresh i aleshores el porta a `/login` (sense bucle d'errors).
- Usuari sense cap sessió ni subscripció: modal amb dos estats buits, cap error.
- Prova a una subscripció caducada (`gone`): la resposta diu `gone: true`, la fila desapareix en recarregar.

---

### Task 1: Migració + `userAgent` en crear refresh tokens

**Files:**
- Create: `apps/api/src/migrations/1786800000000-AddRefreshTokenUserAgent.ts`
- Modify: `apps/api/src/migrations/index.ts`, `apps/api/src/modules/auth/entities/refresh-token.entity.ts`, `apps/api/src/modules/auth/token.service.ts:46`, `apps/api/src/modules/auth/auth.service.ts:144` (`login`), `apps/api/src/modules/auth/auth.controller.ts:85-116` (login + refresh), `libs/shared/src/enums/audit-action.enum.ts`
- Test: `apps/api/src/modules/auth/token.service.spec.ts`

**Interfaces:**
- Produces: `RefreshToken.userAgent: string | null` (varchar 255); `createRefreshToken(user, clientType, family?, userAgent?: string | null)`; `AuditAction.USER_SESSIONS_REVOKED`, `AuditAction.PUSH_SUBSCRIPTION_REMOVED`.

- [ ] **Step 1: Test que falla** — `createRefreshToken(user, ClientType.PWA, undefined, 'Mozilla/5.0 X')` desa una entitat amb `userAgent: 'Mozilla/5.0 X'`; un UA de 300 caràcters es desa truncat a 255.
- [ ] **Step 2:** `nx test api --testFile=apps/api/src/modules/auth/token.service.spec.ts` → FAIL.
- [ ] **Step 3: Implementa.** Migració: `ALTER TABLE "refresh_tokens" ADD "userAgent" varchar(255)` + `ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS` per als dos valors (patró de `1786500000000-CreateCollaSettings.ts:50`); `down` només treu la columna. `rotateRefreshToken` hereta `stored.userAgent` si la petició no en porta. El controller llig `req.headers['user-agent']` a login i refresh i el passa avall.
- [ ] **Step 4:** test → PASS; `nx run api:migration-run` en local aplica la migració sense errors.
- [ ] **Step 5: Commit** `feat(api): store user agent on refresh tokens`

---

### Task 2: Sessions d'un usuari (llistar / fer expirar)

**Files:**
- Modify: `apps/api/src/modules/auth/token.service.ts`, `apps/api/src/modules/user/user.controller.ts`, `apps/api/src/modules/user/user.module.ts` (si `TokenService` no hi és ja injectat: `user.service.ts:38` ja l'usa)
- Create: `libs/shared/src/interfaces/user-device.interfaces.ts` (+ export a `libs/shared/src/index.ts`)
- Test: `apps/api/src/modules/auth/token.service.spec.ts`, `apps/api/src/modules/user/user.controller.spec.ts`

**Interfaces:**
- Produces:
  - `interface UserSession { family: string; clientType: ClientType; userAgent: string | null; startedAt: string; lastRefreshAt: string; expiresAt: string }`
  - `TokenService.listActiveSessions(userId: string): Promise<UserSession[]>` — agrupat per `family`, `startedAt = MIN(createdAt)`, `lastRefreshAt = MAX(createdAt)`, `expiresAt = MAX(expiresAt)`, `userAgent` de la fila més nova; només famílies amb alguna fila activa; ordre `lastRefreshAt DESC`.
  - `TokenService.revokeFamily(userId: string, family: string): Promise<number>` — `UPDATE … SET revokedAt=now() WHERE userId AND family AND revokedAt IS NULL`; retorna files afectades.
  - `GET users/:id/sessions` → `UserSession[]`
  - `DELETE users/:id/sessions/:family` → 204 (404 si `revokeFamily` retorna 0)
  - `DELETE users/:id/sessions` → 204 (reutilitza `revokeAllUserTokens`)

- [ ] **Step 1: Tests que fallen** (unit amb repo mock, com la resta de `token.service.spec.ts`): `revokeFamily` filtra per `userId` **i** `family`; `listActiveSessions` mapeja les files crues a `UserSession`. Controller: les tres rutes criden el servei, `DELETE …/:family` amb 0 → `NotFoundException`, i cada DELETE crida `auditService.record({ action: USER_SESSIONS_REVOKED, targetType: 'User', targetId: id, metadata: { family | 'all' } })`.
- [ ] **Step 2:** `nx test api --testFile=…token.service.spec.ts` i `…user.controller.spec.ts` → FAIL.
- [ ] **Step 3:** Implementa; `@Roles(UserRole.ADMIN)` a cada mètode, `ParseUUIDPipe` a `:id` i `:family`. Swagger `@ApiOperation` en valencià com la resta del controller.
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5: Commit** `feat(api): admin endpoints to list and revoke user sessions`

---

### Task 3: Subscripcions push d'un usuari (llistar / eliminar / provar)

**Files:**
- Modify: `apps/api/src/modules/push-notification/push-subscription.service.ts`, `apps/api/src/modules/user/user.controller.ts`, `apps/api/src/modules/user/user.module.ts` (importa el que exporte `PushNotificationModule`; si crea cicle, posa les rutes en un controller nou `push-notification/user-push-subscription.controller.ts` amb el mateix prefix `users/:id/push-subscriptions`), `libs/shared/src/interfaces/user-device.interfaces.ts`, `libs/shared/src/interfaces/push-notification.interfaces.ts` (`DeviceSummary.userId`), `push-subscription.service.ts:120` (`getSummary` selecciona `user.id`)
- Test: `apps/api/src/modules/push-notification/push-subscription.service.spec.ts`, controller spec corresponent

**Interfaces:**
- Produces:
  - `interface UserPushDevice { id: string; userAgent: string | null; createdAt: string; lastUsedAt: string | null }`
  - `PushSubscriptionService.listActiveForUser(userId): Promise<UserPushDevice[]>` (ordre `createdAt DESC`, mai exposa `endpoint` ni `keys`)
  - `PushSubscriptionService.deactivateForUser(userId, id): Promise<boolean>`
  - `PushSubscriptionService.sendTest(userId, id): Promise<{ success: boolean; gone: boolean }>` — `PushSenderService.send(sub, { title: 'Notificació de prova', body: 'Este dispositiu rep les notificacions de MuixerApp.', icon: '/icons/icon-192.png' })`; si `success` → `markUsedMany([id])`, si `gone` → `deactivateMany([id])`.
  - `GET users/:id/push-subscriptions` → `UserPushDevice[]`; `DELETE users/:id/push-subscriptions/:subId` → 204/404; `POST users/:id/push-subscriptions/:subId/test` → `{ success, gone }` (404 si no és seua o inactiva)
  - `DeviceSummary.userId: string`

- [ ] **Step 1: Tests que fallen:** `deactivateForUser` amb `id` d'un altre usuari → `false` i no actualitza; `sendTest` amb resultat `gone` crida `deactivateMany([id])`; la resposta de `listActiveForUser` no té `endpoint`/`keys`; el DELETE audita `PUSH_SUBSCRIPTION_REMOVED`.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** Implementa; `@Roles(UserRole.ADMIN)`.
- [ ] **Step 4:** tests → PASS; `nx test api` sencer verd (el canvi de `DeviceSummary` toca specs existents).
- [ ] **Step 5: Commit** `feat(api): admin endpoints to manage a user's push subscriptions`

---

### Task 4: Modal «Dispositius» al dashboard

**Files:**
- Create: `apps/dashboard/src/app/features/config/components/user-devices-modal/user-devices-modal.component.{ts,html,spec.ts}`, `apps/dashboard/src/app/features/config/services/user-devices.service.ts`
- Modify: `apps/dashboard/src/app/features/config/components/user-list.component.{ts,html}` (acció de fila ADMIN, `icon: 'Smartphone'`, label `Dispositius`), `apps/dashboard/src/app/features/communication/components/device-list/device-list.component.{ts,html}` (fila clicable obri el modal amb `row.userId`, només si `isAdmin()`)

**Interfaces:**
- Consumes: endpoints de Task 2 i 3; `UserSession`, `UserPushDevice` de `@muixer/shared`.
- Produces: `<app-user-devices-modal [userId]="…" [userLabel]="…" (closed)="…" />`; `UserDevicesService { sessions(id), revokeSession(id, family), revokeAll(id), devices(id), removeDevice(id, subId), testDevice(id, subId) }`.

Contingut del modal (dues seccions):
- **Sessions obertes:** per fila, badge `Dashboard`/`App`, navegador resumit del UA (`navegador · sistema`, regla senzilla per substring: Chrome/Firefox/Safari/Edge × Android/iOS/Windows/macOS/Linux; si no, «Dispositiu desconegut»), «Inici» i «Darrer ús» en `dd/MM/yyyy HH:mm`. Botó per fila «Fes expirar» i, a la capçalera, «Fes expirar totes». Nota sota el títol: «La sessió es tanca del tot en un màxim de 15 minuts.»
- **Notificacions:** per fila, navegador resumit, «Alta» i «Darrera notificació» (o «Mai»). Botons «Envia una prova» (toast «S'ha enviat la notificació de prova.» / «El dispositiu ja no existeix i s'ha eliminat.» / «No s'ha pogut enviar la notificació.») i «Elimina».
- Estats buits: «Cap sessió oberta.» / «Cap dispositiu rep notificacions.»

- [ ] **Step 1: Tests que fallen** (Vitest, `allLucideIconsProvider`, `HttpTestingController`): en obrir carrega les dues llistes; «Fes expirar» fa `DELETE /api/users/u1/sessions/f1` i treu la fila; «Envia una prova» amb `{ success:false, gone:true }` treu la fila; la funció pura `describeUserAgent(ua: string | null): string` retorna `'Chrome · Android'` per a un UA de Chrome Android i `'Dispositiu desconegut'` per a `null`. `user-list` mostra l'acció només a ADMIN.
- [ ] **Step 2:** `nx test dashboard --testFile=…user-devices-modal.component.spec.ts` → FAIL.
- [ ] **Step 3:** Implementa (`describeUserAgent` exportada des del fitxer del component, no cal util a part).
- [ ] **Step 4:** tests → PASS; `nx lint dashboard`.
- [ ] **Step 5:** Manual: secció «Dispositius d'un compte» a la pàgina de `/config/users` i nota a `18-comunicacio.md`; `pnpm run docs:manual-shots`.
- [ ] **Step 6: Commit** `feat(dashboard): user devices modal (sessions and push subscriptions)`
