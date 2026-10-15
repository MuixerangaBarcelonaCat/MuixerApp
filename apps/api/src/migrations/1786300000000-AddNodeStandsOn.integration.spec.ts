// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the `standsOnNodeIds` columns: runs every migration before `AddNodeStandsOn`, seeds a
 * template node and an instance node (raw SQL), runs it and checks both rows read back `{}`, then
 * reverts it and checks both columns are gone.
 */
describe('AddNodeStandsOn (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'AddNodeStandsOn1786300000000';
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

  const column = async (table: string) =>
    (
      await dataSource.query(
        `SELECT udt_name, is_nullable FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'standsOnNodeIds'`,
        [table],
      )
    )[0] as { udt_name: string; is_nullable: string } | undefined;

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(before);
    await pre.initialize();
    await pre.runMigrations();

    const [{ id: templateId }] = await pre.query(
      `INSERT INTO "figure_templates" ("name", "slug") VALUES ('Pilar', 'pilar') RETURNING "id"`,
    );
    await pre.query(
      `INSERT INTO "figure_nodes" ("templateId", "label", "zone", "x", "y", "width", "height", "shape")
       VALUES ($1, 'Segon', 'TRONC', 0, 0, 1, 40, 'RECTANGLE')`,
      [templateId],
    );
    const [{ id: eventId }] = await pre.query(
      `INSERT INTO "events" ("eventType", "title", "date") VALUES ('ASSAIG', 'Assaig', '2026-01-10') RETURNING "id"`,
    );
    const [{ id: segmentId }] = await pre.query(
      `INSERT INTO "event_segments" ("eventId", "name", "sortOrder") VALUES ($1, 'Ronda', 0) RETURNING "id"`,
      [eventId],
    );
    const [{ id: instanceId }] = await pre.query(
      `INSERT INTO "figure_instances" ("segmentId", "figureTemplateId", "sortOrder", "snapshotted")
       VALUES ($1, $2, 0, true) RETURNING "id"`,
      [segmentId, templateId],
    );
    await pre.query(
      `INSERT INTO "instance_nodes" ("figureInstanceId", "label", "zone", "x", "y", "width", "height", "shape")
       VALUES ($1, 'Segon', 'TRONC', 0, 0, 1, 40, 'RECTANGLE')`,
      [instanceId],
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

  it.each(['figure_nodes', 'instance_nodes'])('adds a non-null uuid[] column to %s', async (table) => {
    expect(await column(table)).toEqual({ udt_name: '_uuid', is_nullable: 'NO' });
  });

  it.each(['figure_nodes', 'instance_nodes'])('backfills existing %s rows with an empty array', async (table) => {
    const rows = await dataSource.query(`SELECT "standsOnNodeIds" FROM "${table}"`);
    expect(rows).toEqual([{ standsOnNodeIds: [] }]);
  });

  it('drops both columns on revert', async () => {
    await dataSource.undoLastMigration();

    expect(await column('figure_nodes')).toBeUndefined();
    expect(await column('instance_nodes')).toBeUndefined();
  });
});
