import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSegmentDistributionFields1782200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE figure_instances ADD COLUMN IF NOT EXISTS "projectionAngle" double precision`);
    await queryRunner.query(`ALTER TABLE figure_instances ADD COLUMN IF NOT EXISTS "troncPanelX" double precision`);
    await queryRunner.query(`ALTER TABLE figure_instances ADD COLUMN IF NOT EXISTS "troncPanelY" double precision`);
    await queryRunner.query(`ALTER TABLE figure_instances ADD COLUMN IF NOT EXISTS "troncPanelWidth" double precision`);
    await queryRunner.query(`ALTER TABLE figure_instances ADD COLUMN IF NOT EXISTS "troncPanelHeight" double precision`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE figure_instances DROP COLUMN IF EXISTS "troncPanelHeight"`);
    await queryRunner.query(`ALTER TABLE figure_instances DROP COLUMN IF EXISTS "troncPanelWidth"`);
    await queryRunner.query(`ALTER TABLE figure_instances DROP COLUMN IF EXISTS "troncPanelY"`);
    await queryRunner.query(`ALTER TABLE figure_instances DROP COLUMN IF EXISTS "troncPanelX"`);
    await queryRunner.query(`ALTER TABLE figure_instances DROP COLUMN IF EXISTS "projectionAngle"`);
  }
}
