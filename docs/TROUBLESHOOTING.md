# Troubleshooting

## API no arrenca

### Error: "Cannot find module '@muixer/shared'"

**Causa**: La llibreria shared no està compilada.

**Solució**:
```bash
npx nx build shared
npx nx build api
```

### Error: "Data type 'Object' is not supported by postgres"

**Causa**: TypeORM no pot inferir el tipus de dades d'una columna.

**Solució**: Afegir `type: 'varchar'` o el tipus corresponent al decorador `@Column()`:

```typescript
// ❌ MAL
@Column({ nullable: true })
description: string | null;

// ✅ BÉ
@Column({ type: 'varchar', nullable: true })
description: string | null;
```

### Error: Loop infinit de reinicis amb `nx serve api`

**Causa**: El watch mode detecta canvis constantment i reinicia.

**Solució**: Usar execució directa sense watch:
```bash
npx nx build api
node dist/apps/api/main.js
```

O usar la configuració sense watch:
```bash
npx nx serve api --configuration=no-watch
```

### Error: "Unable to connect to the database"

**Causa**: La `DATABASE_URL` no és correcta o la base de dades no està accessible.

**Solució**:
1. Verificar que `.env` existeix i conté una `DATABASE_URL` vàlida
2. Comprovar que la base de dades està accessible (ping al host)
3. Eliminar paràmetres problemàtics com `channel_binding=require`

```bash
# ✅ BÉ
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# ❌ MAL (pot causar problemes)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&channel_binding=require
```

## Dashboard no arrenca

### Error: "Port 4200 is already in use"

**Causa**: Hi ha un procés anterior ocupant el port.

**Solució**:
```bash
# Trobar el procés
lsof -ti:4200

# Matar-lo
kill -9 $(lsof -ti:4200)

# O usar un port diferent
npx nx serve dashboard --port=4201
```

### Error: "EMFILE: too many open files"

**Causa**: El sistema de watch intenta observar massa fitxers simultàniament.

**Solució**:
```bash
# Augmentar el límit de fitxers oberts (temporal)
ulimit -n 10000

# Després arrencar el dashboard
npx nx serve dashboard
```

**Nota**: Aquest error NO impedeix que l'aplicació funcioni, només genera avisos al watch mode.

Per fer-ho permanent (macOS):
```bash
# Afegir a ~/.zshrc o ~/.bashrc
echo "ulimit -n 10000" >> ~/.zshrc
```

### Error: Tailwind CSS no funciona

**Causa**: Versió incorrecta de Tailwind o configuració errònia.

**Solució**: Assegura't que tens Tailwind v3:
```bash
npm install tailwindcss@^3.4.0 --legacy-peer-deps
```

Verifica que existeixen:
- `tailwind.config.js` (arrel del projecte)
- `postcss.config.js` a `apps/dashboard/` i `apps/pwa/`
- `@tailwind` directives als fitxers `styles.scss`

## Tests fallen

### Error: "Cannot find name 'describe' or 'it'"

**Causa**: Els fitxers de test no tenen els tipus de Jest configurats.

**Solució**: Verificar que `tsconfig.spec.json` inclou:
```json
{
  "compilerOptions": {
    "types": ["jest", "node"]
  }
}
```

### Error: "Property has no initializer"

**Causa**: `strictPropertyInitialization` està activat.

**Solució**: Desactivar-lo per TypeORM entities:
```json
{
  "compilerOptions": {
    "strictPropertyInitialization": false
  }
}
```

## Build falla

### Error: Test files included in build

**Causa**: Els fitxers `.spec.ts` s'estan incloent al build de producció.

**Solució**: Afegir `exclude` al `tsconfig.app.json`:
```json
{
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts", "jest.config.ts"]
}
```

## Problemes de dependències

### Error: "ERESOLVE could not resolve"

**Causa**: Conflictes de versions entre dependències.

**Solució**: Usar `--legacy-peer-deps`:
```bash
npm install <package> --legacy-peer-deps
```

## Problemes de watch mode

### Reinicis constants

Si el watch mode reinicia constantment:

1. **Verificar que no hi ha errors de connexió** a la base de dades
2. **Usar execució directa** sense watch: `node dist/apps/api/main.js`
3. **Verificar que no hi ha fitxers que es modifiquen constantment** (logs, cache, etc.)

### Watch mode massa lent

Si el watch mode és massa lent:

1. **Augmentar el límit de fitxers**: `ulimit -n 10000`
2. **Excloure directoris innecessaris** al `.gitignore` i watch config
3. **Usar execució directa** per a testing ràpid

## Verificació del sistema

### Comprovar que tot funciona

```bash
# 1. Build
npx nx build shared
npx nx build api

# 2. Tests
npx nx test api

# 3. Executar API
node dist/apps/api/main.js
# Hauria de veure: 🚀 Application is running on: http://localhost:3000/api

# 4. Executar Dashboard (en un altre terminal)
npx nx serve dashboard
# Hauria de veure: ➜  Local:   http://localhost:4200/

# 5. Verificar endpoints
curl http://localhost:3000/api
curl http://localhost:3000/api/positions
```

### Verificar connexió a base de dades

```bash
# Executar l'API i comprovar els logs
node dist/apps/api/main.js

# Hauria de veure:
# [Nest] LOG [InstanceLoader] DatabaseModule dependencies initialized +35ms
# [Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized +0ms
```

Si veus errors de connexió, revisar la `DATABASE_URL` al `.env`.

## Recursos

- [NestJS Troubleshooting](https://docs.nestjs.com/faq)
- [TypeORM Common Issues](https://typeorm.io/faq)
- [Nx Troubleshooting](https://nx.dev/troubleshooting/troubleshoot-nx-install-issues)
- [Angular CLI Errors](https://angular.dev/tools/cli/errors)
