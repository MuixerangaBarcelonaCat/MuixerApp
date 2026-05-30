# Desplegament a PRE — Hetzner VPS

> Guia completa per desplegar i gestionar l'entorn de pre-producció.

---

## Entorn PRE

| Paràmetre | Valor |
|-----------|-------|
| Proveïdor | Hetzner Cloud |
| IP pública | `204.168.221.131` |
| SO | Ubuntu 24.04 LTS |
| RAM / Disc | 4 GB / 40 GB |
| Swap | 2 GB configurat |
| Docker | ✅ Instal·lat |

### Stack de contenidors

| Contenidor | Imatge | Port (host) | Descripció |
|------------|--------|-------------|------------|
| `muixer-postgres-pre` | `postgres:16-alpine` | — (intern) | Base de dades PostgreSQL |
| `muixer-api-pre` | Build `apps/api/Dockerfile` | `3000` | API NestJS |
| `muixer-dashboard-pre` | Build `apps/dashboard/Dockerfile` | `80`, `443` | Angular + Caddy |

L'API es construeix amb `--configuration=production`, el Dashboard amb `--configuration=pre`.  
Caddy gestiona el routing (SPA fallback + proxy `/api/*`) i el HTTPS automàtic quan s'afegeixi un domini.

### URLs d'accés

| Servei | URL |
|--------|-----|
| Dashboard | `http://204.168.221.131` |
| API (debug) | `http://204.168.221.131:3000/api` |
| Swagger docs | `http://204.168.221.131:3000/api/docs` |

---

## Prerequisits del Servidor

Verificar que tot el necessari ja està configurat:

```bash
# Docker operatiu
docker --version
docker ps

# L'usuari és al grup docker (sense necessitat de sudo)
groups $USER | grep docker

# Ports lliures
sudo ss -tlnp | grep -E ':80|:443|:3000'
```

- [ ] Docker instal·lat i funcionant
- [ ] L'usuari té permisos Docker (grup `docker`)
- [ ] Ports **80**, **443** i **3000** accessibles (firewall / security groups)
- [ ] Repositori clonat al servidor

---

## Configuració de Variables d'Entorn

### 1. Crear el fitxer `.env.pre`

```bash
cp .env.pre.example .env.pre
nano .env.pre
```

### 2. Generar els secrets

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "SETUP_TOKEN=$(uuidgen)"
```

Copiar els valors generats al `.env.pre`.

### 3. Referència de variables

| Variable | Valor | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | No canviar |
| `PORT` | `3000` | No canviar |
| `DB_SSL` | `false` | Connexió per xarxa Docker interna |
| `POSTGRES_USER` | `muixer_pre` | Usuari de la BD |
| `POSTGRES_PASSWORD` | **Generar** | `openssl rand -base64 32` |
| `POSTGRES_DB` | `muixer_pre` | Nom de la BD |
| `DATABASE_URL` | `postgresql://muixer_pre:<password>@postgres:5432/muixer_pre` | Hostname ha de ser `postgres` (nom del servei Docker) |
| `CORS_ORIGINS` | `http://204.168.221.131` | IP del servidor sense trailing slash |
| `LEGACY_API_URL` | `https://colla-muixeranguera.appsistencia.cat` | No canviar |
| `LEGACY_API_USERNAME` | Credencial legacy | Demanar a l'administrador |
| `LEGACY_API_PASSWORD` | Credencial legacy | Demanar a l'administrador |
| `JWT_SECRET` | **Generar** | `openssl rand -base64 48` — mínim 64 chars |
| `JWT_ACCESS_TTL` | `900` | 15 minuts en segons |
| `JWT_REFRESH_SECRET` | **Generar** | **Ha de ser diferent de `JWT_SECRET`** |
| `JWT_REFRESH_TTL_DASHBOARD` | `28800` | 8 hores en segons |
| `JWT_REFRESH_TTL_PWA` | `604800` | 7 dies en segons |
| `REFRESH_TOKEN_COOKIE` | `muixer_rt` | No canviar |
| `SETUP_TOKEN` | **Generar** | `uuidgen` — **Eliminar un cop creat el primer admin** |

