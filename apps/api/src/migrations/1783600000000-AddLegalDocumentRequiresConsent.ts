import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Decouples "editing the text" from "forcing everyone to re-consent": adds `requiresConsent` so a
 * typo-fix publish can update the active text without bumping the consent watermark (see
 * LegalDocument entity doc comment). Non-disruptive: marks the currently-active PRIVACY_POLICY as
 * `requiresConsent = true` so the watermark starts equal to the version everyone already had to
 * accept — no one is asked to re-accept as a side effect of this migration.
 */
export class AddLegalDocumentRequiresConsent1783600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "legal_documents" ADD COLUMN IF NOT EXISTS "requiresConsent" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "legal_documents" SET "requiresConsent" = true WHERE "type" = 'PRIVACY_POLICY' AND "isActive" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "legal_documents" DROP COLUMN IF EXISTS "requiresConsent"`);
  }
}
