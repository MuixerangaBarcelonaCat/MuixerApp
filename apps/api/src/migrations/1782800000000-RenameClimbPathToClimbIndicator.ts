import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the unused-in-UI "climbPath" column to "climbIndicator" on both
 * figure_nodes and instance_nodes, reflecting its actual purpose: a short
 * marker (e.g. "X") shown next to the assigned person's name in assignment
 * and projection views.
 */
export class RenameClimbPathToClimbIndicator1782800000000 implements MigrationInterface {
  name = 'RenameClimbPathToClimbIndicator1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "figure_nodes" RENAME COLUMN "climbPath" TO "climbIndicator"`);
    await queryRunner.query(`ALTER TABLE "instance_nodes" RENAME COLUMN "climbPath" TO "climbIndicator"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "instance_nodes" RENAME COLUMN "climbIndicator" TO "climbPath"`);
    await queryRunner.query(`ALTER TABLE "figure_nodes" RENAME COLUMN "climbIndicator" TO "climbPath"`);
  }
}