> **⚠️ Important**: `DATABASE_URL` ha d'usar `postgres` com a hostname (nom del servei al `docker-compose.pre.yml`), mai `localhost`.

---

## Primer Desplegament

```bash
# 1. Connectar-se al servidor
ssh user@204.168.221.131

# 2. Clonar el repositori
git clone git@github.com:MuixerangaBarcelonaCat/MuixerApp.git
cd MuixerApp

# 3. Configurar les variables d'entorn (veure secció anterior)
cp .env.pre.example .env.pre
nano .env.pre

# 4. Construir les imatges i arrencar l'stack (~5-10 min el primer cop)
docker compose -f docker-compose.pre.yml up -d --build

# 5. Verificar l'estat dels serveis
docker compose -f docker-compose.pre.yml ps

# 6. Esperar que tots els healthchecks siguin "healthy"
watch -n 5 docker compose -f docker-compose.pre.yml ps
# Ctrl+C quan els tres serveis mostrin (healthy)

# 7. Verificar que l'API respon
curl -s http://204.168.221.131:3000/api/health
# Resposta esperada: {"status":"ok"}

# 8. Crear el primer usuari administrador
curl -X POST http://204.168.221.131:3000/api/auth/setup/user \
  -H "X-Setup-Token: <SETUP_TOKEN del .env.pre>" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "contrasenya-forta"}'

# 9. ⚠️ Eliminar SETUP_TOKEN del .env.pre un cop creat l'admin
nano .env.pre   # Comentar o eliminar la línia SETUP_TOKEN=...

# 10. Reiniciar l'API per aplicar el canvi (sense rebuild)
docker compose -f docker-compose.pre.yml up -d api
```

---

## Actualitzar PRE (Nous Desplegaments)

```bash
# 1. Connectar-se al servidor
ssh user@204.168.221.131
cd MuixerApp

# 2. Baixar els canvis
git pull origin main   # o la branca corresponent

# 3. Reconstruir les imatges i reiniciar els serveis
docker compose -f docker-compose.pre.yml up -d --build

# 4. Verificar l'estat
docker compose -f docker-compose.pre.yml ps
docker compose -f docker-compose.pre.yml logs api --tail=50
```

> **Dades persistents**: El volum `postgres-pre-data` manté les dades entre desplegaments. El volum `caddy-data` conserva els certificats TLS quan s'activi HTTPS.

> **Migracions**: L'entrypoint del contenidor API executa automàticament `typeorm migration:run` abans d'arrencar l'aplicació. Si hi ha migracions pendents, s'aplicaran durant el boot.

---

## Migracions de Base de Dades

### Com funcionen

L'esquema de la base de dades es gestiona amb **migracions de TypeORM**. `synchronize` està **sempre desactivat** en tots els entorns. Les migracions s'executen automàticament:

- **DEV**: Quan `nx serve api` arrenca (`migrationsRun: true` al TypeORM config)
- **PRE/PROD**: L'script `entrypoint.sh` del contenidor Docker executa `migration:run` abans d'iniciar Node

### Baseline de PRE

PRE ja tenia l'esquema creat amb `synchronize: true`. Per marcar l'estat inicial com a "ja migrat":

```bash
# Executar UNA SOLA VEGADA al servidor PRE (ja fet)
bash scripts/baseline-pre-migrations.sh
```

Això insereix un registre a `typeorm_migrations` perquè el runner salti la migració `InitialSchema`.

### Afegir un canvi d'esquema

```bash
# 1. Modificar les entitats (local, en dev)
# 2. Generar la migració automàticament
pnpm run migration:generate -- NomDelCanvi

# 3. Revisar el fitxer generat a apps/api/src/migrations/
# 4. Fer commit de l'entitat + la migració junts
# 5. Al desplegar a PRE/PROD, s'aplica automàticament
```

### Comandes útils

