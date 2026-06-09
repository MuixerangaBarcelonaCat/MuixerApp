import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restores projection columns on figure_instances that were erroneously
 * dropped by a previous migration. Also ensures reference_elements table
 * and its enum are dropped (feature removed).
 */
export class RestoreProjectionColumnsAndReferenceElements1781000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Restore projection columns on figure_instances
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'figure_instances' AND column_name = 'projectionX'
    `);

    if (columns.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "figure_instances" ADD "projectionX" double precision`,
      );
      await queryRunner.query(
        `ALTER TABLE "figure_instances" ADD "projectionY" double precision`,
      );
      await queryRunner.query(
        `ALTER TABLE "figure_instances" ADD "projectionScale" double precision NOT NULL DEFAULT 1.0`,
      );
    }

    // 2. Drop reference_elements table (feature removed, idempotent)
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_elements"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "reference_element_type_enum"`,
    );

    // 3. Remove the old erroneous migration record if present
    await queryRunner.query(
      `DELETE FROM "typeorm_migrations" WHERE "name" = 'DropReferenceElementsAndProjectionColumns1749106200000'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "projectionX"`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "projectionY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "projectionScale"`,
    );
  }
}
