import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 5 of docs/SEGMENTS_FLEXIBILITY.md: a person may now hold more than one
 * placement within the same segment/figure instance while an event is being
 * prepared. Drops UQ_node_assignments_instance_person and
 * UQ_node_assignments_segment_person; keeps UQ_node_assignments_instance_node
 * (a node can still only be occupied once). The plain indexes added by
 * AddNodeAssignmentConflictIndexes1783700000000 remain as the only support for
 * the conflict/dotació queries.
 *
 * down() must delete duplicate rows (keeping the oldest by createdAt) before
 * the unique constraints can be recreated — any duplicates created while this
 * migration was up would otherwise make the down-migration fail outright.
 */
export class DropNodeAssignmentDuplicateUniques1783800000000 implements MigrationInterface {
  name = 'DropNodeAssignmentDuplicateUniques1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person"`,
    );
    await queryRunner.query(
      `ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_segment_person"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "node_assignments" a
      USING (
        SELECT "id",
          ROW_NUMBER() OVER (PARTITION BY "figureInstanceId", "personId" ORDER BY "createdAt") AS rn
        FROM "node_assignments"
      ) dedup
      WHERE a."id" = dedup."id" AND dedup.rn > 1
    `);
    await queryRunner.query(`
      DELETE FROM "node_assignments" a
      USING (
        SELECT "id",
          ROW_NUMBER() OVER (PARTITION BY "segmentId", "personId" ORDER BY "createdAt") AS rn
        FROM "node_assignments"
      ) dedup
      WHERE a."id" = dedup."id" AND dedup.rn > 1
    `);
    await queryRunner.query(
      `ALTER TABLE "node_assignments" ADD CONSTRAINT "UQ_node_assignments_instance_person" UNIQUE ("figureInstanceId", "personId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "node_assignments" ADD CONSTRAINT "UQ_node_assignments_segment_person" UNIQUE ("segmentId", "personId")`,
    );
  }
}
