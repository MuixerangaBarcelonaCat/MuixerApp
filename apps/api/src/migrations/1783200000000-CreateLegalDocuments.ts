import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLegalDocuments1783200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "legal_document_type_enum" AS ENUM ('PRIVACY_POLICY', 'TRANSPARENCY_CLAUSE')
    `);

    await queryRunner.query(`
      CREATE TABLE "legal_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "legal_document_type_enum" NOT NULL,
        "version" integer NOT NULL,
        "content" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT false,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_legal_documents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_legal_documents_type_version" UNIQUE ("type", "version")
      )
    `);

    // At most one active document per type.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_legal_documents_active_per_type"
      ON "legal_documents" ("type") WHERE "isActive" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_legal_documents_active_per_type"`);
    await queryRunner.query(`DROP TABLE "legal_documents"`);
    await queryRunner.query(`DROP TYPE "legal_document_type_enum"`);
  }
}
