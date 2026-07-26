import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNetaFigureMode1781900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "figure_mode_enum" ADD VALUE IF NOT EXISTS 'NETA'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE figure_instances SET "figureMode" = 'COMPLETA' WHERE "figureMode" = 'NETA'`);
    await queryRunner.query(`ALTER TABLE figure_instances ALTER COLUMN "figureMode" TYPE varchar`);
    await queryRunner.query(`DROP TYPE "figure_mode_enum"`);
    await queryRunner.query(`CREATE TYPE "figure_mode_enum" AS ENUM ('COMPLETA', 'PEU', 'REMAT')`);
    await queryRunner.query(
      `ALTER TABLE figure_instances ALTER COLUMN "figureMode" TYPE "figure_mode_enum" USING "figureMode"::"figure_mode_enum"`,
    );
  }
}
