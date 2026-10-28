// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the colla settings table: the migration seeds one row with the values that were
 * hard-coded until now (the lock days from the env var it replaces, the default tag from the
 * slug person creation used), the database refuses a second row and inconsistent thresholds,
 * deleting the default tag clears it, and the audit enum gains the values the API writes.
 */
describe('CreateCollaSettings (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const previousLockDays = process.env.ASSIGNMENT_LOCK_DAYS;

  const TARGET = 'CreateCollaSettings1786500000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);
  const upToTarget = migrations.slice(0, targetIndex + 1);

  const settingsRows = () => dataSource.query(`SELECT * FROM "colla_settings"`);
  const personaNovaId = async (): Promise<string> =>
    (await dataSource.query(`SELECT "id" FROM "positions" WHERE "slug" = 'persona-nova'`))[0].id;

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    process.env.ASSIGNMENT_LOCK_DAYS = '5';
    dataSource = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: ENTITIES,
      migrations: upToTarget,
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (previousLockDays === undefined) delete process.env.ASSIGNMENT_LOCK_DAYS;
    else process.env.ASSIGNMENT_LOCK_DAYS = previousLockDays;
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('seeds a single row with the previously hard-coded values', async () => {
    const rows = await settingsRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      collaName: 'Muixeranga de Barcelona',
      shirtRequiredPerformances: 2,
      shirtRequiredRehearsals: 6,
      shoulderHeightBaselineCm: 140,
      troncFloorWarningCm: 5,
      troncFloorErrorCm: 10,
      troncSupportWarningCm: 3,
      troncSupportErrorCm: 5,
      autoCheckInPerformances: true,
      majorityAge: 16,
    });
  });

  it('seeds the lock days from the ASSIGNMENT_LOCK_DAYS env var it replaces', async () => {
    expect((await settingsRows())[0].assignmentLockDays).toBe(5);
  });

  it('seeds the default tag with the persona-nova tag', async () => {
    expect((await settingsRows())[0].defaultTagId).toBe(await personaNovaId());
  });

  it('refuses a second row', async () => {
    await expect(dataSource.query(`INSERT INTO "colla_settings" ("collaName") VALUES ('Una altra')`)).rejects.toThrow();
  });

  it.each([
    ['floor', `"troncFloorWarningCm" = 10, "troncFloorErrorCm" = 10`],
    ['support', `"troncSupportWarningCm" = 6, "troncSupportErrorCm" = 5`],
  ])('refuses a %s warning threshold that is not below its error threshold', async (_label, assignment) => {
    await expect(dataSource.query(`UPDATE "colla_settings" SET ${assignment}`)).rejects.toThrow();
  });

  it('refuses negative values', async () => {
    await expect(dataSource.query(`UPDATE "colla_settings" SET "assignmentLockDays" = -1`)).rejects.toThrow();
  });

  it.each(['ATTENDANCE_LOCK_OVERRIDE', 'COLLA_SETTINGS_UPDATED'])('accepts the %s audit action', async (action) => {
    await expect(dataSource.query(`INSERT INTO "audit_logs" ("action") VALUES ($1)`, [action])).resolves.toBeDefined();
  });

  it('clears the default tag when that tag is deleted', async () => {
    await dataSource.query(`DELETE FROM "positions" WHERE "id" = $1`, [await personaNovaId()]);

    expect((await settingsRows())[0].defaultTagId).toBeNull();
  });

  it('drops the table on revert', async () => {
    await dataSource.undoLastMigration();

    const [{ exists }] = await dataSource.query(`SELECT to_regclass('colla_settings') IS NOT NULL AS "exists"`);
    expect(exists).toBe(false);
  });
});
