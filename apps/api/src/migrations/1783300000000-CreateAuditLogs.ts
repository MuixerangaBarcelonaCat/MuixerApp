import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1783300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "audit_action_enum" AS ENUM (
        'CONSENT_ACCEPTED', 'SENSITIVE_DATA_ACCESS', 'SENSITIVE_DATA_EXPORT'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorUserId" uuid,
        "action" "audit_action_enum" NOT NULL,
        "targetType" varchar,
        "targetId" uuid,
        "metadata" jsonb,
        "ipAddress" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actorUserId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created" ON "audit_logs" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "audit_action_enum"`);
  }
}
