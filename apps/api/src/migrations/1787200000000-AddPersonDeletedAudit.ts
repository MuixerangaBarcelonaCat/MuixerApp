import { MigrationInterface, QueryRunner } from 'typeorm';

/** Audit action for an admin deleting a person for good. */
export class AddPersonDeletedAudit1787200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'PERSON_DELETED'`);
  }

  public async down(): Promise<void> {
    // Postgres can't drop enum values; they stay (harmless).
  }
}
