# P4.4: Migració a PostgreSQL Docker Local

> **Data de creació:** 7 de maig de 2026  
> **Estat:** 🟡 Disseny aprovat — Pendent d'implementació  
> **Autor:** Llorenç Vaquer

---

## Objectiu

Eliminar la dependència de NeonDB per desenvolupament local, proporcionant un entorn de desenvolupament autònom amb PostgreSQL en Docker. Això permet:

- ✅ Desenvolupar sense connexió a Internet
- ✅ Control total de les dades de desenvolupament
- ✅ Tests més ràpids (latència zero)
- ✅ Evitar límits de connexions simultànies de NeonDB Free Tier
- ✅ Facilitar l'onboarding de nous desenvolupadors

**Nota:** NeonDB es mantindrà per a entorns de staging i producció.

---

## Estat Actual

### Configuració NeonDB

```typescript
// apps/api/src/modules/database/database.module.ts
TypeOrmModule.forRootAsync({
  useFactory: () => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,  // NeonDB amb SSL
    ssl: { rejectUnauthorized: false },
    entities: [...],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
  }),
})
```

### Variables d'entorn actuals

```bash
# .env.example
DATABASE_URL=postgresql://user:pass@ep-xxx.region.neon.tech/muixer
```

---

## Proposta de Solució

### 1. Crear `docker-compose.yml` al root del projecte

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: muixer-postgres-dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: muixer
      POSTGRES_PASSWORD: muixer_dev_pass
      POSTGRES_DB: muixer_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U muixer -d muixer_dev']
      interval: 5s
      timeout: 3s
      retries: 5

  # Opcional: pgAdmin per gestió visual
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: muixer-pgadmin-dev
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@muixer.local
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_LISTEN_PORT: 5050
    ports:
      - '5050:5050'
    volumes:
      - pgadmin-data:/var/lib/pgadmin
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres-data:
  pgadmin-data:
```

### 2. Script d'inicialització de la base de dades

```sql
-- docker/postgres/init.sql
-- Crear extensió unaccent (necessària per cerques sense accents)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Configuració bàsica
ALTER DATABASE muixer_dev SET timezone TO 'Europe/Madrid';
```

### 3. Actualitzar `database.module.ts`

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Position } from '../position/position.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Season } from '../season/season.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const databaseUrl = process.env.DATABASE_URL;
        
        // Detectar si és NeonDB (per staging/producció) o local
        const isNeonDB = databaseUrl?.includes('neon.tech');

        return {
          type: 'postgres',
          url: databaseUrl,
          // SSL només per NeonDB (remot)
          ssl: isNeonDB ? { rejectUnauthorized: false } : false,
          entities: [Position, User, Person, Season, Event, Attendance, RefreshToken],
          synchronize: isDevelopment,
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // Ja no cal crear l'extensió aquí, està a init.sql
    // Deixem el mètode per futures inicialitzacions
  }
}
```

### 4. Actualitzar `.env.example` i `.env`

```bash
# .env.example

# PostgreSQL — Docker local (per defecte en desenvolupament)
DATABASE_URL=postgresql://muixer:muixer_dev_pass@localhost:5432/muixer_dev

# Per staging/producció: Descomentar la línia següent i comentar la de dalt
# DATABASE_URL=postgresql://user:pass@ep-xxx.region.neon.tech/muixer

NODE_ENV=development
PORT=3000

# CORS (comma-separated list of allowed origins)
CORS_ORIGINS=http://localhost:4200,http://localhost:4300

# Legacy API (sync)
LEGACY_API_URL=https://colla-muixeranguera.appsistencia.cat
LEGACY_API_USERNAME=XXXXXX
LEGACY_API_PASSWORD=XXXXXX

# JWT — Access Token
JWT_SECRET=change-me-strong-random-secret
JWT_ACCESS_TTL=900

# JWT — Refresh Token (separate secret!)
JWT_REFRESH_SECRET=change-me-different-strong-secret
JWT_REFRESH_TTL_DASHBOARD=28800
JWT_REFRESH_TTL_PWA=604800

REFRESH_TOKEN_COOKIE=muixer_rt

# Bootstrap setup endpoint — remove from production after first user is created
SETUP_TOKEN=change-me-random-uuid
```

### 5. Scripts npm per gestió de Docker

