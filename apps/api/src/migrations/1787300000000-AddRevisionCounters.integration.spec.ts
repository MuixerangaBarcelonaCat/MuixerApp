// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../modules/database/entities';
import { migrations } from './index';

/** Proves the revision counters and the triggers that maintain them (raw SQL throughout). */
describe('AddRevisionCounters (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;

  const TARGET = 'AddRevisionCounters1787300000000';
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

  const NODE = `"label", "zone", "x", "y", "width", "height", "shape"`;
  const NODE_VALUES = `'N', 'TRONC', 0, 0, 1, 40, 'RECTANGLE'`;

  let seq = 0;
  const id = async (sql: string, params: unknown[] = []) => ((await ds.query(sql, params)) as { id: string }[])[0].id;
  const mkEvent = () =>
    id(`INSERT INTO "events" ("eventType","title","date") VALUES ('ASSAIG','E','2026-01-10') RETURNING "id"`);
  const mkSegment = (eventId: string) =>
    id(`INSERT INTO "event_segments" ("eventId","name","sortOrder") VALUES ($1,'S',0) RETURNING "id"`, [eventId]);
  const mkTemplate = () =>
    id(`INSERT INTO "figure_templates" ("name","slug") VALUES ($1,$1) RETURNING "id"`, [`t${++seq}`]);
  const mkTemplateNode = (templateId: string) =>
    id(`INSERT INTO "figure_nodes" ("templateId", ${NODE}) VALUES ($1, ${NODE_VALUES}) RETURNING "id"`, [templateId]);
  const mkInstance = (segmentId: string, templateId: string, snapshotted = true) =>
    id(
      `INSERT INTO "figure_instances" ("segmentId","figureTemplateId","sortOrder","snapshotted")
       VALUES ($1,$2,$3,$4) RETURNING "id"`,
      [segmentId, templateId, ++seq, snapshotted],
    );
  const mkInstanceNode = (instanceId: string) =>
    id(`INSERT INTO "instance_nodes" ("figureInstanceId", ${NODE}) VALUES ($1, ${NODE_VALUES}) RETURNING "id"`, [
      instanceId,
    ]);
  const mkPerson = () =>
    id(`INSERT INTO "persons" ("name","firstSurname","alias") VALUES ('P','Q',$1) RETURNING "id"`, [`p${++seq}`]);
  const mkAssignment = (instanceId: string, nodeId: string, personId: string, segmentId: string, conn: DataSource | { query: DataSource['query'] } = ds) =>
    conn.query(
      `INSERT INTO "node_assignments" ("figureInstanceId","instanceNodeId","personId","segmentId") VALUES ($1,$2,$3,$4)`,
      [instanceId, nodeId, personId, segmentId],
    );
  const mkAttendance = (eventId: string, personId: string) =>
    id(`INSERT INTO "attendances" ("status","personId","eventId") VALUES ('ANIRE',$1,$2) RETURNING "id"`, [
      personId,
      eventId,
    ]);

  const rev = async (segmentId: string) =>
    ((await ds.query(`SELECT "revision", "structureRevision" FROM "event_segments" WHERE "id"=$1`, [segmentId])) as {
      revision: number;
      structureRevision: number;
    }[])[0];
  const att = async (eventId: string) =>
    ((await ds.query(`SELECT "attendanceRevision" a FROM "events" WHERE "id"=$1`, [eventId])) as { a: number }[])[0].a;

  /** A segment holding one snapshotted instance with one node and one person ready to be assigned. */
  const world = async () => {
    const eventId = await mkEvent();
    const segmentId = await mkSegment(eventId);
    const templateId = await mkTemplate();
    const instanceId = await mkInstance(segmentId, templateId);
    const nodeId = await mkInstanceNode(instanceId);
    const personId = await mkPerson();
    return { eventId, segmentId, templateId, instanceId, nodeId, personId };
  };

  let seeded: { eventId: string; segmentId: string; instanceId: string };

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(migrations.slice(0, targetIndex));
    await pre.initialize();
    await pre.runMigrations();
    const q = async (sql: string, p: unknown[] = []) => ((await pre.query(sql, p)) as { id: string }[])[0].id;
    const eventId = await q(`INSERT INTO "events" ("eventType","title","date") VALUES ('ASSAIG','E','2026-01-10') RETURNING "id"`);
    const segmentId = await q(`INSERT INTO "event_segments" ("eventId","name","sortOrder") VALUES ($1,'S',0) RETURNING "id"`, [eventId]);
    const templateId = await q(`INSERT INTO "figure_templates" ("name","slug") VALUES ('T','seed') RETURNING "id"`);
    const instanceId = await q(
      `INSERT INTO "figure_instances" ("segmentId","figureTemplateId","sortOrder","snapshotted") VALUES ($1,$2,0,true) RETURNING "id"`,
      [segmentId, templateId],
    );
    seeded = { eventId, segmentId, instanceId };
    await pre.destroy();

    ds = dataSourceFor(migrations.slice(0, targetIndex + 1));
    await ds.initialize();
    await ds.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    await container?.stop();
  });

  it('adds the three counters at 0 to existing rows', async () => {
    expect(await rev(seeded.segmentId)).toEqual({ revision: 0, structureRevision: 0 });
    expect(await att(seeded.eventId)).toBe(0);
  });

  it('node_assignments: INSERT, UPDATE and DELETE each bump revision by 1 and leave structureRevision alone', async () => {
    const w = await world();
    const base = await rev(w.segmentId);
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    expect(await rev(w.segmentId)).toEqual({ ...base, revision: base.revision + 1 });
    await ds.query(`UPDATE "node_assignments" SET "updatedAt" = now() WHERE "segmentId"=$1`, [w.segmentId]);
    expect((await rev(w.segmentId)).revision).toBe(base.revision + 2);
    await ds.query(`DELETE FROM "node_assignments" WHERE "segmentId"=$1`, [w.segmentId]);
    expect(await rev(w.segmentId)).toEqual({ ...base, revision: base.revision + 3 });
  });

  it('node_assignments: re-pointing segmentId bumps both the old and the new segment', async () => {
    const w = await world();
    const other = await mkSegment(w.eventId);
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    const a = await rev(w.segmentId);
    const b = await rev(other);
    await ds.query(`UPDATE "node_assignments" SET "segmentId"=$1 WHERE "segmentId"=$2`, [other, w.segmentId]);
    expect((await rev(w.segmentId)).revision).toBe(a.revision + 1);
    expect((await rev(other)).revision).toBe(b.revision + 1);
  });

  it('instance_nodes: INSERT/UPDATE/DELETE bump revision of the owning segment', async () => {
    const w = await world();
    const base = (await rev(w.segmentId)).revision;
    const n = await mkInstanceNode(w.instanceId);
    expect((await rev(w.segmentId)).revision).toBe(base + 1);
    await ds.query(`UPDATE "instance_nodes" SET "label"='X' WHERE "id"=$1`, [n]);
    expect((await rev(w.segmentId)).revision).toBe(base + 2);
    await ds.query(`DELETE FROM "instance_nodes" WHERE "id"=$1`, [n]);
    expect(await rev(w.segmentId)).toMatchObject({ revision: base + 3 });
  });

  it('figure_instances: INSERT, UPDATE (label) and DELETE bump structureRevision, not revision', async () => {
    const w = await world();
    const base = await rev(w.segmentId);
    const i = await mkInstance(w.segmentId, w.templateId);
    expect(await rev(w.segmentId)).toEqual({ revision: base.revision, structureRevision: base.structureRevision + 1 });
    await ds.query(`UPDATE "figure_instances" SET "label"='L' WHERE "id"=$1`, [i]);
    expect((await rev(w.segmentId)).structureRevision).toBe(base.structureRevision + 2);
    await ds.query(`DELETE FROM "figure_instances" WHERE "id"=$1`, [i]);
    expect(await rev(w.segmentId)).toEqual({ revision: base.revision, structureRevision: base.structureRevision + 3 });
  });

  it('figure_instances: moving to another segment bumps structureRevision of both', async () => {
    const w = await world();
    const other = await mkSegment(w.eventId);
    const a = (await rev(w.segmentId)).structureRevision;
    const b = (await rev(other)).structureRevision;
    await ds.query(`UPDATE "figure_instances" SET "segmentId"=$1 WHERE "id"=$2`, [other, w.instanceId]);
    expect((await rev(w.segmentId)).structureRevision).toBe(a + 1);
    expect((await rev(other)).structureRevision).toBe(b + 1);
  });

  it('event_segments: a direct UPDATE (name, isPublished) bumps its own structureRevision exactly once', async () => {
    const w = await world();
    const base = await rev(w.segmentId);
    await ds.query(`UPDATE "event_segments" SET "name"='Nou', "isPublished"=true WHERE "id"=$1`, [w.segmentId]);
    expect(await rev(w.segmentId)).toEqual({ revision: base.revision, structureRevision: base.structureRevision + 1 });
  });

  it('event_segments: a trigger-driven bump does not also bump structureRevision', async () => {
    const w = await world();
    const base = await rev(w.segmentId);
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    expect(await rev(w.segmentId)).toEqual({ revision: base.revision + 1, structureRevision: base.structureRevision });
  });

  it('deleting a figure with nodes and assignments (cascade) does not fail and bumps structureRevision', async () => {
    const w = await world();
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    const base = await rev(w.segmentId);
    // node_assignments.instanceNodeId is RESTRICT, but both die in the same cascade from the instance.
    await ds.query(`DELETE FROM "figure_instances" WHERE "id"=$1`, [w.instanceId]);
    expect((await rev(w.segmentId)).structureRevision).toBeGreaterThan(base.structureRevision);
  });

  it('deleting a segment or an event (cascade) does not fail', async () => {
    const w = await world();
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    await mkAttendance(w.eventId, w.personId);
    // attendances.eventId has no ON DELETE CASCADE: the app removes them first.
    await ds.query(`DELETE FROM "attendances" WHERE "eventId"=$1`, [w.eventId]);
    await ds.query(`DELETE FROM "events" WHERE "id"=$1`, [w.eventId]);
    expect(await ds.query(`SELECT 1 FROM "event_segments" WHERE "id"=$1`, [w.segmentId])).toHaveLength(0);

    const w2 = await world();
    await mkAssignment(w2.instanceId, w2.nodeId, w2.personId, w2.segmentId);
    await ds.query(`DELETE FROM "event_segments" WHERE "id"=$1`, [w2.segmentId]);
    expect(await ds.query(`SELECT 1 FROM "event_segments" WHERE "id"=$1`, [w2.segmentId])).toHaveLength(0);
  });

  it('attendances: INSERT, UPDATE and DELETE each bump events.attendanceRevision by 1', async () => {
    const w = await world();
    const base = await att(w.eventId);
    const a = await mkAttendance(w.eventId, w.personId);
    expect(await att(w.eventId)).toBe(base + 1);
    await ds.query(`UPDATE "attendances" SET "status"='NO_VAIG' WHERE "id"=$1`, [a]);
    expect(await att(w.eventId)).toBe(base + 2);
    await ds.query(`DELETE FROM "attendances" WHERE "id"=$1`, [a]);
    expect(await att(w.eventId)).toBe(base + 3);
  });

  it('figure_nodes: INSERT/UPDATE/DELETE bump structureRevision of segments with an unsnapshotted instance of that template', async () => {
    const eventId = await mkEvent();
    const segmentId = await mkSegment(eventId);
    const templateId = await mkTemplate();
    await mkInstance(segmentId, templateId, false);
    const base = await rev(segmentId);
    const n = await mkTemplateNode(templateId);
    expect(await rev(segmentId)).toEqual({ revision: base.revision, structureRevision: base.structureRevision + 1 });
    await ds.query(`UPDATE "figure_nodes" SET "label"='X' WHERE "id"=$1`, [n]);
    expect((await rev(segmentId)).structureRevision).toBe(base.structureRevision + 2);
    await ds.query(`DELETE FROM "figure_nodes" WHERE "id"=$1`, [n]);
    expect((await rev(segmentId)).structureRevision).toBe(base.structureRevision + 3);
  });

  it('figure_nodes: a segment whose instance of that template is snapshotted is not touched', async () => {
    const w = await world();
    const base = await rev(w.segmentId);
    await mkTemplateNode(w.templateId);
    expect(await rev(w.segmentId)).toEqual(base);
  });

  it('figure_nodes: saving a template no instance uses touches no segment and does not fail', async () => {
    const w = await world();
    const base = await rev(w.segmentId);
    await mkTemplateNode(await mkTemplate());
    expect(await rev(w.segmentId)).toEqual(base);
  });

  it('a segment in another event is never touched', async () => {
    const w = await world();
    const w2 = await world();
    const base = await rev(w2.segmentId);
    const baseAtt = await att(w2.eventId);
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    await mkAttendance(w.eventId, w.personId);
    await mkInstanceNode(w.instanceId);
    await ds.query(`UPDATE "event_segments" SET "name"='Z' WHERE "id"=$1`, [w.segmentId]);
    expect(await rev(w2.segmentId)).toEqual(base);
    expect(await att(w2.eventId)).toBe(baseAtt);
  });

  it('10 concurrent INSERTs into node_assignments on separate connections leave revision at +10', async () => {
    const w = await world();
    const nodes = await Promise.all(Array.from({ length: 10 }, () => mkInstanceNode(w.instanceId)));
    const persons = await Promise.all(Array.from({ length: 10 }, () => mkPerson()));
    const base = (await rev(w.segmentId)).revision;
    const runners = Array.from({ length: 10 }, () => ds.createQueryRunner());
    try {
      await Promise.all(runners.map((r) => r.connect()));
      await Promise.all(runners.map((r, i) => mkAssignment(w.instanceId, nodes[i], persons[i], w.segmentId, r)));
    } finally {
      await Promise.all(runners.map((r) => r.release()));
    }
    expect((await rev(w.segmentId)).revision).toBe(base + 10);
  });

  it('down() drops the triggers, the functions and the columns; writes keep working', async () => {
    await ds.undoLastMigration();

    const [{ n: triggers }] = await ds.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgname LIKE 'trg\\_%\\_revision'`);
    const [{ n: fns }] = await ds.query(`SELECT count(*)::int n FROM pg_proc WHERE proname LIKE 'muixer\\_%'`);
    const [{ n: cols }] = await ds.query(
      `SELECT count(*)::int n FROM information_schema.columns
        WHERE column_name IN ('revision','structureRevision','attendanceRevision')`,
    );
    expect({ triggers, fns, cols }).toEqual({ triggers: 0, fns: 0, cols: 0 });

    const w = await world();
    await mkAssignment(w.instanceId, w.nodeId, w.personId, w.segmentId);
    await mkAttendance(w.eventId, w.personId);
  });
});
