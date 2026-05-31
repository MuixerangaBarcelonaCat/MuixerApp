# Desplegament a PRE — Hetzner VPS

> Guia operativa per gestionar i actualitzar l'entorn de pre-producció.

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
| **Estat** | **✅ Desplegat i operatiu** |

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

## Estat Actual del Servidor (31/05/2026)

**PRE ja està desplegat i funcionant.** Historial d'implantació:

1. Primer desplegament: `merge/pinyes-cordons-i-rengles` amb `DB_SYNC=true` per crear l'esquema
2. Esquema creat via `synchronize: true`, `DB_SYNC` eliminat
3. Baseline de migracions aplicat (`scripts/baseline-pre-migrations.sh`)
4. Migrations TypeORM activades — ara s'apliquen automàticament al boot de l'API
5. Fixes aplicats: `tslib`/`pg`/`bcrypt` a `dependencies`, Caddyfile `handle` blocks, `COOKIE_SECURE=false`

### Usuaris ADMIN al servidor PRE

| Email | Rol | Notes |
|-------|-----|-------|
| `lvaquer87@gmail.com` | ADMIN | Creat via `setup/user`, rol elevat via SQL |
| `serpastu@gmail.com` | ADMIN | Membre migrat del legacy, password i rol assignats via SQL |

---

## Flux de Treball — Pujar una Nova Versió

Aquest és el flux estàndard per a qualsevol canvi de codi, sigui una nova funcionalitat o un arreglament.

### 1. Preparar el codi en local

```bash
# Assegurar-te que els tests passen
pnpm run ci:local

# Fer commit dels canvis (conventional commits)
git add .
git commit -m "feat(modul): descripció del canvi"

# Pujar al remote
git push origin <branca>
```

> Si el canvi inclou modificació d'entitats TypeORM, cal generar una migració **abans** del push. Veure secció [Migracions](#migracions-de-base-de-dades).

### 2. Desplegar al servidor PRE

```bash
# Connectar-se al servidor
ssh root@204.168.221.131
cd MuixerApp

# Opció A — Script automatitzat (recomanat)
./scripts/deploy-pre-update.sh

# Opció B — Manual
git pull origin <branca>
docker compose -f docker-compose.pre.yml up -d --build
```

> **Migracions:** L'entrypoint del contenidor API executa `migration:run` automàticament abans d'iniciar Node. Qualsevol migració nova del commit s'aplicarà durant el boot sense cap pas manual.

### 3. Verificar el desplegament

```bash
# Estat dels contenidors (esperar que tots siguin "healthy")
docker compose -f docker-compose.pre.yml ps

# Logs de l'API (buscar errors d'arrencada o fallades de migració)
docker compose -f docker-compose.pre.yml logs api --tail=50

# Health check
curl -s http://204.168.221.131:3000/api/health
# Resposta esperada: {"status":"ok"}
```

### Rebuild parcial (quan no cal reconstruir tot)

```bash
# Només API (canvis de backend)
docker compose -f docker-compose.pre.yml up -d --build api

# Només Dashboard (canvis de frontend)
docker compose -f docker-compose.pre.yml up -d --build dashboard

# Reiniciar API sense rebuild (canvi de variable d'entorn al .env.pre)
docker compose -f docker-compose.pre.yml restart api
```

---

## Migracions de Base de Dades

### Com funcionen

L'esquema de la base de dades es gestiona amb **migracions de TypeORM**. `synchronize` està **sempre desactivat** en tots els entorns tret del primer desplegament. Les migracions s'executen automàticament:

- **DEV**: Quan `nx serve api` arrenca (`migrationsRun: true` al TypeORM config)
- **PRE/PROD**: L'script `scripts/docker-entrypoint.sh` executa `migration:run` **abans** d'iniciar Node

### Afegir un canvi d'esquema (flux complet)

```bash
# 1. Modificar les entitats (fitxers .entity.ts) en local
# 2. Generar la migració automàticament
pnpm run migration:generate -- NomDelCanvi

# 3. Revisar el fitxer generat a apps/api/src/migrations/
#    Verificar que el SQL és correcte (CREATE TABLE, ALTER TABLE, etc.)

# 4. Provar en local
pnpm run migration:run   # o simplement nx serve api (migrationsRun: true)

# 5. Fer commit de l'entitat + la migració junts
git add apps/api/src/<entity>.ts apps/api/src/migrations/<timestamp>-NomDelCanvi.ts
git commit -m "feat(db): add NomDelCanvi migration"
git push origin <branca>

# 6. Desplegar a PRE — la migració s'aplica automàticament al boot de l'API
./scripts/deploy-pre-update.sh
```