Afegir a `package.json`:

```json
{
  "scripts": {
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f postgres",
    "docker:clean": "docker compose down -v",
    "docker:psql": "docker exec -it muixer-postgres-dev psql -U muixer -d muixer_dev",
    "db:setup": "npm run docker:up && nx run api:db:seed",
    "db:reset": "npm run docker:clean && npm run db:setup"
  }
}
```

### 6. Crear script de seed per dades de desenvolupament

```typescript
// apps/api/src/modules/database/seed/seed.script.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🌱 Iniciant seed de base de dades...\n');

  try {
    // 1. Netejar base de dades
    console.log('🗑️  Netejant base de dades...');
    await dataSource.query('TRUNCATE TABLE "user", "person", "position", "season", "event", "attendance", "refresh_token" RESTART IDENTITY CASCADE');

    // 2. Crear posicions
    console.log('📍 Creant posicions...');
    const positions = await dataSource.query(`
      INSERT INTO "position" (name, "sortOrder")
      VALUES 
        ('Baix', 1),
        ('Contrafort', 2),
        ('Segon', 3),
        ('Tercer', 4),
        ('Quart', 5),
        ('Pilar', 6),
        ('Enxaneta', 7),
        ('Agulla', 8)
      RETURNING id, name
    `);
    console.log(`   ✅ ${positions.length} posicions creades`);

    // 3. Crear usuari tècnic inicial
    console.log('👤 Creant usuari tècnic...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const [user] = await dataSource.query(`
      INSERT INTO "user" (email, password, role)
      VALUES ('admin@muixer.local', $1, 'TECHNICAL')
      RETURNING id, email
    `, [hashedPassword]);
    console.log(`   ✅ Usuari creat: ${user.email}`);

    // 4. Crear persona associada
    console.log('👥 Creant persona associada...');
    const [person] = await dataSource.query(`
      INSERT INTO "person" (name, surnames, alias, email, "isMember", "userId")
      VALUES ('Admin', 'Tècnic', 'admin', 'admin@muixer.local', true, $1)
      RETURNING id, alias
    `, [user.id]);
    console.log(`   ✅ Persona creada: ${person.alias}`);

    // 5. Crear temporades
    console.log('📅 Creant temporades...');
    const seasons = await dataSource.query(`
      INSERT INTO "season" (name, "startDate", "endDate")
      VALUES 
        ('Temporada 2024-2025', '2024-09-01', '2025-08-31'),
        ('Temporada 2025-2026', '2025-09-01', '2026-08-31')
      RETURNING id, name
    `);
    console.log(`   ✅ ${seasons.length} temporades creades`);

    // 6. Crear esdeveniments de prova
    console.log('📆 Creant esdeveniments de prova...');
    const events = await dataSource.query(`
      INSERT INTO "event" (title, "eventType", date, location, "seasonId", "attendanceSummary")
      VALUES 
        ('Assaig General', 'ASSAIG', NOW() + INTERVAL '1 day', 'Local', $1, '{}'),
        ('Diada de Sant Jordi', 'ACTUACIO', NOW() + INTERVAL '7 days', 'Plaça Major', $1, '{}')
      RETURNING id, title
    `, [seasons[1].id]);
    console.log(`   ✅ ${events.length} esdeveniments creats`);

    console.log('\n✨ Seed completat amb èxit!\n');
    console.log('📋 Credencials d\'accés:');
    console.log('   Email: admin@muixer.local');
    console.log('   Password: admin123\n');

  } catch (error) {
    console.error('❌ Error durant el seed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
```

Afegir target a `apps/api/project.json`:

```json
{
  "targets": {
    "db:seed": {
      "executor": "nx:run-commands",
      "options": {
        "command": "ts-node -r tsconfig-paths/register apps/api/src/modules/database/seed/seed.script.ts",
        "cwd": "."
      }
    }
  }
}
```

---

## Pla d'Implementació

### Fase 1: Configuració Docker (30 min)

1. ✅ Crear `docker-compose.yml` al root
2. ✅ Crear `docker/postgres/init.sql`
3. ✅ Afegir scripts npm per gestió Docker
4. ✅ Actualitzar `.gitignore` (afegir `.env`, ignorar `docker/postgres/data`)

