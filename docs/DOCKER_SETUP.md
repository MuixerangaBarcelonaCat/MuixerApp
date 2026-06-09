# Docker Setup — PostgreSQL Local

> Guia pràctica per posar en marxa el projecte en local amb Docker.

---

## Prerequisits

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instal·lat i funcionant
- Node.js 22 LTS instal·lat (veure `.node-version`)
- pnpm instal·lat: `corepack enable && corepack prepare pnpm@latest --activate`

---

## Onboarding ràpid (primer cop)

### 1. Clonar i instal·lar

```bash
git clone <repo-url>
cd MuixerApp
pnpm install
```

### 2. Configurar variables d'entorn

```bash
cp .env.example .env
# Per defecte ja ve configurat per Docker local — no cal editar res
```

### 3. Arrencar la base de dades

```bash
pnpm run docker:up
```

Arrenca PostgreSQL 16 a `localhost:5432`.

### 4. Arrencar l'API

```bash
nx serve api
```

L'API estarà disponible a `http://localhost:3000/api`  
Swagger: `http://localhost:3000/api/docs`

### 5. Crear el primer usuari admin

```bash
curl -X POST http://localhost:3000/api/auth/setup/user \
  -H "X-Setup-Token: $SETUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "un-email-nou@gmail.com", "password": "el-password", "role": "ADMIN"}'
```

### 6. Importar les temporades

```bash
nx run api:seed-seasons
```

Importa les temporades 2024-2025 i 2025-2026 des de `data/seeds/seasons.json`.

### 7. Sincronitzar dades del legacy

Obre el dashboard i usa la funció de sincronització, o via API:

```bash
# Sincronitzar persones
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/sync/persons

# Sincronitzar events
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/sync/events
```

### 8. Arrencar el Dashboard

```bash
nx serve dashboard
# http://localhost:4200
```

---

## Scripts Disponibles

| Script | Descripció |
|--------|------------|
| `pnpm run docker:up` | Arrencar el contenidor PostgreSQL |
| `pnpm run docker:down` | Aturar el contenidor (manté les dades) |
| `pnpm run docker:logs` | Veure logs de PostgreSQL en temps real |
| `pnpm run docker:clean` | Aturar i **eliminar volums** (neteja completa) |
| `pnpm run docker:psql` | Obrir psql (consola SQL interactiva) |
| `pnpm run docker:prod:up` | Arrencar l'stack complet de producció (API + DB) |
| `pnpm run docker:prod:down` | Aturar l'stack de producció |
| `nx run api:seed-seasons` | Importar temporades des de `data/seeds/seasons.json` |

---

## Accés SQL directe

```bash
pnpm run docker:psql
```

Exemples de consultes:

```sql
-- Llistar taules
\dt

-- Veure temporades
SELECT id, name, "startDate", "endDate" FROM seasons;

-- Veure persones
SELECT id, name, "firstSurname", alias FROM persons LIMIT 10;

-- Sortir
\q
```

---

## Reset complet

Si vols tornar a un estat net (elimina TOTES les dades locals):

```bash
pnpm run docker:clean   # Elimina contenidors i volums
pnpm run docker:up      # Torna a crear la DB
nx serve api           # TypeORM recrea les taules automàticament
nx run api:seed-seasons  # Reimporta les temporades
```

---

## Troubleshooting

### Error: `port 5432 already in use`

Ja tens PostgreSQL funcionant localment. Atura'l:

```bash
# macOS (Homebrew)
brew services stop postgresql@16

# Linux (systemd)
sudo systemctl stop postgresql
```

O bé canvia el port al `docker-compose.yml`:
```yaml
ports:
  - '5433:5432'
```
I actualitza `.env`: `DATABASE_URL=postgresql://muixer:muixer_dev_pass@localhost:5433/muixer_dev`

### Error: `Cannot connect to Docker daemon`

Docker Desktop no està funcionant. Obre Docker Desktop manualment.

### Error: `password authentication failed`

Les credencials del `.env` i el `docker-compose.yml` no coincideixen. Comprova que:
- `docker-compose.yml` → `POSTGRES_USER: muixer`, `POSTGRES_PASSWORD: muixer_dev_pass`
- `.env` → `DATABASE_URL=postgresql://muixer:muixer_dev_pass@localhost:5432/muixer_dev`

Si has canviat alguna cosa, fes un reset complet:
```bash
pnpm run docker:clean && pnpm run docker:up
```

### L'API no arrenca

1. Comprova que el contenidor Docker és en marxa: `docker ps`
2. Prova la connexió: `pnpm run docker:psql`
3. Comprova que `DATABASE_URL` al `.env` és correcta

---

## Referència Arquitectura

Per a la documentació completa sobre l'arquitectura Docker (desplegament a VPS, backups, escalabilitat), consulta:

→ [`docs/DOCKER_ARCHITECTURE.md`](DOCKER_ARCHITECTURE.md)

---

**Última actualització:** 7 de maig de 2026