| Comanda | Descripció |
|---------|------------|
| `pnpm run migration:generate -- NomMigració` | Genera migració des de canvis a entitats |
| `pnpm run migration:create -- NomMigració` | Crea migració buida (SQL manual) |
| `pnpm run migration:run` | Aplica migracions pendents (local) |
| `pnpm run migration:revert` | Reverteix l'última migració (local) |
| `pnpm run migration:show` | Mostra estat de totes les migracions |

### Revertir una migració a PRE

```bash
docker exec muixer-api-pre node ./node_modules/typeorm/cli.js migration:revert -d ./data-source.js
```

---

## Comandes de Gestió

### Des del servidor (`ssh user@204.168.221.131`)

| Comanda | Descripció |
|---------|------------|
| `docker compose -f docker-compose.pre.yml ps` | Estat i salut dels serveis |
| `docker compose -f docker-compose.pre.yml up -d --build` | Redeploy complet |
| `docker compose -f docker-compose.pre.yml down` | Aturar tots els serveis |
| `docker compose -f docker-compose.pre.yml restart api` | Reiniciar l'API sense rebuild |
| `docker compose -f docker-compose.pre.yml logs -f` | Logs en temps real (tots els serveis) |
| `docker compose -f docker-compose.pre.yml logs -f api` | Logs de l'API NestJS |
| `docker compose -f docker-compose.pre.yml logs -f dashboard` | Logs de Caddy |
| `docker compose -f docker-compose.pre.yml logs -f postgres` | Logs de PostgreSQL |
| `docker compose -f docker-compose.pre.yml logs --tail=100 api` | Últimes 100 línies de l'API |

### Des de la màquina de dev (scripts del `package.json`)

| Script | Descripció |
|--------|------------|
| `pnpm run docker:pre:up` | Build i arrencada de l'stack PRE |
| `pnpm run docker:pre:down` | Aturar l'stack PRE |
| `pnpm run docker:pre:logs` | Logs en temps real |
| `pnpm run docker:pre:ps` | Estat dels serveis |

---

## Habilitar HTTPS (quan hi hagi domini)

Quan el servidor tingui un nom de domini apuntant a `204.168.221.131`, activar HTTPS és un canvi d'una sola línia al `Caddyfile`:

```diff
# apps/dashboard/Caddyfile
-:80 {
+pre.muixerapp.cat {
```

Caddy obtindrà i renovarà el certificat Let's Encrypt automàticament. Reconstruir la imatge i fer redeploy:

```bash
docker compose -f docker-compose.pre.yml up -d --build dashboard
```

