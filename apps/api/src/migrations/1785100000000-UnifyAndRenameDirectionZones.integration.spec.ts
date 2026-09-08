// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { FigureTemplate } from '../modules/figure/entities/figure-template.entity';
import { FigureNode } from '../modules/figure/entities/figure-node.entity';
import { migrations } from './index';

/**
 * Proves the direction-zone unification migration transforms real rows correctly: it runs every
 * migration *before* `UnifyAndRenameDirectionZones`, seeds legacy `FIGURE_DIRECTION` /
 * `XICALLA_DIRECTION` rows (including one ad-hoc node with a null positionType and a tag whose
 * `positionTypes` array still references `direccio-figura`), then runs the migration and asserts
 * the end state — zone `DIRECTION`, the renamed/backfilled `positionType`, and that the old enum
 * values are gone.
 */
describe('UnifyAndRenameDirectionZones (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'UnifyAndRenameDirectionZones1785100000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);
  const before = migrations.slice(0, targetIndex);
  // Run up to and including the migration under test — but not later ones, which would keep
  // mutating the rows this suite asserts on.
  const upToTarget = migrations.slice(0, targetIndex + 1);

  const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    // 1. Run every migration up to (not including) the one under test, then seed legacy rows
    //    through the entity repositories (raw INSERTs against a 40-migrations-deep schema are
    //    too brittle) — the `zone` values are still forced with raw SQL since the enum no longer
    //    carries them at HEAD.
    const pre = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: ENTITIES,
      migrations: before,
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: false,
    });
    await pre.initialize();
    await pre.runMigrations();

    await pre.getRepository(FigureTemplate).save({ id: TEMPLATE_ID, name: 'T', slug: 't' });
    const nodeRepo = pre.getRepository(FigureNode);
    const mk = (label: string, x = 0) =>
      nodeRepo.save({
        template: { id: TEMPLATE_ID } as FigureTemplate,
        label,
        zone: 'PINYA' as never, // overwritten below
        positionType: null,
        x,
        y: 0,
        width: 90,
        height: 44,
        shape: 'RECTANGLE' as never,
      });
    const figFull = await mk('Dir fig');
    const figAdhoc = await mk('Dir fig adhoc');
    const xic = await mk('Dir xic');
    await mk('Pinya');

    await pre.query(
      `UPDATE "figure_nodes" SET "zone" = 'FIGURE_DIRECTION', "positionType" = 'direccio-figura' WHERE "id" = $1`,
      [figFull.id],
    );
    await pre.query(
      `UPDATE "figure_nodes" SET "zone" = 'FIGURE_DIRECTION', "positionType" = NULL WHERE "id" = $1`,
      [figAdhoc.id],
    );
    await pre.query(
      `UPDATE "figure_nodes" SET "zone" = 'XICALLA_DIRECTION', "positionType" = 'direccio-xicalla' WHERE "id" = $1`,
      [xic.id],
    );
    await pre.query(`UPDATE "figure_nodes" SET "positionType" = 'agulla' WHERE "label" = 'Pinya'`);

    // The seeded "Tècnica" tag (migration 1784900000000) still points its positionTypes array at
    // the legacy `direccio-figura`; assert the migration rewrites it.
    const [seededTag]: { positionTypes: string[] }[] = await pre.query(
      `SELECT "positionTypes" FROM "positions" WHERE "slug" = 'tecnica'`,
    );
    expect(seededTag.positionTypes).toContain('direccio-figura');

    await pre.destroy();

    // 2. Run the migration under test (nothing later, so this suite's rows aren't mutated again).
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
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('moves every direction node to zone DIRECTION with the right positionType', async () => {
    const rows: { label: string; zone: string; positionType: string | null }[] = await dataSource.query(
      `SELECT "label", "zone", "positionType" FROM "figure_nodes" WHERE "templateId" = $1 ORDER BY "label"`,
      [TEMPLATE_ID],
    );

    expect(rows).toEqual([
      { label: 'Dir fig', zone: 'DIRECTION', positionType: 'direccio-tronc' },
      { label: 'Dir fig adhoc', zone: 'DIRECTION', positionType: 'direccio-tronc' },
      { label: 'Dir xic', zone: 'DIRECTION', positionType: 'direccio-xicalla' },
      { label: 'Pinya', zone: 'PINYA', positionType: 'agulla' },
    ]);
  });

  it('renames direccio-figura inside a tag positionTypes array', async () => {
    const [tag]: { positionTypes: string[] }[] = await dataSource.query(
      `SELECT "positionTypes" FROM "positions" WHERE "slug" = 'tecnica'`,
    );
    expect(tag.positionTypes).toEqual(['direccio-tronc', 'direccio-xicalla']);
  });

  it('drops the old enum values', async () => {
    const values: { enumlabel: string }[] = await dataSource.query(
      `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'figure_zone_enum' ORDER BY enumlabel`,
    );
    expect(values.map((v) => v.enumlabel)).toEqual(['BASE', 'DECORATION', 'DIRECTION', 'PINYA', 'TRONC']);
  });
});