### Fase 2: Adaptació del codi (45 min)

1. ✅ Modificar `database.module.ts` per detectar NeonDB vs local
2. ✅ Actualitzar `.env.example` amb nova `DATABASE_URL`
3. ✅ Crear script de seed (`seed.script.ts`)
4. ✅ Afegir target `db:seed` a `apps/api/project.json`
5. ✅ Actualitzar `README.md` amb instruccions Docker

### Fase 3: Migració de dades de NeonDB (1-2 hores)

**Opció A: Dump i restore (recomanat per >1000 registres)**

```bash
# 1. Fer dump de NeonDB
pg_dump $NEON_DATABASE_URL --no-owner --no-acl --clean --if-exists -f backup.sql

# 2. Arrencar Docker local
npm run docker:up

# 3. Restaurar dump a Docker
docker exec -i muixer-postgres-dev psql -U muixer -d muixer_dev < backup.sql

# 4. Verificar dades
npm run docker:psql
```

**Opció B: Script de migració TypeORM (recomanat per <1000 registres)**

```typescript
// apps/api/src/modules/database/migrate/migrate-from-neon.script.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('🔄 Iniciant migració de NeonDB a Docker local...\n');

  // Connexió a NeonDB (origen)
  const neonDataSource = new DataSource({
    type: 'postgres',
    url: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await neonDataSource.initialize();
  console.log('✅ Connectat a NeonDB');

  // Connexió a Docker local (destinació)
  const app = await NestFactory.createApplicationContext(AppModule);
  const localDataSource = app.get(DataSource);
  console.log('✅ Connectat a Docker local\n');

  try {
    // Copiar dades per ordre de dependències
    const tables = ['position', 'user', 'person', 'season', 'event', 'attendance', 'refresh_token'];

    for (const table of tables) {
      console.log(`📦 Copiant taula "${table}"...`);
      
      // Llegir dades de NeonDB
      const rows = await neonDataSource.query(`SELECT * FROM "${table}"`);
      
      if (rows.length === 0) {
        console.log(`   ⚠️  Taula buida, saltant...`);
        continue;
      }

      // Deshabilitar triggers temporalment
      await localDataSource.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);

      // Inserir dades a Docker
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        await localDataSource.query(
          `INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }

      // Reactivar triggers
      await localDataSource.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);

      console.log(`   ✅ ${rows.length} registres copiats`);
    }

    // Actualitzar seqüències
    console.log('\n🔢 Actualitzant seqüències...');
    for (const table of tables) {
      await localDataSource.query(`
        SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE(MAX(id), 1), true)
        FROM "${table}"
      `);
    }

    console.log('\n✨ Migració completada amb èxit!\n');

  } catch (error) {
    console.error('❌ Error durant la migració:', error);
    process.exit(1);
  } finally {
    await neonDataSource.destroy();
    await app.close();
  }
}

