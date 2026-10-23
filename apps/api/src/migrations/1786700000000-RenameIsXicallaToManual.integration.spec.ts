// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the rename keeps the data: persons seeded with each flag value keep it under the new
 * column name, the old name is gone, and reverting brings the old name back with the same values.
 */
describe('RenameIsXicallaToManual (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'RenameIsXicallaToManual1786700000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);
  const before = migrations.slice(0, targetIndex);
  const upToTarget = migrations.slice(0, targetIndex + 1);

  const dataSourceFor = (list: typeof migrations) =>
    new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: ENTITIES,
      migrations: list,
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: false,
    });

  const personColumns = async (): Promise<string[]> =>
    (
      await dataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'persons' AND column_name LIKE 'isXicalla%' ORDER BY column_name`,
      )
    ).map((r: { column_name: string }) => r.column_name);

  const flags = async (column: string): Promise<Record<string, boolean>> =>
    Object.fromEntries(
      (await dataSource.query(`SELECT "alias", "${column}" AS flag FROM "persons"`)).map(
        (r: { alias: string; flag: boolean }) => [r.alias, r.flag],
      ),
    );

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(before);
    await pre.initialize();
    await pre.runMigrations();
    await pre.query(
      `INSERT INTO "persons" ("name", "firstSurname", "alias", "isXicalla")
       VALUES ('Anna', 'Peris', 'anna', true), ('Biel', 'Soler', 'biel', false)`,
    );
    await pre.destroy();

    dataSource = dataSourceFor(upToTarget);
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('renames the column', async () => {
    expect(await personColumns()).toEqual(['isXicallaManual']);
  });

  it('keeps every person’s flag', async () => {
    expect(await flags('isXicallaManual')).toEqual({ anna: true, biel: false });
  });

  it('defaults the manual flag to false for new persons', async () => {
    await dataSource.query(`INSERT INTO "persons" ("name", "firstSurname", "alias") VALUES ('Carla', 'Vidal', 'carla')`);
    expect((await flags('isXicallaManual')).carla).toBe(false);
  });

  it('brings the old column name back on revert, with the same values', async () => {
    await dataSource.undoLastMigration();

    expect(await personColumns()).toEqual(['isXicalla']);
    expect(await flags('isXicalla')).toEqual({ anna: true, biel: false, carla: false });
  });
});
