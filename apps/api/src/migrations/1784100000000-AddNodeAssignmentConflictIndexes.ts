import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, non-unique indexes on node_assignments for the segment-conflict queries
 * ("does this person have >1 placement in this segment / figure?").
 *
 * These are REDUNDANT today: their column tuples are already backed by the unique
 * constraints UQ_node_assignments_segment_person (segmentId, personId) and
 * UQ_node_assignments_instance_person (figureInstanceId, personId). They are added
 * now on purpose (§8, risk 7): Fase 5 drops those unique constraints — and with them
 * their backing indexes — to allow legal transient duplicates, after which these plain
 * indexes remain as the only support for the conflict/dotació queries. Adding them here
 * (harmless, additive) keeps the risky Fase 5 release minimal.
 */
export class AddNodeAssignmentConflictIndexes1784100000000 implements MigrationInterface {
  name = 'AddNodeAssignmentConflictIndexes1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_node_assignments_segment_person" ON "node_assignments" ("segmentId", "personId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_node_assignments_figure_instance_person" ON "node_assignments" ("figureInstanceId", "personId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_node_assignments_figure_instance_person"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_node_assignments_segment_person"`);
  }
}
