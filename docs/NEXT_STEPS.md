# MuixerApp — Punt actual i pròxims passos

> Última actualització: 30 de març de 2026

---

## On estem?

### ✅ Fase completada: P0+P1+P2 Vertical Slice — Scaffold + Entities + Basic UI

El primer vertical slice està **implementat**:

- ✅ Nx monorepo configurat
- ✅ NestJS API amb TypeORM + NeonDB
- ✅ Entitats: Position, User, Person amb relacions
- ✅ CRUD complet per Person i Position
- ✅ Angular dashboard amb Tailwind CSS + routing
- ✅ Shared library amb enums
- ✅ Estructura de seed per importar dades
- ✅ **Swagger/OpenAPI** documentació disponible a `/api/docs`
- ✅ **Interceptor de latència** per monitorització de requests
- ✅ **Tests unitaris** amb Jest (11 tests passing)
- ✅ **Tailwind CSS v3** configurat (downgrade de v4 per compatibilitat amb Spartan UI)

### Què s'ha implementat?

- **Stack:** NestJS + Angular 20+ + TypeORM + PostgreSQL (NeonDB) + Nx monorepo
- **Enfocament:** Vertical Slice — entitat Person completa de punta a punta
- **Model de dades:** Person, Position, User (entitats TypeORM amb decoradors)
- **API REST:** Endpoints amb filtres, paginació i cerca
- **Dashboard:** Tailwind CSS + Angular CDK (preparat per Spartan UI)
- **Idioma:** Català UI, anglès codi

### Estructura actual del repo

```
apps/
  api/          → NestJS backend (Person, Position, User modules)
  dashboard/    → Angular dashboard (layout shell + routing)
  pwa/          → PWA scaffold (buit)
libs/
  shared/       → Enums compartits
docs/
  specs/        → Spec tècnic aprovat
  archive/      → Docs històrics (DATA_MODEL, TEAM_KICKOFF)
  PROJECT_ROADMAP.md
  NEXT_STEPS.md (aquest document)
  API_APPSISTENCIA.md
.cursor/rules/  → Regles per l'agent
scripts/        → Extractor Python
```

---

## Pròxims passos

### 1. Connectar a NeonDB

Crear `.env` amb la teva `DATABASE_URL`:

```bash
cp .env.example .env
# Editar DATABASE_URL amb les credencials de NeonDB
```

### 2. Executar l'extractor de dades

```bash
cd scripts
python appsistencia_extractor.py
```

Genera `data/extracted/castellers.json` amb 258 persones.

### 3. Completar la lògica d'importació

Implementar el mapatge complet a `apps/api/src/modules/database/seeds/seed.command.ts`:
- Extreure posicions úniques
- Upsert amb mapatge de zones
- Mapatge de camps legacy → Person
- Crear Users inactius per emails
- Idempotència amb `legacyId`

### 4. Implementar UI completa amb Spartan UI

- Instal·lar components Spartan UI necessaris
- Person list amb taula (desktop) i cards (mòbil)
- Filtres i cerca reactiva
- Person detail view
- API service per connectar amb backend

### 5. Verificar el vertical slice

```bash
# Build
nx build shared       # Compilar shared library primer
nx build api          # Compilar API

# Executar
node dist/apps/api/main.js  # http://localhost:3000/api
                            # Swagger: http://localhost:3000/api/docs

# Tests
nx test api           # 11 tests passing

# Dashboard (quan estigui implementat)
nx serve dashboard    # http://localhost:4200

# Seed (quan estigui implementat)
nx run api:seed       # Importar dades
```

### 6. Monitorització

L'API inclou un interceptor de latència que registra automàticament:
- Mètode HTTP + URL
- Status code
- Temps de resposta en ms
- Errors amb stack trace

Logs disponibles a la consola del servidor.

---

## Documents de referència

| Document | Ubicació | Descripció |
|----------|----------|------------|
| Roadmap | [`docs/PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) | Visió general i estat |
| Spec P0-P2 | [`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`](specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md) | Spec tècnic aprovat |
| API Legacy | [`docs/API_APPSISTENCIA.md`](API_APPSISTENCIA.md) | Endpoints per migració |
| Rules | [`.cursor/rules/`](../.cursor/rules/) | Regles per l'agent |
| Arxiu | [`docs/archive/`](archive/) | Docs històrics |
