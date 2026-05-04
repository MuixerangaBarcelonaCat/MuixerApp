# Integracions Externes — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Veure `docs/API_APPSISTENCIA.md` per al catàleg complet d'endpoints del legacy.  
> Veure `docs/AUTH_FLOW.md` per al flux d'autenticació detallat.

---

## 1. Inventari d'Integracions

| Sistema | Tipus | Propòsit | Autenticació | Criticitat | Evidència |
|---------|-------|----------|--------------|------------|-----------|
| **NeonDB (PostgreSQL)** | Base de dades | Font de veritat de totes les dades de MuixerApp | `DATABASE_URL` (connection string) | Alta | `modules/database/database.module.ts` |
| **APPsistència legacy** | API REST (PHP) + XLSX | Migració de dades: persones, events, assistència | Cookie PHP (`PHPSESSID`) via login per formulari | Temporal (fins al tall) | `modules/sync/legacy-api.client.ts` |
| **JWT (intern)** | Mecanisme d'auth | Autenticació i autorització de l'API | Tokens firmats amb `JWT_SECRET` / `JWT_REFRESH_SECRET` | Alta | `modules/auth/` |
| **Swagger UI** | Documentació API | Interfície de consulta dels endpoints REST | Bearer token (via UI) | Baixa | `apps/api/src/main.ts` |

---

## 2. Base de Dades

| Aspecte | Detall | Evidència |
|---------|--------|-----------|
| **Sistema** | PostgreSQL gestionat per Neon (serverless) | `.env.example` → `DATABASE_URL` |
| **Versió** | PostgreSQL compatible (Neon gestiona la versió) | [TODO] verificar versió exacta a Neon |
| **ORM** | TypeORM 0.3.28 | `package.json` dependencies |
| **Capa d'accés** | Repositoris TypeORM injectats als serveis via `@InjectRepository()` | `person.service.ts`, `event.service.ts` |
| **Connexió** | Pool de connexions gestionat per TypeORM | `database.module.ts` |
| **Migracions** | [TODO] No hi ha fitxers de migració identificats; TypeORM `synchronize` en dev | `database.module.ts` — verificar configuració |
| **Seed** | `seed.command.ts` (nest-commander) — stub pendent d'implementar | `modules/database/seeds/seed.command.ts` |

### Entitats principals

| Entitat | Taula DB | Notes |
|---------|----------|-------|
| `Person` | `persons` | Membre de la colla. `legacyId` per traçabilitat sync |
| `User` | `users` | Compte d'accés. OneToOne opcional a Person |
| `Event` | `events` | Assaig o actuació. `legacyId` + `legacyType` |
| `Season` | `seasons` | Temporada. Hardcoded al `EventSyncStrategy` |
| `Attendance` | `attendances` | Assistència d'una Person a un Event |
| `Position` | `positions` | Posició muixeranguera (Baix, Segon, etc.) |
| `RefreshToken` | `refresh_tokens` | Tokens de refresc JWT amb rotació |

> Veure `docs/DATA_MODEL.md` per al diagrama ER complet amb tots els camps.

---

## 3. APPsistència Legacy (Integració Temporal)

Servei extern PHP (`muixerangadebarcelona.appsistencia.cat`) que conté les dades historials de la colla. La integració és **unidireccional** (legacy → MuixerApp) i s'activa **manualment** des del Dashboard.

### Client HTTP: `legacy-api.client.ts`

| Mètode | Endpoint legacy | Dades obtingudes |
|--------|----------------|-----------------|
| `login()` | `POST /` | Estableix sessió PHP (cookie `PHPSESSID`) |
| `getCastellers()` | `GET /api/castellers` | Llista de totes les persones (JSON) |
| `getAssajos()` | `GET /api/assajos` | Llista d'assajos amb resum d'assistència |
| `getAssaigDetail(id)` | `GET /api/assajos/{id}` | Detall: lloc, hora final, informació |
| `getActuacions()` | `GET /api/actuacions` | Llista d'actuacions |
| `getActuacioDetail(id)` | `GET /api/actuacions/{id}` | Detall: colles, transport, etc. |
| `getAssistenciesXlsx(id)` | `GET /assistencia-export/{id}` | Fitxer `.xlsx` amb assistència completa |

> ⚠️ **Important**: el JSON endpoint `/api/assistencies/{id}` **no s'usa** — el XLSX és la font preferida perquè inclou les persones que no han respost (`null`) i els "No vinc".

