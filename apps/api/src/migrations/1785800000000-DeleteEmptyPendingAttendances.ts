import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * No row ≡ PENDENT: a PENDENT row is only kept when it records something — when an answer went
 * back to Pendent (`respondedAt`) or a technician left a note. Rows created up front for people who
 * never answered (mostly by the legacy sync) carry nothing, so they go.
 */
export class DeleteEmptyPendingAttendances1785800000000 implements MigrationInterface {
  name = 'DeleteEmptyPendingAttendances1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "attendances"
       WHERE "status" = 'PENDENT' AND "respondedAt" IS NULL AND "notes" IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Nothing to restore: the deleted rows held no data, and a missing row already reads as PENDENT.
  }
}
