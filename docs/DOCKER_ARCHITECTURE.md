# Arquitectura Docker — MuixerApp

> Documentació de l'arquitectura de contenidors per a tots els entorns.

---

## Visió General

MuixerApp utilitza Docker **únicament per a la base de dades** en desenvolupament, i Docker complet (API + DB) en producció. Aquest disseny permet:

- **Dev local**: `nx serve api` + `docker compose up` (PostgreSQL local, codi amb hot-reload)
- **Producció VPS**: `docker compose -f docker-compose.prod.yml up` (tot en contenidors)
- **Portabilitat**: Canviar de proveidor VPS en menys d'una hora

---

## Diagrama per Entorn

### Desenvolupament Local

```
┌─────────────────────────────────────────────────┐
│  MacOS / Linux (màquina del dev)                │
│                                                 │
│   ┌───────────────┐   ┌───────────────────┐     │
│   │  nx serve api │──▶│ nx serve dashboard│     │
│   │  localhost:3000│   │ localhost:4200    │     │
│   └───────┬───────┘   └───────────────────┘     │
│           │                                     │
│           ▼ DATABASE_URL                        │
│   ┌───────────────────────────────────────┐     │
│   │  Docker Container                     │     │
│   │  postgres:16-alpine                   │     │
│   │  localhost:5432                       │     │
│   │  Volume: postgres-data                │     │
│   └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### Producció (VPS)

```
┌─────────────────────────────────────────────────────────────┐
│  VPS (Hetzner / DigitalOcean / etc.)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Nginx (reverse proxy)                               │  │
│  │  Port 80/443 → SSL termination                       │  │
│  └────────────┬─────────────────────┬───────────────────┘  │
│               │                     │                       │
│               ▼ /api/*              ▼ /*                    │
│  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │  Docker: muixer-api│  │  Static files (dashboard)   │   │
│  │  Port 3000         │  │  Servits per Nginx           │   │
│  │  NestJS + Node 22  │  └─────────────────────────────┘   │
│  └────────┬───────────┘                                     │
│           │ DATABASE_URL (xarxa Docker interna)             │
│           ▼                                                 │
│  ┌────────────────────┐                                     │
│  │  Docker: muixer-    │                                    │
│  │  postgres          │                                     │
│  │  postgres:16-alpine│                                     │
│  │  Volume: postgres- │                                     │
│  │  data (persistent) │                                     │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Fitxers Docker del Projecte

| Fitxer | Entorn | Propòsit |
|--------|--------|----------|
| `docker-compose.yml` | Dev | PostgreSQL local per al dev |
| `docker-compose.prod.yml` | Producció | Stack complet: API + PostgreSQL |
| `apps/api/Dockerfile` | Producció | Build multi-stage de l'API NestJS |
| `.dockerignore` | Build | Exclou fitxers innecessaris del context de build |
| `docker/postgres/init.sql` | Dev | Inicialitza extensions PG en dev |
| `docker/postgres/init-prod.sql` | Producció | Inicialitza extensions PG en prod |
| `.env.example` | Dev | Template variables d'entorn per dev |
| `.env.production.example` | Producció | Template variables d'entorn per prod |

---

## Dockerfile Multi-Stage (API)

El Dockerfile de l'API utilitza 4 stages per optimitzar la mida final:

```
┌──────────────┐   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐
│  Stage 1     │   │  Stage 2     │   │  Stage 3       │   │  Stage 4     │
│  deps        │──▶│  build       │──▶│  prod-deps     │──▶│  runner      │
│              │   │              │   │                │   │              │
│ npm ci       │   │ nx build     │   │ npm install    │   │ node main.js │
│ (all deps)   │   │ api + shared │   │ (prod only,    │   │ (final image │
│              │   │              │   │  from dist/    │   │  ~150MB)     │
│              │   │              │   │  package.json) │   │              │
└──────────────┘   └──────────────┘   └────────────────┘   └──────────────┘
```

**Per què 4 stages?**
- `deps`: Conté totes les devDependencies necessàries per compilar TypeScript
- `build`: Compila `libs/shared` i `apps/api` amb Nx/webpack
- `prod-deps`: Instal·la NOMÉS les dependencies de producció (les del `dist/package.json` generat per Nx)
- `runner`: Imatge mínima amb l'usuari no-root `nestjs` per seguretat

---

## Variables d'Entorn per Entorn

| Variable | Dev | Producció |
|----------|-----|-----------|
| `DATABASE_URL` | `postgresql://muixer:muixer_dev_pass@localhost:5432/muixer_dev` | `postgresql://user:pass@postgres:5432/db` |
| `DB_SSL` | `false` | `false` (la xarxa Docker és privada) |
| `NODE_ENV` | `development` | `production` |
| `JWT_SECRET` | Qualsevol string | Secret fort de 64+ chars |
| `SETUP_TOKEN` | Necessari per crear el 1r admin | Eliminar després del setup |

**Nota sobre `DB_SSL`**: En producció VPS, la connexió entre l'API i PostgreSQL és per xarxa Docker interna (no exposada a Internet), per tant SSL no és necessari. Si en el futur es fa servir un PostgreSQL extern gestionat (Neon, RDS), cal posar `DB_SSL=true`.

---

## Com Desplegar a un VPS (Pas a Pas)

### Prerequisits

- VPS amb Ubuntu 22.04+ (mínim 1 CPU, 1GB RAM per a prod lleugera)
- Docker i Docker Compose instal·lats:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  ```

### Desplegament inicial

```bash
# 1. Clonar el repositori al VPS
git clone git@github.com:MuixerangaBarcelonaCat/MuixerApp.git
cd MuixerApp

# 2. Crear el fitxer .env.production a partir del template
cp .env.production.example .env.production
# Editar amb passwords forts i dominis reals
nano .env.production

# 3. Arrencar els contenidors (primer cop: fa build de la imatge)
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verificar que tot funciona
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api

# 5. Crear el primer usuari admin via SETUP_TOKEN
curl -X POST https://api.yourdomain.com/api/setup/first-admin \
  -H "X-Setup-Token: <el-teu-SETUP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yourdomain.com", "password": "strong-password"}'

# 6. Importar les temporades
docker compose -f docker-compose.prod.yml exec api \
  node -e "require('./seed-seasons.script.js')"
# (o executar des de la màquina de dev via npm run seed-seasons si tens accés a la BD)

# 7. Sincronitzar dades del legacy (via el dashboard)
```

### Actualitzar a una nova versió

```bash
# 1. Baixar canvis
git pull origin main

# 2. Reconstruir i reiniciar (zero-downtime no és necessari per ara)
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verificar
docker compose -f docker-compose.prod.yml logs api --tail=50
```

---

## Backup i Restauració de la Base de Dades

### Fer Backup

```bash
# Crear backup de la base de dades de producció
docker exec muixer-postgres pg_dump \
  -U $POSTGRES_USER \
  -d $POSTGRES_DB \
  --no-owner \
  --no-acl \
  -f /tmp/backup.sql

# Copiar el backup al host
docker cp muixer-postgres:/tmp/backup.sql ./backup-$(date +%Y%m%d-%H%M).sql

# Comprimir (opcional)
gzip backup-$(date +%Y%m%d)*.sql
```

### Restaurar Backup

```bash
# Copiar backup al container
docker cp backup-YYYYMMDD-HHMM.sql muixer-postgres:/tmp/restore.sql

# Restaurar (atenció: sobreescriu les dades actuals!)
docker exec muixer-postgres psql \
  -U $POSTGRES_USER \
  -d $POSTGRES_DB \
  -f /tmp/restore.sql
```

### Automatitzar Backups (cron al VPS)

```bash
# Editar crontab
crontab -e

# Backup diari a les 3:00 AM, mantenint els últims 7 dies
0 3 * * * docker exec muixer-postgres pg_dump -U muixer_prod -d muixer_prod --no-owner -f /tmp/backup.sql && docker cp muixer-postgres:/tmp/backup.sql /home/user/backups/backup-$(date +\%Y\%m\%d).sql && find /home/user/backups -name "backup-*.sql" -mtime +7 -delete
```

---

## Com Afegir un Servei Nou (Escalabilitat)

### Exemple: Afegir Redis per a cache/queues

```yaml
# docker-compose.prod.yml — afegir servei
services:
  redis:
    image: redis:7-alpine
    container_name: muixer-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 3

  api:
    # ...existing config...
    depends_on:
      postgres:
        condition: service_healthy
      redis:          # <-- afegir dependència
        condition: service_healthy
    environment:
      REDIS_URL: redis://redis:6379   # <-- nova variable

volumes:
  postgres-data:
  redis-data:     # <-- nou volum
```

### Principis per Escalar

1. **Un servei = un contenidor** amb una única responsabilitat
2. **Comunicació interna via noms de servei** (ex: `postgres`, `redis`) — Docker gestiona la xarxa interna
3. **Dades persistents sempre en named volumes**, mai en bind mounts de `/tmp`
4. **`depends_on` amb `condition: service_healthy`** per evitar race conditions
5. **Cada servei amb `restart: unless-stopped`** per recuperació automàtica

---

## Troubleshooting

### Error: `port 5432 already in use`

Ja tens PostgreSQL funcionant localment. Atura'l o canvia el port del container:

```yaml
# docker-compose.yml
ports:
  - '5433:5432'  # Canviar 5432 → 5433
```

I actualitza `.env`:
```bash
DATABASE_URL=postgresql://muixer:muixer_dev_pass@localhost:5433/muixer_dev
```

### Error: `Cannot connect to Docker daemon`

Docker Desktop no està funcionant. Obre Docker Desktop manualment.

### Error: `password authentication failed`

Variables d'entorn desincronitzades. Comprova:

1. `docker-compose.yml` → `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
2. `.env` → `DATABASE_URL` (ha de coincidir amb les credencials de Docker)

Si has canviat les credencials, cal netejar el volum:
```bash
npm run docker:clean   # elimina el volum amb les dades!
npm run docker:up
```

### Contenidor de producció no arrenca

```bash
# Veure logs detallats
docker compose -f docker-compose.prod.yml logs api --tail=100

# Verificar que la DB és accessible abans que arrenqui l'API
docker compose -f docker-compose.prod.yml logs postgres
```

### L'API no es connecta a la DB en producció

En producció, l'`api` es connecta a `postgres` per **nom de servei** (xarxa Docker interna). Verifica que `DATABASE_URL` a `.env.production` usa `postgres` com a hostname:

```bash
DATABASE_URL=postgresql://user:pass@postgres:5432/db
#                                   ^^^^^^^^
#                     Nom del servei Docker (no localhost!)
```

---

## Seguretat

### En Desenvolupament

- Password simple (`muixer_dev_pass`) és acceptable — el port 5432 no és accessible fora de `localhost`
- `DB_SSL=false` és correcte — connexió local

### En Producció

- **Passwords forts** (mínim 32 caràcters aleatoris): `openssl rand -base64 32`
- **Port 5432 NO exposat** al host — el contenidor de PostgreSQL no té `ports:` al `docker-compose.prod.yml`
- **`DB_SSL=false`** és segur perquè la connexió és per xarxa Docker interna (privada)
- **Nginx davant de l'API** per gestionar SSL/TLS extern
- **Usuari no-root** dins del contenidor de l'API (`nestjs` user)
- **`SETUP_TOKEN`** ha d'eliminar-se de `.env.production` un cop creat el primer admin

---

## Estructura de Fitxers

```
MuixerApp/
├── docker-compose.yml              # Dev: PostgreSQL local
├── docker-compose.prod.yml         # Prod: API + PostgreSQL en VPS
├── .dockerignore                   # Exclou fitxers del build context
├── .env.example                    # Template .env per dev
├── .env.production.example         # Template .env per producció
├── docker/
│   └── postgres/
│       ├── init.sql                # Extensions PG per dev
│       └── init-prod.sql          # Extensions PG per prod
├── apps/
│   └── api/
│       └── Dockerfile              # Build multi-stage de l'API
└── data/
    └── seeds/
        └── seasons.json           # Dades de temporades (portables entre entorns)
```

---

**Última actualització:** 7 de maig de 2026