### Particularitats del legacy

- Requereix `User-Agent` real (WAF amb 403 sense UA)
- Dates en format `DD/MM/YYYY`, timestamps `DD/MM/YYYY HH:MM:SS`
- L'`event_id` s'extreu amb regex del camp HTML `"0"` (no és un camp directe JSON)
- Sessió via cookie PHP `PHPSESSID` — cal fer GET a `/` abans del POST de login

---

## 4. Autenticació JWT (Integració Interna)

> Veure `docs/AUTH_FLOW.md` per al flux complet.

| Component | Detall |
|-----------|--------|
| **Access token** | JWT firmat amb `JWT_SECRET`, vida: 15 min (`JWT_ACCESS_TTL=900`) |
| **Refresh token** | JWT firmat amb `JWT_REFRESH_SECRET`, guardat com SHA-256 hash a DB |
| **Vida refresh (Dashboard)** | 8 hores (`JWT_REFRESH_TTL_DASHBOARD=28800`) |
| **Vida refresh (PWA)** | 7 dies (`JWT_REFRESH_TTL_PWA=604800`) |
| **Cookie** | `muixer_rt` — httpOnly, sameSite: lax, secure en producció |
| **Rate limiting** | `@nestjs/throttler` — 10 req/60s per IP als endpoints `/auth/` |
| **Biblioteca** | `@nestjs/jwt`, `passport-jwt`, `passport-local`, `bcrypt` |

---

## 5. Secrets i Credencials

- **Font**: fitxer `.env` (copiar de `.env.example`). **Mai al repositori** (`.gitignore` inclou `.env`)
- **Credencials del legacy** (`LEGACY_API_USERNAME`, `LEGACY_API_PASSWORD`): secrets de l'usuari de lectura del sistema legacy
- **JWT secrets**: dues claus separades (`JWT_SECRET` per a access, `JWT_REFRESH_SECRET` per a refresh)
- **`SETUP_TOKEN`**: token d'un sol ús per crear el primer usuari TECHNICAL. Ha d'eliminar-se del `.env` en producció
- **Cap credencial hardcoded** identificada al codi font

---

## 6. Fiabilitat i Comportament en Fallades

| Integració | Comportament en fallada | Retry / Fallback |
|------------|------------------------|-----------------|
| **NeonDB** | TypeORM llança excepció → NestJS retorna 500 | Cap retry automàtic configurat |
| **Legacy APPsistència** | `LegacyApiClient` llança error → SSE envia event d'error al client | Cap retry — l'usuari pot re-llançar manualment |
| **JWT refresh** | Si el refresh falla (token revocat/expirat) → `AuthService` fa `clearState()` + redirect a `/login` | L'interceptor intenta el refresh una sola vegada per request fallida |

---

## 7. Observabilitat

| Aspecte | Estat |
|---------|-------|
| **Logging** | `LatencyInterceptor` afegeix `X-Response-Time` a totes les respostes. NestJS `Logger` als punts d'inici i error. | 
| **Mètriques** | Cap sistema de mètriques configurat (Prometheus, Datadog, etc.) |
| **APM / Tracing** | Cap APM configurat |
| **CI/CD** | Cap pipeline CI/CD configurat al repositori |

---

## 8. Camps de Traçabilitat del Legacy (a eliminar)

Quan el sistema legacy quedi retirat, cal eliminar els camps `legacy*` i `lastSyncedAt` de les entitats, i el mòdul `sync/` sencer.

| Entitat | Camps a eliminar |
|---------|-----------------|
| `persons` | `legacyId`, `lastSyncedAt` |
| `events` | `legacyId`, `legacyType`, `lastSyncedAt` |
| `attendances` | `legacyId`, `lastSyncedAt` |
| `seasons` | `legacyId` |

> Veure `docs/SYNC_ARCHITECTURE.md §5` per a la llista completa de tasques de desconnexió.

---

## 9. Evidència

- `apps/api/src/modules/sync/legacy-api.client.ts` — client HTTP legacy
- `apps/api/src/modules/database/database.module.ts` — connexió TypeORM/NeonDB
- `apps/api/src/modules/auth/` — sistema JWT complet
- `.env.example` — totes les variables d'entorn requerides
- `docs/API_APPSISTENCIA.md` — catàleg complet d'endpoints del legacy
- `docs/AUTH_FLOW.md` — flux d'autenticació detallat
- `docs/SYNC_ARCHITECTURE.md` — arquitectura de sincronització
