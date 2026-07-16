// Testcontainers' "Ryuk" reaper sidecar needs to ping the Docker socket from inside its own
// container; on rootless/SELinux-restricted Docker (common on dev machines and some CI runners)
// that ping is denied and container startup fails outright. We always call `container.stop()`
// ourselves in `teardownIntegrationDb`, so Ryuk's only job — reaping containers left behind by a
// crashed process — isn't load-bearing here; disable it rather than require a specific Docker setup.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from '../migrations';

export interface IntegrationDb {
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
}

/** Starts a real, disposable Postgres container and runs every real migration against it — used by `*.integration.spec.ts` suites that need to prove behavior only observable through actual SQL execution (see TEST-2 in docs/automated-analyses/01-full-repo-audit.md). */
export async function setupIntegrationDb(): Promise<IntegrationDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const dataSource = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: ENTITIES,
    migrations,
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  await dataSource.runMigrations();

  return { container, dataSource };
}

export async function teardownIntegrationDb({ container, dataSource }: IntegrationDb): Promise<void> {
  await dataSource.destroy();
  await container.stop();
}

/** Wipes every mapped table between tests so suites can share one container without leaking state. */
export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas.map((m) => `"${m.tableName}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

/** Builds the `{ provide, useValue }` pairs `Test.createTestingModule` needs to hand a service its real repositories instead of mocks. */
export function realRepositoryProviders(dataSource: DataSource, entities: EntityClassOrSchema[]) {
  return entities.map((entity) => ({
    provide: getRepositoryToken(entity),
    useValue: dataSource.getRepository(entity),
  }));
}
