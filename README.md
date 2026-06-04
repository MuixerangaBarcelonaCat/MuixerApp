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
  appsistencia_extractor.py  → Extractor de dades legacy
data/
  seeds/        → Dades de referència portables (temporades, etc.)
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


## Setup

### Prerequisits

- Docker Desktop instal·lat i funcionant
- Node.js 22 LTS i npm (veure `.node-version`)

### 1. Instal·lar dependències

```bash
npm install
```

### 2. Configurar variables d'entorn

```bash
cp .env.example .env
# Per defecte ja ve configurat per Docker local
```

### 3. Arrencar la base de dades (Docker)

```bash
npm run docker:up
```

### 4. Arrencar l'API

```bash
nx serve api
# API: http://localhost:3000/api
# Swagger: http://localhost:3000/api/docs
```

### 5. Crear primer admin i importar dades

```bash
# Crear usuari admin via endpoint bootstrap
curl -X POST http://localhost:3000/api/setup/user \
  -H "X-Setup-Token: <SETUP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email": "el-teu-email@example.com", "password": "la-teva-password"}'

# Importar temporades (dades no sincronitzables del legacy)
nx run api:seed-seasons

# Sincronitzar persones i events des del legacy (via dashboard)
```

### 6. Arrencar el Dashboard

```bash
nx serve dashboard
# http://localhost:4200
```

> Per a la guia completa d'onboarding, veure `[docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md)`

## Tests

```bash
# Tests de l'API
npx nx test api

# Tests del Dashboard
npx nx test dashboard

# CI complet (lint + test + build)
npm run ci:local
```

## Scripts Docker


| Script                   | Descripció                      |
| ------------------------ | ------------------------------- |
| `npm run docker:up`      | Arrencar PostgreSQL en Docker   |
| `npm run docker:down`    | Aturar Docker (manté les dades) |
| `npm run docker:clean`   | Netejar tot (elimina volums!)   |
| `npm run docker:psql`    | Consola SQL interactiva         |
| `npm run docker:prod:up` | Arrencar stack de producció     |


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