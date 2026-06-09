import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSourceVariantOrder1781100000000 implements MigrationInterface {
  name = 'DropSourceVariantOrder1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "sourceVariantOrder"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "figure_instances" ADD COLUMN "sourceVariantOrder" integer`,
    );
  }
}
