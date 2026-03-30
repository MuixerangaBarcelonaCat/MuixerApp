# MuixerApp

APPsistència 2.0 — Sistema de gestió d'assistència i figures per a Muixerangues.

## Stack Tecnològic

- **Backend**: NestJS + TypeScript + TypeORM + PostgreSQL (NeonDB)
- **Frontend Dashboard**: Angular 20+ (standalone, signals, OnPush) + Tailwind CSS + Spartan UI
- **Mobile**: Angular PWA
- **Monorepo**: Nx workspace

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
| [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md) | Visió general i estat dels sub-projectes |
| [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) | Punt actual i pròxims passos |
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

### 3. Executar l'API

```bash
nx serve api
```

L'API estarà disponible a `http://localhost:3000/api`

### 4. Executar el Dashboard

```bash
nx serve dashboard
```

El dashboard estarà disponible a `http://localhost:4200`

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

| Method | Route | Descripció |
|--------|-------|------------|
| `GET` | `/api/persons` | Llista amb filtres i paginació |
| `GET` | `/api/persons/:id` | Detall d'una persona |
| `POST` | `/api/persons` | Crear persona |
| `PATCH` | `/api/persons/:id` | Actualitzar persona |
| `DELETE` | `/api/persons/:id` | Soft delete (isActive = false) |
| `GET` | `/api/positions` | Llista de posicions |
| `POST` | `/api/positions` | Crear posició |
| `PATCH` | `/api/positions/:id` | Actualitzar posició |

## Terminologia

- **Membre**: terme neutre per a qualsevol persona de la colla (mai "casteller")
- **Xicalla**: menors de 16 anys (mai "canalla")
- **Colla**: grup de muixeranga

## Llicència

MIT
