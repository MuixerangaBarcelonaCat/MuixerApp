# MuixerApp

APPsistència 2.0 — Sistema de gestió d'assistència i figures per a Muixerangues.

## Stack Tecnològic

- **Backend**: NestJS + TypeScript + TypeORM + PostgreSQL (Docker local / VPS)
- **Frontend Dashboard**: Angular 21+ (standalone, signals, OnPush) + Tailwind CSS v3 + DaisyUI + Angular CDK
- **Mobile**: Angular PWA (scaffold — pendent P6)
- **Monorepo**: Nx workspace

> **Nota**: Utilitzem Tailwind CSS v3 + DaisyUI v4 per estabilitat i compatibilitat.

## Estructura del Projecte

```
apps/
  api/          → Backend NestJS
  dashboard/    → Dashboard web Angular
  pwa/          → PWA mòbil (scaffold)
libs/
  shared/       → Codi compartit (enums, interfaces)
docs/
  specs/        → Especificacions tècniques
  archive/      → Documentació històrica
scripts/
  appsistencia_extractor.py  → Extractor de dades legacy (opcional)
```

## Documentació


| Document                                                         | Descripció                               |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `[docs/INDEX.md](docs/INDEX.md)`                                 | **Índex complet de la documentació** ⭐   |
| `[docs/PROJECT_ROADMAP.md](docs/PROJECT_ROADMAP.md)`             | Visió general i estat dels sub-projectes |
| `[docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md)`               | Estat actual i pròxims passos            |
| `[docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md)`                   | Setup ràpid amb Docker                   |
| `[docs/DOCKER_ARCHITECTURE.md](docs/DOCKER_ARCHITECTURE.md)`     | Arquitectura Docker (dev + producció)    |
| `[docs/codebase/STACK.md](docs/codebase/STACK.md)`               | Stack tecnològic complet                 |
| `[docs/codebase/ARCHITECTURE.md](docs/codebase/ARCHITECTURE.md)` | Arquitectura i patrons de disseny        |
| `[docs/AUTH_FLOW.md](docs/AUTH_FLOW.md)`                         | Flux d'autenticació JWT + Passport       |
| `[docs/DATA_MODEL.md](docs/DATA_MODEL.md)`                       | Model de dades i diagrama ER             |
| `[docs/specs/](docs/specs/)`                                     | Especificacions tècniques aprovades      |
| `[docs/API_APPSISTENCIA.md](docs/API_APPSISTENCIA.md)`           | API legacy per migració de dades         |


## Arrencada ràpida (primera vegada)

Guia per arrencar el projecte en local amb **base de dades buida**. Les dades (persones, events, temporades…) s'importen després via dashboard (sincronització legacy) o des del CRUD.

### Versions requerides

| Eina | Versió | Comprovar |
| ---- | ------ | --------- |
| **Node.js** | **22.16.0** (veure `.node-version`) | `node -v` |
| **pnpm** | **9.x** (veure `packageManager` al `package.json`) | `pnpm -v` |
| **Docker Desktop** | recent | `docker --version` |

> Rang suportat de Node: `>=22.13.0 <23.0.0`. Si no tens pnpm: `corepack enable && corepack prepare pnpm@9 --activate`

### Migracions de base de dades

| Entorn | Quan s'executen |
| ------ | --------------- |
| **Dev local** (`pnpm run dev:api`) | **Automàticament** en arrencar l'API (`migrationsRun: true` quan `NODE_ENV=development`) |
| **Manual** (si cal) | `pnpm run migration:run` |
| **Pre/Prod (Docker)** | Automàticament abans d'iniciar Node (`scripts/docker-entrypoint.sh`) |

No cal executar migracions a mà en el primer arrencada local: en fer `pnpm run dev:api`, TypeORM crea l'esquema i aplica les migracions pendents.

Per veure l'estat:

```bash
pnpm run migration:show
```

### 1. Clonar i instal·lar

```bash
git clone git@github.com:MuixerangaBarcelonaCat/MuixerApp.git
cd MuixerApp
pnpm install
```

### 2. Configurar `.env`

```bash
cp .env.example .env
```

Canvia com a mínim aquests valors al `.env`:

| Variable | Descripció |
| -------- | ---------- |
| `JWT_SECRET` | Secret aleatori per als access tokens |
| `SETUP_TOKEN` | Token per crear el primer usuari (p.ex. un UUID) |
| `LEGACY_API_USERNAME` / `LEGACY_API_PASSWORD` | Només si vols sincronitzar amb Appsistència legacy |

La `DATABASE_URL` per defecte (`localhost:5433`) ja apunta al PostgreSQL de Docker.

### 3. Arrencar PostgreSQL

```bash
pnpm run dev:db
```

Aixeca PostgreSQL 16 a `localhost:5433`.

**Comprovar:**

```bash
docker ps --filter name=muixer-postgres-dev
docker exec muixer-postgres-dev pg_isready -U muixer -d muixer_dev
# Esperat: accepting connections
```

### 4. Arrencar l'API (aplica migracions)

```bash
pnpm run dev:api
```

