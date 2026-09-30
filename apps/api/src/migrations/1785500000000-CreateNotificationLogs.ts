import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationLogs1785500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_logs_source_enum" AS ENUM (
        'MANUAL', 'SCHEDULED_ONE_OFF', 'SCHEDULED_WEEKLY', 'SCHEDULED_BEFORE_EVENT'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(100) NOT NULL,
        "body" varchar(500) NOT NULL,
        "url" varchar,
        "target" jsonb NOT NULL,
        "recipientCount" int NOT NULL,
        "source" "notification_logs_source_enum" NOT NULL,
        "scheduleId" uuid,
        "triggeredEventId" uuid,
        "triggeredByUserId" uuid,
        "sentAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notification_logs_sent_at" ON "notification_logs" ("sentAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_logs"`);
    await queryRunner.query(`DROP TYPE "notification_logs_source_enum"`);
  }
}
