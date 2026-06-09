# Migració npm → pnpm

> Estat: ✅ Canvis de fitxers aplicats — **pendent executar localment** (veure Pas 5)

---

## Context i Motivació

| Aspecte | npm | pnpm |
|---------|-----|------|
| Velocitat d'instal·lació | referència | 2× – 3× més ràpid |
| Ús de disc | Duplica cada paquet per projecte | Store global compartit (hard links) |
| Lock file | `package-lock.json` | `pnpm-lock.yaml` (llegible, determinístic) |
| Aïllament de dependències | Hoisting implícit | Estricte (detecta deps fantasma) |
| Compatibilitat Nx 22 | ✅ | ✅ |

---

## Resum de Canvis

| Fitxer | Estat | Descripció |
|--------|-------|------------|
| `pnpm-workspace.yaml` | ✅ Creat | Declara els workspaces (`apps/`, `libs/`) |
| `package.json` | ✅ Modificat | `overrides` → `pnpm.overrides`, afegit `packageManager` |
| `.npmrc` | ✅ Modificat | Afegit `shamefully-hoist=true` per compatibilitat Angular/Nx |
| `package-lock.json` | ⏳ Pendent | Eliminar manualment un cop generat `pnpm-lock.yaml` |
| `pnpm-lock.yaml` | ⏳ Pendent | Generar localment via `pnpm import` |
| `apps/api/Dockerfile` | ✅ Modificat | `npm ci` → `pnpm install`, stages 1 i 3 |
| `apps/dashboard/Dockerfile` | ✅ Modificat | `npm ci` → `pnpm install`, stage 1 (stage 3 usa Caddy) |
| `.github/workflows/ci.yml` | ✅ Modificat | Setup pnpm, cache actualitzat, `pnpm install --frozen-lockfile` |

---

## Pas Pendent: Executar Localment

Els canvis als fitxers de configuració ja estan aplicats al repositori. L'únic que queda és **generar el lock file i eliminar l'antic** a la màquina de dev:

### 1. Instal·lar pnpm (si no el tens)

```bash
corepack enable
corepack prepare pnpm@latest --activate

# Verificar
pnpm --version
```

### 2. Actualitzar el camp `packageManager` a `package.json`

El fitxer `package.json` té `"packageManager": "pnpm@9.15.9"` com a placeholder.  
Substituir pel número de versió real instal·lat:

```bash
# Obtenir la versió instal·lada
pnpm --version
# → ex. 9.12.3

# Editar package.json i canviar "packageManager": "pnpm@9.15.9" per la versió real
```

### 3. Generar `pnpm-lock.yaml` i eliminar `package-lock.json`

```bash
# Importar el lock file existent (manté les versions exactes sense actualitzar res)
pnpm import

# Verificar que la instal·lació funciona
pnpm install --frozen-lockfile

# Eliminar l'antic lock file
rm package-lock.json
```

### 4. Verificació final

```bash
# Build local complet
pnpm run ci:local

# Build Docker de l'API (sense cache)
docker build -f apps/api/Dockerfile . --no-cache --progress=plain

# Build Docker del Dashboard (sense cache)
docker build -f apps/dashboard/Dockerfile . --no-cache --progress=plain
```

### 5. Fer commit i push

```bash
git add pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc
git rm package-lock.json
git commit -m "chore: migrate from npm to pnpm"
git push
```

---

## Detall dels Canvis Aplicats

### `package.json`

```diff
+  "packageManager": "pnpm@9.15.9",   ← actualitzar amb la versió real
   "engines": {
     "node": ">=22.13.0 <23.0.0"
   },
```

```diff
-  "overrides": {
-    "@noble/hashes": "2.2.0"
-  }
+  "pnpm": {
+    "overrides": {
+      "@noble/hashes": "2.2.0"
+    }
+  }
```

### `.npmrc`

```diff
   engine-strict=true
+  shamefully-hoist=true
```

### `apps/api/Dockerfile` — Stage 1

```diff
-COPY package*.json ./
-RUN npm ci
+RUN corepack enable
+COPY package.json pnpm-lock.yaml .npmrc ./
+RUN pnpm install --frozen-lockfile
```

### `apps/api/Dockerfile` — Stage 3

```diff
-RUN npm install --omit=dev
+RUN corepack enable
+RUN pnpm install --prod --no-lockfile
```

### `apps/dashboard/Dockerfile` — Stage 1

```diff
-COPY package*.json ./
-RUN npm ci
+RUN corepack enable
+COPY package.json pnpm-lock.yaml .npmrc ./
+RUN pnpm install --frozen-lockfile
```

### `.github/workflows/ci.yml`

```diff
+      - name: Setup pnpm
+        uses: pnpm/action-setup@v4

         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version-file: .node-version
-            cache: npm
-            cache-dependency-path: package-lock.json
+            cache: pnpm

-          key: nx-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-${{ github.sha }}
+          key: nx-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}

-        run: npm ci
+        run: pnpm install --frozen-lockfile
```

---

## Notes de Compatibilitat

### Nx 22 + pnpm

Nx 22 té suport natiu per a pnpm workspaces. Detecta automàticament `pnpm-workspace.yaml`. No cal configuració addicional a `nx.json`.

### Scripts de `package.json`

Tots els scripts existents (`docker:pre:up`, `docker:prod:up`, `ci:local`, etc.) funcionen exactament igual amb `pnpm run <script>`.

### `shamefully-hoist=true`

Necessari perquè Angular CLI i NestJS depenen de paquets que no declaren totes les seves peer-deps explícitament. Fa que pnpm es comporti com npm pel que fa al hoisting, sense cap cost pràctic.

---

## Documentació a Actualitzar (post-migració)

Un cop el CI validi la migració, actualitzar les referències a `npm` en:

| Document | Canvis |
|----------|--------|
| `docs/DOCKER_SETUP.md` | `npm install` → `pnpm install`, `npm run docker:*` → `pnpm run docker:*` |

---

**Creat:** 26 de maig de 2026
**Actualitzat:** 26 de maig de 2026
**Estat:** ✅ Fitxers aplicats — ⏳ Pendent executar `pnpm import` i `rm package-lock.json` localment
