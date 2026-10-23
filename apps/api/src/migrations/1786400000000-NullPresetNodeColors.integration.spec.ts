// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/**
 * Proves the node-color cleanup: seeds template and instance nodes holding preset colors (in any
 * case), custom colors and BASE colors, runs the migration and checks which colors became NULL,
 * then reverts it and checks the preset colors come back.
 */
describe('NullPresetNodeColors (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'NullPresetNodeColors1786400000000';
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

  // [label, zone, positionType, color]; the label names the case, and is what the checks look up.
  const SEEDED: [string, string, string | null, string | null][] = [
    ['vents-preset', 'PINYA', 'vents', '#A5D6A7'],
    ['vents-preset-lowercase', 'PINYA', 'vents', '#a5d6a7'],
    ['vents-custom', 'PINYA', 'vents', '#123456'],
    ['mans-with-vents-color', 'PINYA', 'mans', '#A5D6A7'],
    ['segona-preset', 'TRONC', 'segona', '#1E88E5'],
    ['direccio-pinya-preset', 'DIRECTION', 'direccio-pinya', '#065f46'],
    ['base-default', 'BASE', 'base', '#EEEEEE'],
    ['base-other', 'BASE', 'base', '#ABCDEF'],
    ['decoration', 'DECORATION', 'rectangle', '#999999'],
    ['already-null', 'PINYA', 'tap', null],
  ];

  const colors = async (table: string): Promise<Record<string, string | null>> =>
    Object.fromEntries(
      (await dataSource.query(`SELECT "label", "color" FROM "${table}"`)).map((r: { label: string; color: string | null }) => [
        r.label,
        r.color,
      ]),
    );

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(before);
    await pre.initialize();
    await pre.runMigrations();

    const [{ id: templateId }] = await pre.query(
      `INSERT INTO "figure_templates" ("name", "slug") VALUES ('Pilar', 'pilar') RETURNING "id"`,
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
    for (const [label, zone, positionType, color] of SEEDED) {
      await pre.query(
        `INSERT INTO "figure_nodes" ("templateId", "label", "zone", "positionType", "color", "x", "y", "width", "height", "shape")
         VALUES ($1, $2, $3, $4, $5, 0, 0, 80, 40, 'RECTANGLE')`,
        [templateId, label, zone, positionType, color],
      );
      await pre.query(
        `INSERT INTO "instance_nodes" ("figureInstanceId", "label", "zone", "positionType", "color", "x", "y", "width", "height", "shape")
         VALUES ($1, $2, $3, $4, $5, 0, 0, 80, 40, 'RECTANGLE')`,
        [instanceId, label, zone, positionType, color],
      );
    }
    // Ad-hoc nodes with no preset for their type got this gray server-side.
    await pre.query(
      `INSERT INTO "instance_nodes" ("figureInstanceId", "label", "zone", "positionType", "color", "isAdHoc", "x", "y", "width", "height", "shape")
       VALUES ($1, 'ad-hoc-default', 'PINYA', NULL, '#B0BEC5', true, 0, 0, 80, 40, 'RECTANGLE')`,
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

  it.each(['figure_nodes', 'instance_nodes'])('clears the colors that only repeat the preset of the type in %s', async (table) => {
    expect(await colors(table)).toMatchObject({
      'vents-preset': null,
      'vents-preset-lowercase': null,
      'segona-preset': null,
      'direccio-pinya-preset': null,
      'already-null': null,
    });
  });

  it.each(['figure_nodes', 'instance_nodes'])('keeps customized colors in %s, including a preset of another type', async (table) => {
    expect(await colors(table)).toMatchObject({
      'vents-custom': '#123456',
      'mans-with-vents-color': '#A5D6A7',
      decoration: '#999999',
    });
  });

  it.each(['figure_nodes', 'instance_nodes'])('clears every BASE color in %s: it is not editable', async (table) => {
    expect(await colors(table)).toMatchObject({ 'base-default': null, 'base-other': null });
  });

  it('clears the default gray of ad-hoc nodes', async () => {
    expect((await colors('instance_nodes'))['ad-hoc-default']).toBeNull();
  });

  it('writes the preset colors back on revert', async () => {
    await dataSource.undoLastMigration();

    for (const table of ['figure_nodes', 'instance_nodes']) {
      expect(await colors(table)).toMatchObject({
        'vents-preset': '#A5D6A7',
        'vents-preset-lowercase': '#A5D6A7',
        'vents-custom': '#123456',
        'segona-preset': '#1E88E5',
        'direccio-pinya-preset': '#065f46',
        'base-default': '#EEEEEE',
        'base-other': '#EEEEEE',
        decoration: '#999999',
      });
    }
    expect((await colors('instance_nodes'))['ad-hoc-default']).toBe('#B0BEC5');
  });
});
