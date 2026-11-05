import { MigrationInterface, QueryRunner } from 'typeorm';

/** Audit action for an admin sending a test push to a user's device. */
export class AddPushSubscriptionTestedAudit1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'PUSH_SUBSCRIPTION_TESTED'`);
  }

  public async down(): Promise<void> {
    // Postgres can't drop enum values; they stay (harmless).
  }
}