> El volum `caddy-data` persisteix els certificats entre redeploys per evitar re-emissions innecessàries (Let's Encrypt té límit de 5 certificats/domini/setmana).

---

## Monitoratge i Salut

### Health checks integrats

| Servei | Endpoint | Resposta esperada |
|--------|----------|-------------------|
| API | `http://204.168.221.131:3000/api/health` | `{"status":"ok"}` |
| Dashboard | `http://204.168.221.131` | HTTP 200 |

```bash
# Verificar API
curl -s http://204.168.221.131:3000/api/health

# Verificar Dashboard
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://204.168.221.131
```

### Logs rellevants per diagnosticar problemes

```bash
# Errors d'arrencada de l'API (TypeORM, connexió BD, variables entorn)
docker compose -f docker-compose.pre.yml logs api --tail=100

# Errors de Caddy (routing, certificats, proxy)
docker compose -f docker-compose.pre.yml logs dashboard --tail=50

# Errors de PostgreSQL
docker compose -f docker-compose.pre.yml logs postgres --tail=50
```

---

## Accés a la Base de Dades

```bash
# Connexió directa a PostgreSQL (des del servidor)
docker exec -it muixer-postgres-pre psql -U muixer_pre -d muixer_pre
```

Consultes útils:

```sql
-- Verificar extensions instal·lades
SELECT extname FROM pg_extension;

-- Llistar taules
\dt

-- Veure usuaris de l'aplicació
SELECT id, email, role FROM users;

-- Temporades actives
SELECT id, name, "startDate", "endDate" FROM seasons;

-- Sortir
\q
```

---

## Backup de la Base de Dades PRE

```bash
# Crear backup (des del servidor)
docker exec muixer-postgres-pre pg_dump \
  -U muixer_pre \
  -d muixer_pre \
  --no-owner \
  --no-acl \
  > ~/backups/backup-pre-$(date +%Y%m%d-%H%M).sql

# Comprimir el backup
gzip ~/backups/backup-pre-$(date +%Y%m%d)*.sql

# Restaurar backup (⚠️ sobreescriu les dades actuals)
docker exec -i muixer-postgres-pre psql \
  -U muixer_pre \
  -d muixer_pre \
  < ~/backups/backup-pre-YYYYMMDD-HHMM.sql
```

---

## Troubleshooting

### Els contenidors no arrenquen o queden en `starting`

```bash
# Veure logs detallats per identificar l'error
docker compose -f docker-compose.pre.yml logs --tail=100

# Forçar recreació eliminant les imatges en cache
docker compose -f docker-compose.pre.yml down
docker compose -f docker-compose.pre.yml up -d --build --force-recreate
```

### L'API no es connecta a PostgreSQL

La `DATABASE_URL` al `.env.pre` ha d'usar `postgres` (nom del servei Docker), no `localhost`:

```
# ❌ Incorrecte
DATABASE_URL=postgresql://muixer_pre:pass@localhost:5432/muixer_pre

# ✅ Correcte
DATABASE_URL=postgresql://muixer_pre:pass@postgres:5432/muixer_pre
#                                         ^^^^^^^^
#                             Nom del servei al docker-compose.pre.yml
```

### El Dashboard retorna errors 502 Bad Gateway

Caddy no pot arribar a l'API. Causes comunes:
- L'API no ha acabat d'arrencar (esperar el healthcheck)
- Error a l'API (veure `logs api`)

```bash
# Verificar que l'API respon des de dins de la xarxa Docker
docker exec muixer-dashboard-pre wget -qO- http://api:3000/api/health
```

### Error de CORS

Verificar que `CORS_ORIGINS` al `.env.pre` conté l'origen exacte (sense trailing slash, amb protocol):

```
# ✅ Correcte
CORS_ORIGINS=http://204.168.221.131

# ❌ Incorrecte (trailing slash o protocol incorrecte)
CORS_ORIGINS=http://204.168.221.131/
```

Reiniciar l'API per aplicar el canvi: `docker compose -f docker-compose.pre.yml restart api`

### El build falla per falta de memòria

El build de Node.js + Angular + NestJS pot ser intensiu en RAM (el servidor té 4 GB + 2 GB swap):

```bash
# Verificar l'ús de memòria durant el build
watch -n 2 free -h

# Augmentar el swap temporalment si cal
sudo fallocate -l 2G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2

# Tornar a intentar el build
docker compose -f docker-compose.pre.yml up -d --build
```

### Port 80, 443 o 3000 ja en ús

```bash
sudo ss -tlnp | grep -E ':80|:443|:3000'
sudo lsof -i :80
```

### Dades perdudes després d'un `docker compose down -v`

> **⚠️ Atenció**: `docker compose down -v` elimina els volums i les dades de PostgreSQL i els certificats de Caddy. Usar sempre `docker compose down` (sense `-v`) per aturar sense perdre dades.

---

## Relació amb Altres Documents

| Document | Relació |
|----------|---------|
| [`DOCKER_ARCHITECTURE.md`](DOCKER_ARCHITECTURE.md) | Arquitectura de contenidors, diagrames multi-entorn, backup automatitzat |
| [`MIGRATION_NPM_TO_PNPM.md`](MIGRATION_NPM_TO_PNPM.md) | Migració del gestor de paquets — ja aplicada als Dockerfiles |

---

**Creat:** 26 de maig de 2026
**Estat:** 📋 Pendent de primer desplegament
**Entorn:** Hetzner VPS · `204.168.221.131` · Ubuntu 24.04 LTS
