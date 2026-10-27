import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The colla's settings, until now hard-coded or (the lock days) an env var. Every column defaults
 * to the value it replaces, so the seed row changes no behaviour. Also adds the audit actions the
 * API writes but `CreateAuditLogs` never added: `ATTENDANCE_LOCK_OVERRIDE` writes were failing.
 */
export class CreateCollaSettings1786500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "colla_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "collaName" varchar(100) NOT NULL DEFAULT 'Muixeranga de Barcelona',
        "shirtRequiredPerformances" int NOT NULL DEFAULT 2,
        "shirtRequiredRehearsals" int NOT NULL DEFAULT 6,
        "shoulderHeightBaselineCm" int NOT NULL DEFAULT 140,
        "troncFloorWarningCm" int NOT NULL DEFAULT 5,
        "troncFloorErrorCm" int NOT NULL DEFAULT 10,
        "troncSupportWarningCm" int NOT NULL DEFAULT 3,
        "troncSupportErrorCm" int NOT NULL DEFAULT 5,
        "assignmentLockDays" int NOT NULL DEFAULT 2,
        "autoCheckInPerformances" boolean NOT NULL DEFAULT true,
        "defaultTagId" uuid,
        "majorityAge" int NOT NULL DEFAULT 16,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_colla_settings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_colla_settings_default_tag" FOREIGN KEY ("defaultTagId")
          REFERENCES "positions" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_colla_settings_non_negative" CHECK (
          "shirtRequiredPerformances" >= 0 AND "shirtRequiredRehearsals" >= 0
          AND "shoulderHeightBaselineCm" > 0 AND "assignmentLockDays" >= 0 AND "majorityAge" > 0
          AND "troncFloorWarningCm" > 0 AND "troncSupportWarningCm" > 0
        ),
        CONSTRAINT "CHK_colla_settings_tronc_floor" CHECK ("troncFloorWarningCm" < "troncFloorErrorCm"),
        CONSTRAINT "CHK_colla_settings_tronc_support" CHECK ("troncSupportWarningCm" < "troncSupportErrorCm")
      )
    `);

    // A unique index on a constant: at most one row.
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_colla_settings_singleton" ON "colla_settings" ((true))`);

    const lockDays = Number.parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '', 10);
    await queryRunner.query(
      `INSERT INTO "colla_settings" ("assignmentLockDays", "defaultTagId")
       VALUES ($1, (SELECT "id" FROM "positions" WHERE "slug" = 'persona-nova'))`,
      [Number.isInteger(lockDays) && lockDays >= 0 ? lockDays : 2],
    );

    await queryRunner.query(`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'ATTENDANCE_LOCK_OVERRIDE'`);
    await queryRunner.query(`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'COLLA_SETTINGS_UPDATED'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres can't drop enum values; the two audit actions stay (harmless, and still used).
    await queryRunner.query(`DROP TABLE "colla_settings"`);
  }
}
