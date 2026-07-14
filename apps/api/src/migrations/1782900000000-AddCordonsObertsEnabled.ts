import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCordonsObertsEnabled1782900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "figure_instances" ADD COLUMN IF NOT EXISTS "cordonsObertsEnabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "composition_entries" ADD COLUMN IF NOT EXISTS "cordonsObertsEnabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "composition_entries" DROP COLUMN IF EXISTS "cordonsObertsEnabled"`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "cordonsObertsEnabled"`);
  }
}
