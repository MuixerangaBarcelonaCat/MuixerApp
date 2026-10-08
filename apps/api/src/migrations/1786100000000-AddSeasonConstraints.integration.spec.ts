// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Migrations run on boot, so seasons that break the new constraints would keep the API from
 * starting. `AddSeasonConstraints` repairs what has one obvious fix and fails with the season names
 * for what doesn't. Runs every migration before it, seeds the seasons with raw SQL, then runs it.
 */
describe('AddSeasonConstraints (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'AddSeasonConstraints1786100000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);

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

  const insertSeason = (name: string, startDate: string, endDate: string) =>
    dataSource.query(`INSERT INTO "seasons" ("name", "startDate", "endDate") VALUES ($1, $2, $3)`, [
      name,
      startDate,
      endDate,
    ]);

  const ranges = async () => {
    const rows: { name: string; startDate: string; endDate: string }[] = await dataSource.query(
      `SELECT "name", "startDate"::text AS "startDate", "endDate"::text AS "endDate" FROM "seasons"`,
    );
    return Object.fromEntries(rows.map((r) => [r.name, [r.startDate, r.endDate]]));
  };

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = dataSourceFor(migrations.slice(0, targetIndex + 1));
    await dataSource.initialize();
    const pre = dataSourceFor(migrations.slice(0, targetIndex));
    await pre.initialize();
    await pre.runMigrations();
    await pre.destroy();
  }, 180_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  // Runs first: the migration runs in a transaction, so a failure leaves nothing behind.
  it('fails naming the seasons when shortening the earlier one would leave it with no range', async () => {
    await insertSeason('Mateix inici A', '2040-01-01', '2040-06-30');
    await insertSeason('Mateix inici B', '2040-01-01', '2040-12-31');

    await expect(dataSource.runMigrations({ transaction: 'all' })).rejects.toThrow(
      /Mateix inici A.*Mateix inici B|Mateix inici B.*Mateix inici A/,
    );

    await dataSource.query(`DELETE FROM "seasons"`);
  });

  it('repairs inverted, one-day and overlapping seasons, then adds the constraints', async () => {
    // Sharing a boundary day, as two seasons edited at the same time could leave them.
    await insertSeason('2024-2025', '2024-09-01', '2025-09-06');
    await insertSeason('2025-2026', '2025-09-06', '2026-09-05');
    await insertSeason('Invertida', '2028-08-31', '2027-09-06');
    await insertSeason("D'un dia", '2030-01-01', '2030-01-01');
    await insertSeason('Contenidora', '2032-01-01', '2032-12-31');
    await insertSeason('Continguda', '2032-03-01', '2032-04-01');

    await dataSource.runMigrations({ transaction: 'all' });

    expect(await ranges()).toEqual({
      '2024-2025': ['2024-09-01', '2025-09-05'],
      '2025-2026': ['2025-09-06', '2026-09-05'],
      Invertida: ['2027-09-06', '2028-08-31'],
      "D'un dia": ['2030-01-01', '2030-01-02'],
      Contenidora: ['2032-01-01', '2032-02-29'],
      Continguda: ['2032-03-01', '2032-04-01'],
    });
    await expect(insertSeason('Solapada', '2026-09-05', '2026-12-31')).rejects.toThrow(/EX_seasons_no_overlap/);
  });
});
