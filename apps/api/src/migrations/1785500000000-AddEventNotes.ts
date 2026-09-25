import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventNotes1785500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS "notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events DROP COLUMN IF EXISTS "notes"`);
  }
}
