import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNumberOfCordons1781600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD COLUMN IF NOT EXISTS "numberOfCordons" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "numberOfCordons"`);
  }
}
