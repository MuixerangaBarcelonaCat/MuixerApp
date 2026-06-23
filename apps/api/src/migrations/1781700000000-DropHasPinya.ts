import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropHasPinya1781700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE figure_templates DROP COLUMN IF EXISTS "hasPinya"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE figure_templates ADD COLUMN "hasPinya" boolean NOT NULL DEFAULT true`);
  }
}
