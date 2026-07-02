import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonNotesEmoji1782500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE persons ADD COLUMN IF NOT EXISTS "notesEmoji" varchar(16)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE persons DROP COLUMN IF EXISTS "notesEmoji"`);
  }
}
