// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the rehearsal defaults: the existing settings row gets the title the event form used to
 * hard-code, and the most common rehearsal start time and place; the database refuses a time that
 * isn't `HH:mm`, and reverting drops every column it added.
 */
describe('AddRehearsalDefaults (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'AddRehearsalDefaults1786600000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);
  const settingsRow = async () => (await dataSource.query(`SELECT * FROM "colla_settings"`))[0];

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: ENTITIES,
      migrations: migrations.slice(0, targetIndex + 1),
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('gives the existing settings the default rehearsal title, start time and place', async () => {
    expect(await settingsRow()).toMatchObject({
      rehearsalDefaultTitle: 'Assaig general',
      rehearsalDefaultStartTime: '18:45',
      rehearsalDefaultLocation: 'Lleialtat Santsenca',
      rehearsalDefaultLocationUrl: null,
    });
  });

  it('accepts an empty title and place, and no start time or place link', async () => {
    await expect(
      dataSource.query(
        `UPDATE "colla_settings" SET "rehearsalDefaultStartTime" = NULL, "rehearsalDefaultTitle" = '',
           "rehearsalDefaultLocation" = '', "rehearsalDefaultLocationUrl" = NULL`,
      ),
    ).resolves.toBeDefined();
  });

  it.each(['25:00', '18:60', '1845', '8:45'])('refuses the start time %s', async (time) => {
    await expect(dataSource.query(`UPDATE "colla_settings" SET "rehearsalDefaultStartTime" = $1`, [time])).rejects.toThrow();
  });

  it('drops every column it added on revert', async () => {
    await dataSource.undoLastMigration();

    const columns = await dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'colla_settings' AND column_name LIKE 'rehearsal%'`,
    );
    expect(columns).toEqual([]);
  });
});