### Comandes útils (local)

| Comanda | Descripció |
|---------|------------|
| `pnpm run migration:generate -- NomMigració` | Genera migració des de canvis a entitats |
| `pnpm run migration:create -- NomMigració` | Crea migració buida (SQL manual) |
| `pnpm run migration:run` | Aplica migracions pendents (local) |
| `pnpm run migration:revert` | Reverteix l'última migració (local) |
| `pnpm run migration:show` | Mostra estat de totes les migracions |

### Verificar estat de migracions a PRE

```bash
# Des del servidor
docker exec muixer-api-pre node ./node_modules/typeorm/cli.js migration:show -d ./data-source.js
```

### Revertir una migració a PRE

```bash
# ⚠️ Usar amb precaució — afecta dades reals
docker exec muixer-api-pre node ./node_modules/typeorm/cli.js migration:revert -d ./data-source.js
```

### Baseline de PRE (ja aplicat — referència)

PRE va ser creat inicialment amb `synchronize: true`. Per evitar que la migració `InitialSchema` intenti re-crear taules ja existents, es va marcar com a aplicada:

```bash
# Ja executat al servidor el 30/05/2026 — NO tornar a executar
bash scripts/baseline-pre-migrations.sh
```

---

## Gestió d'Usuaris

### Crear un nou usuari admin

L'endpoint `POST /api/auth/setup/user` requereix el `SETUP_TOKEN` al `.env.pre`. Si el token existeix:

```bash
# Al servidor
SETUP_TOKEN=$(grep SETUP_TOKEN .env.pre | cut -d'=' -f2)

curl -X POST http://204.168.221.131:3000/api/auth/setup/user \
  -H "X-Setup-Token: $SETUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "nou-admin@exemple.cat", "password": "ContraSenyaForta123!", "role": "ADMIN"}'
```

> **Atenció:** Si el membre ja existeix a la BD (importat del legacy), l'endpoint retorna l'usuari existent **sense modificar-lo**. En aquest cas cal usar SQL (veure a sota).

### Elevar el rol d'un usuari existent via SQL

```bash
docker exec -it muixer-postgres-pre psql -U muixer_pre -d muixer_pre -c \
  "UPDATE users SET role = 'ADMIN', \"isActive\" = true WHERE email = 'email@exemple.cat';"
```

### Assignar contrasenya a un usuari migrat del legacy (sense password)

```bash
# Generar el hash de la contrasenya nova
HASH=$(docker exec muixer-api-pre node -e \
  "require('bcrypt').hash('NovaContrasenya123!', 12).then(h => process.stdout.write(h))")

# Aplicar a la BD
docker exec -it muixer-postgres-pre psql -U muixer_pre -d muixer_pre -c \
  "UPDATE users SET \"passwordHash\" = '$HASH', role = 'ADMIN', \"isActive\" = true \
   WHERE email = 'email@exemple.cat';"
```

> El `SETUP_TOKEN` **hauria d'estar eliminat** del `.env.pre` un cop creats els administradors inicials. Si cal afegir-lo temporalment, recorda reiniciar l'API (`docker compose ... restart api`) i tornar a eliminar-lo.

---

## Configuració de Variables d'Entorn

### Referència de variables (`.env.pre`)

| Variable | Valor | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | No canviar |
| `PORT` | `3000` | No canviar |
| `DB_SSL` | `false` | Connexió per xarxa Docker interna |
| `POSTGRES_USER` | `muixer_pre` | Usuari de la BD |
| `POSTGRES_PASSWORD` | **Generar** | `openssl rand -base64 32` |
| `POSTGRES_DB` | `muixer_pre` | Nom de la BD |
| `DATABASE_URL` | `postgresql://muixer_pre:<password>@postgres:5432/muixer_pre` | Hostname `postgres` (servei Docker) |
| `DB_SYNC` | *(comentat)* | `true` només al primer arrencament si no hi ha migracions |
| `CORS_ORIGINS` | `http://204.168.221.131` | IP del servidor sense trailing slash |
| `COOKIE_SECURE` | `false` | `false` mentre s'accedeix per HTTP. Canviar a `true` amb HTTPS |
| `LEGACY_API_URL` | `https://colla-muixeranguera.appsistencia.cat` | No canviar |
| `LEGACY_API_USERNAME` | Credencial legacy | Demanar a l'administrador |
| `LEGACY_API_PASSWORD` | Credencial legacy | Demanar a l'administrador |
| `JWT_SECRET` | **Generar** | `openssl rand -base64 48` — mínim 64 chars |
| `JWT_ACCESS_TTL` | `900` | 15 minuts en segons |
| `JWT_REFRESH_SECRET` | **Generar** | **Ha de ser diferent de `JWT_SECRET`** |
| `JWT_REFRESH_TTL_DASHBOARD` | `28800` | 8 hores en segons |
| `JWT_REFRESH_TTL_PWA` | `604800` | 7 dies en segons |
| `REFRESH_TOKEN_COOKIE` | `muixer_rt` | No canviar |
| `SETUP_TOKEN` | **Generar / Eliminar** | `uuidgen` — **Eliminar un cop creats els admins** |
| `ASSIGNMENT_LOCK_DAYS` | `2` | Dies post-event per bloquejar assignacions |

