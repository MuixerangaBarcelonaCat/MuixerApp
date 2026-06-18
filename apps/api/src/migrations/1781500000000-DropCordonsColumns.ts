import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCordonsColumns1781500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "numberOfCordons"`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "openCordons"`);
    await queryRunner.query(`ALTER TABLE "rengles" DROP COLUMN IF EXISTS "allowsCordoObert"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rengles" ADD COLUMN "allowsCordoObert" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD COLUMN "openCordons" jsonb`);
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD COLUMN "numberOfCordons" integer`);
  }
}
