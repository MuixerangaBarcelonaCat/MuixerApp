import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the column name with the product language: the UI already talks
 * about «publicar» / «no publicat», not "visible".
 */
export class RenameSegmentIsVisibleToIsPublished1784300000000 implements MigrationInterface {
  name = 'RenameSegmentIsVisibleToIsPublished1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_segments" RENAME COLUMN "isVisible" TO "isPublished"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_segments" RENAME COLUMN "isPublished" TO "isVisible"`);
  }
}
