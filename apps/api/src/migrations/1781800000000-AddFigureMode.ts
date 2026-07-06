import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFigureMode1781800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "figure_mode_enum" AS ENUM ('COMPLETA', 'PEU', 'REMAT')`);
    await queryRunner.query(
      `ALTER TABLE figure_instances ADD COLUMN "figureMode" "figure_mode_enum" NOT NULL DEFAULT 'COMPLETA'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE figure_instances DROP COLUMN "figureMode"`);
    await queryRunner.query(`DROP TYPE "figure_mode_enum"`);
  }
}
