import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revision counters for data-freshness polling, maintained only by Postgres triggers (TypeORM
 * never writes them), so every write path bumps them — services, sync, raw SQL.
 *
 * ponytail: row-level triggers — a 200-row bulk import bumps the segment 200 times inside one
 * transaction (clients only see the last value). Switch to statement-level triggers with
 * transition tables if imports get slow.
 */
export class AddRevisionCounters1787300000000 implements MigrationInterface {
  name = 'AddRevisionCounters1787300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "event_segments" ADD COLUMN "revision" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "event_segments" ADD COLUMN "structureRevision" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "events" ADD COLUMN "attendanceRevision" integer NOT NULL DEFAULT 0`);

    await q.query(`
CREATE FUNCTION muixer_bump_assignment_segment() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."segmentId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."segmentId"; END IF;
  UPDATE "event_segments" SET "revision" = "revision" + 1 WHERE "id" IN (old_id, new_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql`);

    await q.query(`
CREATE FUNCTION muixer_bump_node_segment() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."figureInstanceId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."figureInstanceId"; END IF;
  -- On a cascade from figure_instances the parent row is already gone: 0 rows, and the
  -- figure_instances trigger has bumped structureRevision.
  UPDATE "event_segments" SET "revision" = "revision" + 1
   WHERE "id" IN (SELECT "segmentId" FROM "figure_instances" WHERE "id" IN (old_id, new_id));
  RETURN NULL;
END $$ LANGUAGE plpgsql`);

    await q.query(`
CREATE FUNCTION muixer_bump_instance_segment() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."segmentId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."segmentId"; END IF;
  UPDATE "event_segments" SET "structureRevision" = "structureRevision" + 1 WHERE "id" IN (old_id, new_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql`);

    // A direct UPDATE of the segment (name, notes, isPublished, sortOrder) is a structure change.
    // The bumps above already changed a counter, so they pass through untouched.
    await q.query(`
CREATE FUNCTION muixer_guard_segment_structure() RETURNS trigger AS $$
BEGIN
  IF NEW."revision" = OLD."revision" AND NEW."structureRevision" = OLD."structureRevision" THEN
    NEW."structureRevision" := OLD."structureRevision" + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql`);

    await q.query(`
CREATE FUNCTION muixer_bump_event_attendance() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."eventId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."eventId"; END IF;
  UPDATE "events" SET "attendanceRevision" = "attendanceRevision" + 1 WHERE "id" IN (old_id, new_id);
  RETURN NULL;
END $$ LANGUAGE plpgsql`);

    // Before its first assignment an instance reads its template's FigureNodes live, so a template
    // edit changes what those segments show. Snapshotted instances are immune (invariant 2).
    await q.query(`
CREATE FUNCTION muixer_bump_template_segments() RETURNS trigger AS $$
DECLARE old_id uuid; new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD."templateId"; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW."templateId"; END IF;
  UPDATE "event_segments" SET "structureRevision" = "structureRevision" + 1
   WHERE "id" IN (SELECT "segmentId" FROM "figure_instances"
                   WHERE "snapshotted" = false AND "figureTemplateId" IN (old_id, new_id));
  RETURN NULL;
END $$ LANGUAGE plpgsql`);

    const after = (name: string, table: string, fn: string) =>
      q.query(
        `CREATE TRIGGER "${name}" AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
      );
    await after('trg_figure_nodes_revision', 'figure_nodes', 'muixer_bump_template_segments');
    await after('trg_node_assignments_revision', 'node_assignments', 'muixer_bump_assignment_segment');
    await after('trg_instance_nodes_revision', 'instance_nodes', 'muixer_bump_node_segment');
    await after('trg_figure_instances_revision', 'figure_instances', 'muixer_bump_instance_segment');
    await q.query(
      `CREATE TRIGGER "trg_event_segments_revision" BEFORE UPDATE ON "event_segments" FOR EACH ROW EXECUTE FUNCTION muixer_guard_segment_structure()`,
    );
    await after('trg_attendances_revision', 'attendances', 'muixer_bump_event_attendance');
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const [t, table] of [
      ['trg_figure_nodes_revision', 'figure_nodes'],
      ['trg_node_assignments_revision', 'node_assignments'],
      ['trg_instance_nodes_revision', 'instance_nodes'],
      ['trg_figure_instances_revision', 'figure_instances'],
      ['trg_event_segments_revision', 'event_segments'],
      ['trg_attendances_revision', 'attendances'],
    ]) {
      await q.query(`DROP TRIGGER "${t}" ON "${table}"`);
    }
    for (const fn of [
      'muixer_bump_template_segments',
      'muixer_bump_assignment_segment',
      'muixer_bump_node_segment',
      'muixer_bump_instance_segment',
      'muixer_guard_segment_structure',
      'muixer_bump_event_attendance',
    ]) {
      await q.query(`DROP FUNCTION ${fn}()`);
    }
    await q.query(`ALTER TABLE "events" DROP COLUMN "attendanceRevision"`);
    await q.query(`ALTER TABLE "event_segments" DROP COLUMN "structureRevision"`);
    await q.query(`ALTER TABLE "event_segments" DROP COLUMN "revision"`);
  }
}
