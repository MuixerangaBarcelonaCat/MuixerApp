// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the sortOrder uniqueness migration: runs every migration *before*
 * `UniqueFigureInstanceSortOrder`, seeds segments with tied and gapped `sortOrder`s (raw SQL —
 * the HEAD entity already carries the constraint), then runs the migration and asserts each
 * segment was renumbered 0..n-1 by (sortOrder, createdAt, id) and the constraint now holds.
 */
describe('UniqueFigureInstanceSortOrder (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'UniqueFigureInstanceSortOrder1786000000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);
  const before = migrations.slice(0, targetIndex);
  const upToTarget = migrations.slice(0, targetIndex + 1);

  const SEG_TIES = '00000000-0000-0000-0000-00000000000a';
  const SEG_CLEAN = '00000000-0000-0000-0000-00000000000b';

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

  const insertInstance = (ds: DataSource, id: string, segmentId: string, sortOrder: number, createdAt: string) =>
    ds.query(
      `INSERT INTO "figure_instances" ("id", "segmentId", "sortOrder", "createdAt")
       VALUES ($1, $2, $3, $4)`,
      [id, segmentId, sortOrder, createdAt],
    );

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(before);
    await pre.initialize();
    await pre.runMigrations();

    const [event] = await pre.query(
      `INSERT INTO "events" ("eventType", "title", "date") VALUES ('ASSAIG', 'Assaig', '2026-01-01') RETURNING "id"`,
    );
    for (const [id, sortOrder] of [[SEG_TIES, 0], [SEG_CLEAN, 1]] as const) {
      await pre.query(`INSERT INTO "event_segments" ("id", "eventId", "sortOrder") VALUES ($1, $2, $3)`, [
        id,
        event.id,
        sortOrder,
      ]);
    }

    // SEG_TIES: two at 0 told apart by createdAt, two at 3 sharing a createdAt (told apart by id),
    // and a gap (no 1/2). Expected order: a1, a2, b1, b2, c.
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000a2', SEG_TIES, 0, '2026-01-01T10:00:01Z');
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000a1', SEG_TIES, 0, '2026-01-01T10:00:00Z');
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000b2', SEG_TIES, 3, '2026-01-01T09:00:00Z');
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000b1', SEG_TIES, 3, '2026-01-01T09:00:00Z');
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000c0', SEG_TIES, 7, '2026-01-01T08:00:00Z');
    // SEG_CLEAN: already 0..n-1, must come out untouched.
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000d0', SEG_CLEAN, 0, '2026-01-01T10:00:00Z');
    await insertInstance(pre, '00000000-0000-0000-0000-0000000000d1', SEG_CLEAN, 1, '2026-01-01T09:00:00Z');
    await pre.destroy();

    dataSource = dataSourceFor(upToTarget);
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  const orderOf = async (segmentId: string) =>
    (
      await dataSource.query(
        `SELECT "id", "sortOrder" FROM "figure_instances" WHERE "segmentId" = $1 ORDER BY "sortOrder"`,
        [segmentId],
      )
    ).map((r: { id: string; sortOrder: number }) => [r.id.slice(-2), r.sortOrder]);

  it('renumbers each segment 0..n-1 by (sortOrder, createdAt, id)', async () => {
    expect(await orderOf(SEG_TIES)).toEqual([
      ['a1', 0],
      ['a2', 1],
      ['b1', 2],
      ['b2', 3],
      ['c0', 4],
    ]);
  });

  it('leaves an already-contiguous segment as it was', async () => {
    expect(await orderOf(SEG_CLEAN)).toEqual([
      ['d0', 0],
      ['d1', 1],
    ]);
  });

  it('rejects a duplicate sortOrder within a segment at commit', async () => {
    await expect(
      dataSource.transaction((manager) =>
        manager.query(`UPDATE "figure_instances" SET "sortOrder" = 0 WHERE "id" = $1`, [
          '00000000-0000-0000-0000-0000000000a2',
        ]),
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows a transient duplicate inside a transaction (deferred), e.g. a swap', async () => {
    await dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE "figure_instances" SET "sortOrder" = 1 WHERE "id" = $1`, [
        '00000000-0000-0000-0000-0000000000d0',
      ]);
      await manager.query(`UPDATE "figure_instances" SET "sortOrder" = 0 WHERE "id" = $1`, [
        '00000000-0000-0000-0000-0000000000d1',
      ]);
    });

    expect(await orderOf(SEG_CLEAN)).toEqual([
      ['d1', 0],
      ['d0', 1],
    ]);
  });
});
