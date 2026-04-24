# Arquitectura — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Veure `docs/AUTH_FLOW.md` per al flux detallat d'autenticació.  
> Veure `docs/DATA_MODEL.md` per al diagrama ER complet.  
> Veure `docs/SYNC_ARCHITECTURE.md` per a la sincronització amb el sistema legacy.

---

## 1. Estil Arquitectònic

**Monorepo de dues aplicacions + biblioteca compartida**, amb arquitectura en capes (layered) al backend i arquitectura basada en features (feature-based) al frontend.

| Aplicació | Estil | Raó |
|-----------|-------|-----|
| Backend (`apps/api`) | Layered (controller → service → repository/entity) | Patró estàndard NestJS amb mòduls DI |
| Frontend (`apps/dashboard`) | Feature-based amb components standalone | Angular 21 standalone, signals, OnPush |
| Shared (`libs/shared`) | Biblioteca plana d'enums i interfaces | Tipus compartits sense lògica |

**Restriccions principals:**
1. Tot el codi és TypeScript estricte — cap `any`.
2. La biblioteca `@muixer/shared` és l'única font de veritat per a enums i interfaces intercanviats entre backend i frontend.
3. La sincronització amb el legacy és **unidireccional** i **manual** — cap job automàtic.

---

## 2. Flux del Sistema (Request HTTP)

```
Client (Dashboard/PWA)
        │
        │  HTTP + Authorization: Bearer <accessToken>
        ▼
[NestJS — apps/api/src/main.ts]
   │ GlobalPrefix: /api
   │ ValidationPipe (whitelist, transform)
   │ CookieParser
   ▼
[APP_GUARDS — app.module.ts]
   ├── ThrottlerGuard          → Rate limiting (100 req/60s per IP)
   ├── JwtAuthGuard (global)   → Verifica Bearer token. @Public() = bypass
   └── RolesGuard (global)     → Verifica rol. @Roles() = restricció
        │
        ▼
[Controller — e.g. PersonController]
   │ @ApiTags, @ApiOperation, class-validator via DTO
   │ Extreu paràmetres, crida el servei
   ▼
[Service — e.g. PersonService]
   │ Lògica de negoci, validacions complexes
   │ Accés a dades via TypeORM Repository
   ▼
[TypeORM + PostgreSQL (NeonDB)]
   │ Entitats: Person, User, Event, Season, Attendance, Position, RefreshToken
   ▼
[Resposta HTTP — 200/201/400/401/403/404/409/422]
```

---

## 3. Responsabilitats per Capa

### Backend

| Capa | Responsabilitat | No ha de contenir | Evidència |
|------|-----------------|-------------------|-----------|
| **Controller** | Gestionar HTTP, validar paràmetres via DTO, delegar al servei | Lògica de negoci | `person.controller.ts` |
| **Service** | Lògica de negoci, transaccions, upserts complexos | Lògica HTTP, accés directe a DB sense TypeORM | `person.service.ts` |
| **Entity** | Definició del model de dades TypeORM | Lògica de negoci | `person.entity.ts` |
| **DTO** | Validació d'entrada (class-validator) i documentació Swagger (@ApiProperty) | Lògica de transformació complexa | `create-person.dto.ts` |
| **Strategy (Sync)** | Orquestrar la sincronització d'una entitat específica des del legacy | Persistir directament sense upsert idempotent | `person-sync.strategy.ts` |
| **Guard** | Protecció transversal (auth, rols) | Lògica de negoci | `jwt-auth.guard.ts` |
| **Module** | Registrar providers, imports, exports NestJS DI | Inicialitzar app (responsabilitat de `main.ts`) | `auth.module.ts` |

### Frontend

| Capa | Responsabilitat | No ha de contenir | Evidència |
|------|-----------------|-------------------|-----------|
| **Feature Component** | Presentació i interacció de l'usuari, coordinació via signals | Crides HTTP directes | `person-list.component.ts` |
| **Service (feature)** | Crides HTTP via `ApiService`, transformació de respostes | Estat global de l'app | `person.service.ts` |
| **Shared Component** | Component reutilitzable sense lògica de domini | Crides HTTP, conèixer rutes específiques | `data-table.component.ts` |
| **Core Service** | Estat global (auth, layout), interceptors, guards | Lògica de domini de features | `auth.service.ts` |
| **Guard** | Protecció de rutes (authGuard, rolesGuard) | Crides HTTP, modificar estat | `auth.guard.ts` |

---

## 4. Patrons Reutilitzats

