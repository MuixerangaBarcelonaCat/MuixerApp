import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sessions (refresh-token families) need a device label; plus the audit actions of the devices modal. */
export class AddRefreshTokenUserAgent1786800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "userAgent" varchar(255)`);
    await queryRunner.query(`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'USER_SESSIONS_REVOKED'`);
    await queryRunner.query(`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'PUSH_SUBSCRIPTION_REMOVED'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres can't drop enum values; they stay (harmless).
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "userAgent"`);
  }
}
