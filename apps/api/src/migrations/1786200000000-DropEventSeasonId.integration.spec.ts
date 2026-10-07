// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the `events.seasonId` drop: an event's season is derived from its date from now on. Runs
 * every migration before `DropEventSeasonId`, seeds events with stored seasons (raw SQL — the HEAD
 * entity no longer has the column), runs it, then reverts it and checks the backfill re-derives
 * each event's season from its date (and leaves events outside every season at NULL).
 */
describe('DropEventSeasonId (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'DropEventSeasonId1786200000000';
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

  const columnExists = async () =>
    (
      await dataSource.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'seasonId'`,
      )
    ).length > 0;

  let seasonA: string;
  let seasonB: string;

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(before);
    await pre.initialize();
    await pre.runMigrations();

    [{ id: seasonA }] = await pre.query(
      `INSERT INTO "seasons" ("name", "startDate", "endDate") VALUES ('A', '2025-09-06', '2026-09-05') RETURNING "id"`,
    );
    [{ id: seasonB }] = await pre.query(
      `INSERT INTO "seasons" ("name", "startDate", "endDate") VALUES ('B', '2026-09-06', '2027-09-05') RETURNING "id"`,
    );
    // Stored seasons that disagree with the dates, as the legacy sync's "latest season" fallback left them.
    for (const [title, date, seasonId] of [
      ['in-a', '2026-01-10', seasonB],
      ['in-b', '2026-09-06', seasonB],
      ['before-all', '2023-05-01', seasonB],
    ] as const) {
      await pre.query(
        `INSERT INTO "events" ("eventType", "title", "date", "seasonId") VALUES ('ASSAIG', $1, $2, $3)`,
        [title, date, seasonId],
      );
    }
    await pre.destroy();

    dataSource = dataSourceFor(upToTarget);
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('drops events.seasonId and keeps every event', async () => {
    expect(await columnExists()).toBe(false);
    const [{ count }] = await dataSource.query(`SELECT COUNT(*)::int AS count FROM "events"`);
    expect(count).toBe(3);
  });

  it('on revert, restores the column backfilled from each event date', async () => {
    await dataSource.undoLastMigration();
    expect(await columnExists()).toBe(true);

    const rows: { title: string; seasonId: string | null }[] = await dataSource.query(
      `SELECT "title", "seasonId" FROM "events" ORDER BY "title"`,
    );
    expect(Object.fromEntries(rows.map((r) => [r.title, r.seasonId]))).toEqual({
      'before-all': null,
      'in-a': seasonA,
      'in-b': seasonB,
    });
  });
});