- API: [http://localhost:3000/api](http://localhost:3000/api)
- Swagger: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

**Comprovar** (en una altra terminal):

```bash
curl -s http://localhost:3000/api/health
# Esperat: {"status":"ok"}
```

Al log de l'API hauries de veure les migracions TypeORM executant-se la primera vegada.

### 5. Crear el primer usuari admin

```bash
curl -X POST http://localhost:3000/api/auth/setup/user \
  -H "X-Setup-Token: <el-teu-SETUP_TOKEN-del-.env>" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "canvia-me-123", "role": "ADMIN"}'
```

**Comprovar** (login):

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "canvia-me-123"}' \
  | head -c 200
```

Hauries de rebre un JSON amb `accessToken`.

### 6. Arrencar el Dashboard

```bash
pnpm run dev:dashboard
```

- Dashboard: [http://localhost:4200](http://localhost:4200)

Inicia sessió amb les credencials del pas 5.

### 7. Omplir dades (opcional)

Des del dashboard, secció **Sincronització** (`/sync`), importa persones i events des del legacy. També pots crear temporades manualment des del CRUD.

> Requereix `LEGACY_API_USERNAME` i `LEGACY_API_PASSWORD` al `.env`.

### Scripts `pnpm` per desenvolupament

| Script | Descripció |
| ------ | ---------- |
| `pnpm run dev:db` | Arrencar PostgreSQL (Docker) |
| `pnpm run dev:api` | Arrencar API en mode watch (+ migracions auto) |
| `pnpm run dev:dashboard` | Arrencar dashboard Angular |
| `pnpm run migration:run` | Aplicar migracions manualment |
| `pnpm run migration:show` | Veure migracions pendents/aplicades |
| `pnpm run docker:down` | Aturar Docker (manté dades) |
| `pnpm run docker:clean` | Aturar Docker i **esborrar volums** (BBDD buida) |

### Resum de ports

| Servei | URL |
| ------ | --- |
| PostgreSQL | `localhost:5433` |
| API | `http://localhost:3000/api` |
| Health check | `http://localhost:3000/api/health` |
| Swagger | `http://localhost:3000/api/docs` |
| Dashboard | `http://localhost:4200` |

> Guia Docker ampliada: [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md)

## Tests

```bash
# Tests de l'API (Jest)
npx nx test api

# Tests del Dashboard (Vitest)
npx nx test dashboard

# Lint
npx nx lint api
npx nx lint dashboard

# CI complet (lint + test + build)
pnpm run ci:local
```

## Scripts Docker


| Script                    | Descripció                      |
| ------------------------- | ------------------------------- |
| `pnpm run docker:up`     | Arrencar PostgreSQL en Docker   |
| `pnpm run docker:down`   | Aturar Docker (manté les dades) |
| `pnpm run docker:clean`  | Netejar tot (elimina volums!)   |
| `pnpm run docker:psql`   | Consola SQL interactiva         |
| `pnpm run docker:prod:up`| Arrencar stack de producció     |
| `pnpm run docker:pre:up` | Arrencar stack de pre-producció |


## Endpoints API

Documentació completa amb Swagger a `http://localhost:3000/api/docs`


| Method   | Route               | Descripció                                |
| -------- | ------------------- | ----------------------------------------- |
| `POST`   | `/api/auth/login`   | Iniciar sessió                            |
| `POST`   | `/api/auth/refresh` | Renovar token d'accés                     |
| `GET`    | `/api/auth/me`      | Perfil de l'usuari autenticat             |
| `GET`    | `/api/persons`      | Llista amb filtres i paginació            |
| `GET`    | `/api/persons/:id`  | Detall d'una persona                      |
| `POST`   | `/api/persons`      | Crear persona                             |
| `PATCH`  | `/api/persons/:id`  | Actualitzar persona                       |
| `DELETE` | `/api/persons/:id`  | Soft delete (isActive = false)            |
| `GET`    | `/api/positions`    | Llista de posicions                       |
| `GET`    | `/api/events`       | Llista d'events amb filtres               |
| `GET`    | `/api/events/:id`   | Detall d'un event                         |
| `GET`    | `/api/seasons`      | Llista de temporades                      |
| `GET`    | `/api/sync/persons` | SSE: sincronitzar persones des del legacy |
| `GET`    | `/api/sync/events`  | SSE: sincronitzar events des del legacy   |


## Funcionalitats implementades

- ✅ **API REST** amb NestJS + TypeORM
- ✅ **Swagger/OpenAPI** documentació interactiva
- ✅ **Autenticació** JWT + Refresh Tokens + Guards
- ✅ **Sincronització** amb l'API legacy (SSE)
- ✅ **Dashboard Angular** amb gestió de persones i events
- ✅ **Tests unitaris** amb Jest (101 API / 22 dashboard)
- ✅ **Docker** per a PostgreSQL local i desplegament a VPS
- ✅ **CI/CD** configurat

## Terminologia

- **Membre**: terme neutre per a qualsevol persona de la colla (mai "casteller")
- **Xicalla**: menors de 16 anys (mai "canalla")
- **Colla**: grup de muixeranga

## Llicència

MIT