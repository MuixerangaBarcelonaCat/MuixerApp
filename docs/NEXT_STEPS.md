# MuixerApp — Punt actual i pròxims passos

> Última actualització: 30 de març de 2026

---

## On estem?

### ✅ Fase completada: P0+P1+P2 Vertical Slice — Complet i Funcional

El primer vertical slice està **completament implementat i funcional**:

#### Backend
- ✅ Nx monorepo configurat
- ✅ NestJS API amb TypeORM + NeonDB
- ✅ Entitats: Position, User, Person amb relacions
- ✅ CRUD complet per Person i Position
- ✅ **Sistema de sincronització** amb legacy API (SSE + Strategy pattern)
- ✅ **Merge strategy** refinada (CREATE vs UPDATE amb regles clares)
- ✅ **Soft delete automàtic** de persones desaparegudes
- ✅ **Endpoints activate/deactivate** per gestió manual
- ✅ **Swagger/OpenAPI** documentació disponible a `/api/docs`
- ✅ **Interceptor de latència** per monitorització de requests
- ✅ **Tests unitaris** amb Jest (10/10 tests passing)

#### Frontend
- ✅ Angular 20+ dashboard amb arquitectura moderna
- ✅ **DaisyUI v4 + Angular CDK** (migrat des de Spartan UI)
- ✅ **Estructura de 3 fitxers** per components (TS/HTML/SCSS)
- ✅ **Person List** amb taula (desktop) + cards (mòbil) + filtres + cerca
- ✅ **Person Detail** amb vista responsive de 2 columnes
- ✅ **Person Sync** amb EventSource + progress bar + log en temps real
- ✅ **Layout responsive** amb sidebar + header + drawer mòbil
- ✅ **Utils compartides** (color, date, person)
- ✅ Shared library amb enums
- ✅ **Tailwind CSS v3 + DaisyUI v4** configurat (estable, 55 components)

### Què s'ha implementat?

- **Stack:** NestJS + Angular 20+ + TypeORM + PostgreSQL (NeonDB) + Nx monorepo
- **Enfocament:** Vertical Slice — entitat Person completa de punta a punta
- **Model de dades:** Person, Position, User (entitats TypeORM amb decoradors)
- **API REST:** Endpoints amb filtres, paginació i cerca
- **Dashboard:** Tailwind CSS + DaisyUI + Angular CDK
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

### 1. ✅ Validació Manual del Vertical Slice (P2 final)

Seguir el checklist complet a `docs/VALIDATION_CHECKLIST.md`:

```bash
# 1. Assegurar-te que tens .env configurat
cp .env.example .env
# Editar DATABASE_URL amb credencials de NeonDB
# Editar LEGACY_API_URL, LEGACY_API_USERNAME, LEGACY_API_PASSWORD

# 2. Executar backend
nx serve api
# http://localhost:3000/api
# Swagger: http://localhost:3000/api/docs

# 3. Executar dashboard
nx serve dashboard
# http://localhost:4200

# 4. Provar sincronització
# - Navega a "Persones"
# - Clica "Sincronitzar"
# - Verifica progrés en temps real
# - Comprova dades carregades

# 5. Provar filtres i cerca
# - Cerca per nom/alias
# - Filtra per posició
# - Filtra per disponibilitat
# - Filtra actius/inactius

# 6. Provar responsive
# - Desktop (≥1024px)
# - Tablet (768px)
# - Mòbil (375px)

# 7. Provar activate/deactivate
# - Desactivar una persona
# - Activar una persona
# - Verificar lastSyncedAt actualitzat
```

**Objectiu:** Verificar que tot funciona correctament abans de passar a P3.

### 2. Ajustaments Post-Sync (si cal)

Després del primer sync real amb dades de producció:

- [ ] Revisar mappings de camps (alias, dates, posicions)
- [ ] Ajustar regles de merge si cal
- [ ] Verificar soft delete automàtic funciona correctament
- [ ] Documentar anomalies o casos especials trobats
- [ ] Ajustar validacions si cal

**Documentació:** `docs/SYNC_MERGE_STRATEGY.md`

### 3. Preparar P3: Seasons + Events + Attendance

Dissenyar i especificar la següent fase del roadmap:

- [ ] Dissenyar model de dades (Season, Event, Attendance)
- [ ] Definir relacions entre entitats
- [ ] Especificar endpoints API necessaris
- [ ] Dissenyar UI per gestió d'events
- [ ] Planificar sync strategy per Events
- [ ] Crear spec tècnic aprovat

**Documentació:** `docs/PROJECT_ROADMAP.md`

### 4. Executar l'aplicació

```bash
# Build
nx build shared       # Compilar shared library primer
nx build api          # Compilar API
nx build dashboard    # Compilar Dashboard

# Executar en desenvolupament
nx serve api          # http://localhost:3000/api
                      # Swagger: http://localhost:3000/api/docs

nx serve dashboard    # http://localhost:4200

# Tests
nx test api           # 10/10 tests passing

# Sincronització
# Usar el botó "Sincronitzar" al dashboard
# o directament via Swagger: GET /api/sync/persons (SSE)
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

### Estat i Roadmap

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Estat Actual** | [`docs/CURRENT_STATUS.md`](CURRENT_STATUS.md) | Resum executiu complet |
| **Roadmap** | [`docs/PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) | Visió general i fases |
| **Pròxims Passos** | [`docs/NEXT_STEPS.md`](NEXT_STEPS.md) | Aquest document |

### Documentació Tècnica

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Implementation Status** | [`docs/IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) | Estat detallat d'implementació |
| **Sync Merge Strategy** | [`docs/SYNC_MERGE_STRATEGY.md`](SYNC_MERGE_STRATEGY.md) | Regles de sincronització |
| **Sync Improvements** | [`docs/SYNC_IMPROVEMENTS_2026-03-30.md`](SYNC_IMPROVEMENTS_2026-03-30.md) | Millores implementades |
| **API Person Endpoints** | [`docs/API_PERSON_ENDPOINTS.md`](API_PERSON_ENDPOINTS.md) | Documentació API REST |
| **DaisyUI Migration** | [`docs/DAISYUI_MIGRATION.md`](DAISYUI_MIGRATION.md) | Migració Spartan → DaisyUI |
| **Angular Component Structure** | [`docs/ANGULAR_COMPONENT_STRUCTURE_MIGRATION.md`](ANGULAR_COMPONENT_STRUCTURE_MIGRATION.md) | Migració a 3 fitxers |
| **Tailwind Version** | [`docs/TAILWIND_VERSION.md`](TAILWIND_VERSION.md) | Decisió v3 vs v4 |
| **Validation Checklist** | [`docs/VALIDATION_CHECKLIST.md`](VALIDATION_CHECKLIST.md) | Checklist de validació |

### Specs Aprovades

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **Spec P0-P2** | [`docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md`](specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md) | Spec original |
| **Spec Sync + Dashboard** | [`docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`](specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md) | Spec complet |

### Altres

| Document | Ubicació | Descripció |
|----------|----------|------------|
| **API Legacy** | [`docs/API_APPSISTENCIA.md`](API_APPSISTENCIA.md) | Endpoints legacy per migració |
| **Rules** | [`.cursor/rules/`](../.cursor/rules/) | Regles per l'agent |
| **Arxiu** | [`docs/archive/`](archive/) | Docs històrics obsolets |
