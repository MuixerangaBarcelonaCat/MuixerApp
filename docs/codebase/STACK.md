# Stack Tecnològic — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Evidència: fitxers del repositori verificats. Cap suposició no contrastada.

---

## 1. Resum del Runtime

| Àrea | Valor | Evidència |
|------|-------|-----------|
| Llenguatge principal | TypeScript ~5.9.2 | `package.json` devDependencies |
| Runtime (backend) | Node.js (LTS) | `apps/api/webpack.config.js`, `jest.config.ts` |
| Runtime (frontend) | Navegador (Angular) | `apps/dashboard/src/main.ts` |
| Gestor de paquets | npm (workspaces) | `package-lock.json` lockfileVersion 3 |
| Sistema de build | Nx 22.6.3 | `nx.json`, `package.json` devDependencies |

---

## 2. Dependències de Producció

### Backend (NestJS)

| Dependència | Versió | Rol |
|-------------|--------|-----|
| `@nestjs/common`, `@nestjs/core` | ^11.1.17 | Framework principal del backend |
| `@nestjs/platform-express` | ^11.1.17 | Servidor HTTP via Express |
| `@nestjs/jwt` | ^11.0.2 | Signatura i verificació de JWT |
| `@nestjs/passport` | ^11.0.5 | Integració Passport.js amb NestJS |
| `@nestjs/swagger` | ^11.2.6 | Documentació OpenAPI / Swagger UI |
| `@nestjs/throttler` | ^6.5.0 | Rate limiting per endpoint |
| `@nestjs/typeorm` | ^11.0.0 | Integració TypeORM amb NestJS |
| `typeorm` | ^0.3.28 | ORM per a PostgreSQL |
| `pg` | ^8.20.0 | Driver PostgreSQL |
| `passport`, `passport-jwt`, `passport-local` | ^0.7 / ^4 / ^1 | Estratègies d'autenticació |
| `bcrypt` | ^6.0.0 | Hashing de contrasenyes (cost 12+) |
| `cookie-parser` | ^1.4.7 | Parsing de cookies httpOnly |
| `class-validator` | ^0.15.1 | Validació de DTOs |
| `class-transformer` | ^0.5.1 | Serialització/deserialització d'objectes |
| `axios` | ^1.6.0 | Client HTTP per accedir al legacy API |
| `xlsx` | ^0.18.5 | Parsing de fitxers Excel (assistència) |
| `nest-commander` | ^3.20.1 | CLI per a scripts de seed/importació |
| `dotenv` | ^17.3.1 | Càrrega de variables d'entorn |

### Frontend (Angular)

| Dependència | Versió | Rol |
|-------------|--------|-----|
| `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/router` | ~21.2.0 | Framework Angular (standalone components) |
| `@angular/platform-browser` | ~21.2.0 | Renderitzat al navegador |
| `@angular/cdk` | ^21.2.4 | Component Development Kit |
| `rxjs` | ^7.8.2 | Programació reactiva (interceptors, observables) |
| `lucide-angular` | ^1.0.0 | Biblioteca d'icones SVG (tree-shakeable) |
| `tailwindcss` | ^3.4.19 | Utilitats CSS (versió 3, no v4) |

### Shared (`libs/shared`)

| Dependència | Versió | Rol |
|-------------|--------|-----|
| `reflect-metadata` | ^0.1.14 | Necessari per decoradors TypeScript/NestJS |

---

## 3. Eines de Desenvolupament

| Eina | Propòsit | Evidència |
|------|----------|-----------|
| Nx 22.6.3 | Monorepo: build, test, cache, projectes | `nx.json` |
| ESLint 9.x | Linting TypeScript i Angular | `apps/dashboard/eslint.config.mjs` |
| Prettier 3.6.x | Formatació (single quotes) | `.prettierrc` |
| Jest 30.x + ts-jest | Tests unitaris del backend (NestJS) | `apps/api/jest.config.ts` |
| Vitest 4.x | Tests unitaris del frontend (Angular) | `apps/dashboard/tsconfig.spec.json` |
| Playwright 1.36+ | Tests E2E | `apps/dashboard-e2e/playwright.config.ts` |
| @swc/core + @swc-node | Compilació ràpida (SWC) | `package.json` devDependencies |
| DaisyUI 4.12.x | Components UI / sistema de temes | `package.json` devDependencies |
| Angular CLI 21.x | Generació i build d'Angular | `package.json` devDependencies |
| Webpack 5 (via @nx/webpack) | Bundle del backend NestJS | `apps/api/webpack.config.js` |

---

## 4. Comandes Clau

```bash
# Instal·lació
npm install

# Iniciar backend (mode dev)
nx serve api

# Iniciar dashboard (mode dev)
nx serve dashboard

# Build de producció
nx build api
nx build dashboard

# Tests unitaris
nx test api
nx test dashboard

# Tests E2E
nx e2e dashboard-e2e

# Linting
nx lint api
nx lint dashboard

# Tots els tests del monorepo
nx run-many -t test
```

---

## 5. Entorn i Configuració

**Font de configuració:** fitxer `.env` (copiar de `.env.example`)

| Variable | Exemple | Descripció |
|----------|---------|------------|
| `DATABASE_URL` | `postgresql://user:pass@host/muixer` | Connexió a NeonDB (PostgreSQL) |
| `NODE_ENV` | `development` | Entorn d'execució |
| `PORT` | `3000` | Port del servidor API |
| `CORS_ORIGINS` | `http://localhost:4200,http://localhost:4300` | Orígens permesos (CSV) |
| `LEGACY_API_URL` | `https://colla.appsistencia.cat` | URL del sistema legacy (sync) |
| `LEGACY_API_USERNAME` | `XXXXXX` | Credencial del legacy API |
| `LEGACY_API_PASSWORD` | `XXXXXX` | Credencial del legacy API |
| `JWT_SECRET` | `secret-64-chars` | Secret per signar access tokens |
| `JWT_ACCESS_TTL` | `900` | Vida del access token en segons (15 min) |
| `JWT_REFRESH_SECRET` | `secret-diferent` | Secret per signar refresh tokens |
| `JWT_REFRESH_TTL_DASHBOARD` | `28800` | Vida del refresh token Dashboard (8h) |
| `JWT_REFRESH_TTL_PWA` | `604800` | Vida del refresh token PWA (7 dies) |
| `REFRESH_TOKEN_COOKIE` | `muixer_rt` | Nom de la cookie httpOnly |
| `SETUP_TOKEN` | `uuid-aleatori` | Token per crear el primer usuari TECHNICAL |

> ⚠️ **Important**: eliminar `SETUP_TOKEN` del `.env` en producció després del primer ús.

---

## 6. Evidència

- `package.json` — dependències i devDependencies
- `package-lock.json` — versions exactes instal·lades
- `.env.example` — variables d'entorn requerides
- `apps/api/jest.config.ts` — configuració de tests backend
- `apps/dashboard/tsconfig.spec.json` — configuració de tests frontend
- `nx.json` — configuració del monorepo
- `.prettierrc` — formatació (single quotes)
