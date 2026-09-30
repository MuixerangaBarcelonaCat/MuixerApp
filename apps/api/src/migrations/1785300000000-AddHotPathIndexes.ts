import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the read paths that dominate day-to-day traffic. Postgres does not index
 * foreign keys automatically and TypeORM only emits an index where `@Index` is declared,
 * so every FK below was bare: the queries joining or filtering through them were sequential
 * scans that grow with the whole table, not with the rows actually returned.
 *
 * - events(date): `date` is both a range filter and the ORDER BY key on every event read
 *   (dashboard lists, PWA home and agenda, available-persons, assignment history).
 * - events(seasonId, date): season-scoped ranges — the per-member season attendance stats
 *   and the season-filtered event lists. Composite because both always travel together.
 * - attendances(eventId): UQ_attendances_person_event leads with personId, so it cannot
 *   serve an eventId-only predicate. This is the one that makes roll-call expensive:
 *   the summary recalculation runs per attendance write.
 * - event_segments(eventId) / figure_instances(segmentId): the join chain behind every
 *   segment list, workspace load and projection request.
 * - node_assignments(personId) / (instanceNodeId): the existing composites lead with
 *   figureInstanceId/segmentId, leaving person-only and node-only lookups unsupported.
 * - refresh_tokens(expires_at): the cleanup cron scans the table on every run.
 */
export class AddHotPathIndexes1785300000000 implements MigrationInterface {
  name = 'AddHotPathIndexes1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_events_date" ON "events" ("date")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_season_date" ON "events" ("seasonId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendances_event" ON "attendances" ("eventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_segments_event" ON "event_segments" ("eventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_figure_instances_segment" ON "figure_instances" ("segmentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_node_assignments_person" ON "node_assignments" ("personId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_node_assignments_instance_node" ON "node_assignments" ("instanceNodeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_node_assignments_instance_node"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_node_assignments_person"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_figure_instances_segment"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_segments_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendances_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_season_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_date"`);
  }
}
