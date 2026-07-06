import { MigrationInterface, QueryRunner } from 'typeorm';

export class TagPositionTypes1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "positions" ADD COLUMN "positionTypes" text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "positions" DROP COLUMN "zone"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "positions" ADD COLUMN "zone" varchar`);
    await queryRunner.query(`ALTER TABLE "positions" DROP COLUMN "positionTypes"`);
  }
}