| Patró | On s'aplica | Per què existeix |
|-------|-------------|-----------------|
| **Strategy** | `modules/sync/strategies/` | Permetre sincronitzar cada entitat de forma independent i composable |
| **Repository** (TypeORM) | Tots els serveis del backend | Abstracció sobre PostgreSQL; facilita tests amb mocks |
| **Guard global (APP_GUARD)** | `app.module.ts` | Aplicar autenticació i autorització a tots els endpoints sense decoradors per ruta |
| **Decorator personalitzat** | `auth/decorators/` | `@Public()`, `@Roles()`, `@CurrentUser()` — API declarativa neta |
| **Signal-based state** | `core/auth/services/auth.service.ts` | Reactivitat lleugera sense RxJS complexitat (Angular 21) |
| **Refresh token amb rotació** | `token.service.ts` | Seguretat: cada ús invalida el token anterior; detecció de reutilització revoca la família |
| **SSE (Server-Sent Events)** | `sync.controller.ts` | Streaming de progrés de la sincronització en temps real al dashboard |
| **Lazy loading** | `app.routes.ts` | Reduir el bundle inicial del dashboard; cada feature es carrega sota demanda |
| **OnPush + Signals** | Tots els components del dashboard | Evitar detecció de canvis innecessària; render determinista |
| **PartialType de @nestjs/swagger** | `update-event.dto.ts` | Hereta @ApiProperty del DTO de creació; evita duplicació de documentació |

---

## 5. Flux d'Autenticació (Resum)

> Veure `docs/AUTH_FLOW.md` per al diagrama complet.

```
Login (POST /api/auth/login)
  → LocalStrategy valida email + password (bcrypt)
  → AuthService genera accessToken (JWT 15min) + refreshToken (JWT 8h/7d)
  → refreshToken guardat com a SHA-256 hash a DB (refresh_tokens)
  → Client rep: { accessToken } + cookie httpOnly muixer_rt

Petició autenticada
  → Interceptor Angular afegeix Authorization: Bearer <accessToken>
  → JwtAuthGuard valida el token
  → Si 401 → interceptor crida /auth/refresh → actualitza token → reintenta

Refresh (POST /api/auth/refresh)
  → Llegeix cookie muixer_rt
  → TokenService: valida + rotació (nou token, invalida l'anterior)
  → Detecció de reutilització: si token ja usat → revocar família sencera
```

---

## 6. Flux de Sincronització (Resum)

> Veure `docs/SYNC_ARCHITECTURE.md` per a la documentació completa.

```
Tècnic prem "Sincronitzar" al Dashboard
  → GET /api/sync/persons  (SSE)
  → PersonSyncStrategy:
      legacyApiClient.login() → sessió PHP
      legacyApiClient.getCastellers() → JSON amb totes les persones
      Per cada persona: upsert a DB (merge strategy)
      Emetre events SSE de progrés
  → GET /api/sync/events  (SSE)
  → EventSyncStrategy:
      getAssajos() + getAssaigDetail() per cada assaig
      getActuacions() + getActuacioDetail() per cada actuació
      Upsert events + AttendanceSyncStrategy per cada event (XLSX)
```

---

## 7. Risks Arquitectònics Coneguts

| Risc | Impacte | Mitigació actual |
|------|---------|-----------------|
| **Temporades hardcoded** al `EventSyncStrategy` | Temporades futures no es creen automàticament; cal modificar el codi | Documentat a `SYNC_ARCHITECTURE.md` — pendent CRUD de temporades |
| **Sync manual sense idempotència garantida per attendances** | Una re-sync pot sobreescriure notes editades manualment | La flag `manuallyOverridden` és pendent d'implementar |
| **`LegacyApiClient` usa sessió PHP amb cookies** | Si el legacy canvia el flux de login, la sync es trenca | Verificat periòdicament durant la migració activa |
| **ToastService existent però no cridat des de features** | Errors i confirmacions silenciosos per a l'usuari | Infraestructura preparada per a P5+; documentat a `CONCERNS.md` |
| **Cap CI/CD configurat** | Regressió possible sense validates automàtics | Tests manuals + checklist de validació (`VALIDATION_CHECKLIST.md`) |
| **Sidebar obsoleta referenciada en historial de git** | Arxius residuals potencials | Netejat a P4.3; cap referència a `sidebar` al codi actual |

---

## 8. Evidència

- `apps/api/src/app/app.module.ts` — guards globals, imports de mòduls
- `apps/api/src/main.ts` — bootstrap, pipes globals, CORS
- `apps/api/src/modules/auth/` — patró auth complet
- `apps/api/src/modules/sync/strategies/` — patró Strategy per sincronització
- `apps/dashboard/src/app/core/auth/services/auth.service.ts` — signal-based state
- `apps/dashboard/src/app/app.routes.ts` — lazy loading per feature
- `docs/AUTH_FLOW.md` — flux d'autenticació detallat
- `docs/SYNC_ARCHITECTURE.md` — arquitectura de sincronització
- `docs/DATA_MODEL.md` — model de dades i diagrama ER
