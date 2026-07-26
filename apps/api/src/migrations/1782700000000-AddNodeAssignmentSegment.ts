import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BUG-18: the "a person may only be assigned once per segment" rule (across all
 * of the segment's figure instances) previously lived only in application code
 * (assign()'s segmentConflict check) — Postgres can't uniquely constrain across
 * a join, so this denormalizes segmentId onto node_assignments to let the DB
 * enforce it too, closing the TOCTOU race between two concurrent assigns.
 */
export class AddNodeAssignmentSegment1782700000000 implements MigrationInterface {
  name = 'AddNodeAssignmentSegment1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD COLUMN "segmentId" uuid`);

    await queryRunner.query(`
      UPDATE "node_assignments" na
      SET "segmentId" = fi."segmentId"
      FROM "figure_instances" fi
      WHERE fi.id = na."figureInstanceId"
    `);

    await queryRunner.query(`ALTER TABLE "node_assignments" ALTER COLUMN "segmentId" SET NOT NULL`);

    await queryRunner.query(`
      ALTER TABLE "node_assignments"
      ADD CONSTRAINT "FK_node_assignments_segment"
      FOREIGN KEY ("segmentId") REFERENCES "event_segments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "node_assignments"
      ADD CONSTRAINT "UQ_node_assignments_segment_person" UNIQUE ("segmentId", "personId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT "UQ_node_assignments_segment_person"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT "FK_node_assignments_segment"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP COLUMN "segmentId"`);
  }
}
