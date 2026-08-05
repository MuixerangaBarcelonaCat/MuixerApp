import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPrivacyConsent1783400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyPolicyVersion" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "privacyPolicyVersion"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "privacyPolicyAcceptedAt"`);
  }
}
