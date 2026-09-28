import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The notification cron checks "already fired?" every minute against `notification_logs`, an
 * append-only table: BEFORE_EVENT by (scheduleId, triggeredEventId), once per matching event;
 * WEEKLY by the latest row of a scheduleId. Without these indexes both are sequential scans that
 * get slower as the history grows.
 */
export class AddNotificationLogScheduleIndexes1785700000000 implements MigrationInterface {
  name = 'AddNotificationLogScheduleIndexes1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_logs_schedule_event" ON "notification_logs" ("scheduleId", "triggeredEventId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_logs_schedule_sent_at" ON "notification_logs" ("scheduleId", "sentAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notification_logs_schedule_sent_at"`);
    await queryRunner.query(`DROP INDEX "IDX_notification_logs_schedule_event"`);
  }
}
