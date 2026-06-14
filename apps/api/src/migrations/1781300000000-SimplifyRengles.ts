import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyRengles1781300000000 implements MigrationInterface {
  name = 'SimplifyRengles1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE figure_nodes SET "ringLevel" = "renglaPosition"
      WHERE "renglaPosition" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE rengles ALTER COLUMN "name" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE rengles DROP COLUMN IF EXISTS "startPosition"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rengles ADD COLUMN "startPosition" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE rengles ALTER COLUMN "name" SET NOT NULL
    `);
  }
}
