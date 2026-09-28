import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationSchedules1785600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_schedules_link_to_enum" AS ENUM ('HOME', 'EVENT', 'CUSTOM')
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_schedules_schedule_type_enum" AS ENUM ('ONE_OFF', 'WEEKLY', 'BEFORE_EVENT')
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(100) NOT NULL,
        "body" varchar(500) NOT NULL,
        "linkedEvent" jsonb,
        "linkTo" "notification_schedules_link_to_enum" NOT NULL,
        "url" varchar,
        "target" jsonb NOT NULL,
        "scheduleType" "notification_schedules_schedule_type_enum" NOT NULL,
        "ruleConfig" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_schedules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_schedules_created_by_user" FOREIGN KEY ("createdByUserId")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_schedules_active_type" ON "notification_schedules" ("isActive", "scheduleType")
    `);

    await queryRunner.query(`
      ALTER TABLE "notification_logs"
      ADD CONSTRAINT "FK_notification_logs_schedule" FOREIGN KEY ("scheduleId")
        REFERENCES "notification_schedules" ("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_notification_logs_schedule"`);
    await queryRunner.query(`DROP TABLE "notification_schedules"`);
    await queryRunner.query(`DROP TYPE "notification_schedules_schedule_type_enum"`);
    await queryRunner.query(`DROP TYPE "notification_schedules_link_to_enum"`);
  }
}
