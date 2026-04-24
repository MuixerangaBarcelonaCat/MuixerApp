# MuixerApp

APPsistència 2.0 — Sistema de gestió d'assistència i figures per a Muixerangues.

## Stack Tecnològic

- **Backend**: NestJS + TypeScript + TypeORM + PostgreSQL (NeonDB)
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
```

## Documentació

| Document | Descripció |
|----------|------------|
| [`docs/INDEX.md`](docs/INDEX.md) | **Índex complet de la documentació** ⭐ |
| [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md) | Visió general i estat dels sub-projectes |
| [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) | Punt actual i pròxims passos |
| [`docs/codebase/STACK.md`](docs/codebase/STACK.md) | Stack tecnològic complet |
| [`docs/codebase/ARCHITECTURE.md`](docs/codebase/ARCHITECTURE.md) | Arquitectura i patrons de disseny |
| [`docs/AUTH_FLOW.md`](docs/AUTH_FLOW.md) | Flux d'autenticació JWT + Passport |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Model de dades i diagrama ER |
| [`docs/specs/`](docs/specs/) | Especificacions tècniques aprovades |
| [`docs/API_APPSISTENCIA.md`](docs/API_APPSISTENCIA.md) | API legacy per migració de dades |
| [`.cursor/rules/`](.cursor/rules/) | Regles per l'agent AI |

## Setup

### 1. Instal·lar dependències

```bash
npm install
```

### 2. Configurar variables d'entorn

```bash
cp .env.example .env
# Editar .env amb la teva DATABASE_URL de NeonDB
```

### 3. Build i executar l'API

**Opció A: Execució directa (recomanat per estabilitat)**
```bash
# Build shared library
npx nx build shared

# Build API
npx nx build api

# Executar
node dist/apps/api/main.js
```

**Opció B: Amb watch mode (hot-reload)**
```bash
# Amb watch (reinicia automàticament en canvis)
npx nx serve api

# Sense watch (més estable)
npx nx serve api --configuration=no-watch
```

L'API estarà disponible a:
- **API**: `http://localhost:3000/api`
- **Swagger**: `http://localhost:3000/api/docs`

### 4. Tests

```bash
# Executar tests de l'API
npx nx test api
```

### 5. Executar el Dashboard

```bash
npx nx serve dashboard
```

El dashboard estarà disponible a `http://localhost:4200`

**Nota**: Si veus errors `EMFILE: too many open files`, pots augmentar el límit:
```bash
ulimit -n 10000
```
Aquests errors no impedeixen que l'aplicació funcioni, només afecten el watch mode.

## Migració de Dades

### 1. Extreure dades del sistema legacy

```bash
cd scripts
python appsistencia_extractor.py
```

Genera `data/extracted/castellers.json` amb 258 persones.

### 2. Importar a NeonDB

```bash
nx run api:seed
```

## Endpoints API

Documentació completa amb Swagger disponible a `http://localhost:3000/api/docs`

| Method | Route | Descripció |
|--------|-------|------------|
| `POST` | `/api/auth/login` | Iniciar sessió |
| `POST` | `/api/auth/refresh` | Renovar token d'accés |
| `GET` | `/api/auth/me` | Perfil de l'usuari autenticat |
| `GET` | `/api/persons` | Llista amb filtres i paginació |
| `GET` | `/api/persons/:id` | Detall d'una persona |
| `POST` | `/api/persons` | Crear persona |
| `PATCH` | `/api/persons/:id` | Actualitzar persona |
| `DELETE` | `/api/persons/:id` | Soft delete (isActive = false) |
| `GET` | `/api/positions` | Llista de posicions |
| `GET` | `/api/events` | Llista d'events amb filtres |
| `GET` | `/api/events/:id` | Detall d'un event |
| `GET` | `/api/seasons` | Llista de temporades |
| `GET` | `/api/sync/persons` | SSE: sincronitzar persones des del legacy |
| `GET` | `/api/sync/events` | SSE: sincronitzar events des del legacy |

Documentació interactiva disponible a `http://localhost:3000/api/docs` (Swagger).

## Funcionalitats implementades

- ✅ **API REST** amb NestJS + TypeORM
- ✅ **Swagger/OpenAPI** documentació interactiva
- ✅ **Interceptor de latència** per monitorització
- ✅ **Tests unitaris** amb Jest (11 tests passing)
- ✅ **Validació** amb class-validator
- ✅ **CORS** configurable
- ✅ **Soft delete** per totes les entitats
- ✅ **Paginació** i filtres avançats

## Terminologia

- **Membre**: terme neutre per a qualsevol persona de la colla (mai "casteller")
- **Xicalla**: menors de 16 anys (mai "canalla")
- **Colla**: grup de muixeranga

## Llicència

MIT
