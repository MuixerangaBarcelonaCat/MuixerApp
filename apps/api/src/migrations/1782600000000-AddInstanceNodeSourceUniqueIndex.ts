import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BUG-17 backstop: a unique partial index on (figureInstanceId, sourceNodeId)
 * so a duplicate lazy-snapshot can never persist two InstanceNode rows for the
 * same template node, even from a code path that bypasses the atomic claim in
 * NodeAssignmentService.snapshotInstance(). Ad-hoc nodes (sourceNodeId IS NULL)
 * are excluded — they're intentionally many-per-instance.
 */
export class AddInstanceNodeSourceUniqueIndex1782600000000 implements MigrationInterface {
  name = 'AddInstanceNodeSourceUniqueIndex1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Best-effort cleanup of any duplicates the race already produced, so the
    // constraint below doesn't fail to create on an affected database. Rows
    // still referenced by a node_assignments row (ON DELETE RESTRICT) are left
    // alone rather than risk touching a real assignment.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY "figureInstanceId", "sourceNodeId"
                 ORDER BY "createdAt" ASC, id ASC
               ) AS rn
        FROM instance_nodes
        WHERE "sourceNodeId" IS NOT NULL
      )
      DELETE FROM instance_nodes
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
        AND id NOT IN (SELECT "instanceNodeId" FROM node_assignments);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_instance_nodes_instance_source"
      ON "instance_nodes" ("figureInstanceId", "sourceNodeId")
      WHERE "sourceNodeId" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_instance_nodes_instance_source"`);
  }
}