bootstrap();
```

Afegir script a `package.json`:

```json
{
  "scripts": {
    "db:migrate-from-neon": "NEON_DATABASE_URL=<neon-url> ts-node -r tsconfig-paths/register apps/api/src/modules/database/migrate/migrate-from-neon.script.ts"
  }
}
```

### Fase 4: Testing i validació (30 min)

1. ✅ Verificar que l'API arrenca correctament
2. ✅ Executar totes les test suites (`nx test api && nx test dashboard`)
3. ✅ Provar login al dashboard
4. ✅ Provar sync amb legacy API
5. ✅ Verificar CRUD de persones, events i assistència

### Fase 5: Documentació (15 min)

1. ✅ Actualitzar `README.md` amb setup Docker
2. ✅ Crear `docs/DOCKER_SETUP.md` amb troubleshooting
3. ✅ Actualitzar `.cursor/rules/muixer-project.mdc` (mencionar Docker)

---

## Canvis Necessaris en Fitxers

### Fitxers nous a crear

```
docker-compose.yml
docker/postgres/init.sql
apps/api/src/modules/database/seed/seed.script.ts
apps/api/src/modules/database/migrate/migrate-from-neon.script.ts  (opcional)
docs/DOCKER_SETUP.md
```

### Fitxers a modificar

```
apps/api/src/modules/database/database.module.ts  (detectar SSL)
.env.example  (actualitzar DATABASE_URL)
.env  (canviar a localhost)
package.json  (afegir scripts Docker)
apps/api/project.json  (target db:seed)
README.md  (instruccions Docker)
.gitignore  (afegir .env, docker volumes)
.cursor/rules/muixer-project.mdc  (mencionar Docker)
```

---

## Eliminar Rastres de NeonDB

### Passos per netejar dades de NeonDB

1. **Fer backup de seguretat** (per si de cas):
   ```bash
   pg_dump <NEON_DATABASE_URL> -f neon-backup-$(date +%Y%m%d).sql
   ```

2. **Eliminar totes les taules a NeonDB**:
   ```sql
   -- Connectar a NeonDB via psql o pgAdmin
   DROP TABLE IF EXISTS refresh_token CASCADE;
   DROP TABLE IF EXISTS attendance CASCADE;
   DROP TABLE IF EXISTS event CASCADE;
   DROP TABLE IF EXISTS season CASCADE;
   DROP TABLE IF EXISTS person CASCADE;
   DROP TABLE IF EXISTS user CASCADE;
   DROP TABLE IF EXISTS position CASCADE;
   ```

3. **Opcional: Eliminar la base de dades sencera** (via NeonDB Dashboard):
   - Accedir a https://console.neon.tech
   - Seleccionar el projecte
   - Anar a "Settings" → "Delete project"

4. **Eliminar credencials de NeonDB de `.env`**:
   ```bash
   # Mantenir només per referència (comentat)
   # DATABASE_URL=postgresql://user:pass@ep-xxx.region.neon.tech/muixer
   ```

5. **Actualitzar documentació**:
   - Eliminar referències a NeonDB de `README.md`
   - Actualitzar `docs/PROJECT_ROADMAP.md` (marcar P0 com "migrat a Docker")

---

## Avantatges de la Migració

| Aspecte | Abans (NeonDB) | Després (Docker Local) |
|---------|----------------|------------------------|
| **Connectivitat** | Requereix Internet | Funciona offline |
| **Latència** | ~50-200ms (Europa) | <1ms (localhost) |
| **Límits de connexions** | 100 (Free Tier) | Il·limitades |
| **Control de dades** | Cloud (Neon) | Local complet |
| **Onboarding devs** | Compartir credencials | `docker compose up` |
| **Tests d'integració** | Lents (latència) | Ràpids |
| **Cost** | Free Tier (límits) | Gratuït (només recursos locals) |

---

## Consideracions de Seguretat

### Desenvolupament (Docker local)

- ✅ Password simple OK (`muixer_dev_pass`)
- ✅ Port 5432 exposat OK (només localhost)
- ✅ Dades fake/test → no cal encriptació

### Staging / Producció (NeonDB)

- ⚠️ Mantenir SSL activat
- ⚠️ Passwords forts en variables d'entorn
- ⚠️ No exposar credencials de producció

---

## Rollback Plan

Si la migració falla o hi ha problemes:

1. **Canviar `DATABASE_URL` a NeonDB** a `.env`
2. **Reiniciar l'API** (`nx serve api`)
3. **Restaurar backup** si cal:
   ```bash
   psql $NEON_DATABASE_URL < neon-backup-YYYYMMDD.sql
   ```

---

## Checklist de Validació

### Pre-migració

- [ ] Backup de NeonDB creat
- [ ] Docker Desktop instal·lat i funcionant
- [ ] Variables d'entorn verificades

### Post-migració

- [ ] Docker compose up funciona
- [ ] L'API arrenca sense errors
- [ ] Tests backend 101/101 passing
- [ ] Tests frontend 22/22 passing
- [ ] Login al dashboard OK
- [ ] CRUD persones OK
- [ ] CRUD events OK
- [ ] Sync legacy API OK

---

## Pròxims Passos (després de P4.4)

Un cop completada aquesta iteració:

1. **P5: Mòdul Pinyes i Figures** — Canvas per disseny de figures
2. **P6: PWA Mòbil** — App per membres (autogestió assistència)
3. **Deployments** — Configurar staging + producció amb NeonDB

---

## Referències

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [TypeORM DataSource](https://typeorm.io/data-source)
- [NeonDB Branching](https://neon.tech/docs/introduction/branching)

---

**Estat:** 🟡 **Disseny complet — Llest per implementar**