> **⚠️ Important**: `DATABASE_URL` ha d'usar `postgres` com a hostname (nom del servei al `docker-compose.pre.yml`), mai `localhost`.

### Generar secrets (si cal re-crear el `.env.pre`)

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "SETUP_TOKEN=$(uuidgen)"
```

---

## Comandes de Gestió

### Des del servidor (`ssh root@204.168.221.131`)

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
| `./scripts/deploy-pre-update.sh` | Script automatitzat de redeploy |

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

Un cop activat HTTPS, actualitzar al `.env.pre`:
```
COOKIE_SECURE=true
CORS_ORIGINS=https://pre.muixerapp.cat
```

I reiniciar l'API: `docker compose -f docker-compose.pre.yml restart api`

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
# Errors d'arrencada de l'API (TypeORM, connexió BD, variables entorn, migracions)
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
SELECT id, email, role, "isActive" FROM users;

-- Estat de migracions aplicades
SELECT * FROM typeorm_migrations ORDER BY timestamp;

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

## Primer Desplegament (Referència — ja realitzat)

> Aquesta secció és per si s'ha de reconstruir PRE des de zero.

```bash
# 1. Connectar-se al servidor
ssh root@204.168.221.131

# 2. Clonar el repositori (si no existeix)
git clone git@github.com:MuixerangaBarcelonaCat/MuixerApp.git
cd MuixerApp

# 3. Configurar les variables d'entorn
cp .env.pre.example .env.pre
nano .env.pre  # Afegir secrets generats + credencials legacy

# 4. Construir les imatges i arrencar l'stack (~5-10 min el primer cop)
docker compose -f docker-compose.pre.yml up -d --build

# 5. Verificar estat (esperar que tots siguin "healthy")
watch -n 5 docker compose -f docker-compose.pre.yml ps

# 6. Verificar que l'API respon
curl -s http://204.168.221.131:3000/api/health

# 7. Crear el primer usuari administrador
SETUP_TOKEN=$(grep SETUP_TOKEN .env.pre | cut -d'=' -f2)
curl -X POST http://204.168.221.131:3000/api/auth/setup/user \
  -H "X-Setup-Token: $SETUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@muixer.cat", "password": "ContraSenyaForta123!", "role": "ADMIN"}'

# 8. ⚠️ Eliminar SETUP_TOKEN del .env.pre un cop creat l'admin
nano .env.pre   # Comentar o eliminar la línia SETUP_TOKEN=...

# 9. Reiniciar l'API per aplicar el canvi (sense rebuild)
docker compose -f docker-compose.pre.yml restart api
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

### Error de migració al boot ("relation already exists")

La migració `InitialSchema` intenta crear taules que ja existeixen. Solució: marcar-la com a aplicada.

```bash
bash scripts/baseline-pre-migrations.sh
```

### La sessió es perd en recarregar la pàgina (403 al refresh)

La cookie de refresh token té `Secure` flag activat però s'accedeix per HTTP. Verificar que al `.env.pre` hi ha:

```
COOKIE_SECURE=false
```

Reiniciar l'API: `docker compose -f docker-compose.pre.yml restart api`

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
| [`DOCKER_SETUP.md`](DOCKER_SETUP.md) | Configuració de Docker per a l'entorn de dev local |
| [`MIGRATION_NPM_TO_PNPM.md`](MIGRATION_NPM_TO_PNPM.md) | Migració del gestor de paquets — ja aplicada als Dockerfiles |

---

**Creat:** 26 de maig de 2026  
**Actualitzat:** 31 de maig de 2026  
**Estat:** ✅ PRE operatiu — `http://204.168.221.131`  
**Entorn:** Hetzner VPS · `204.168.221.131` · Ubuntu 24.04 LTS
