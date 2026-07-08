import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillAttendanceSummary1782600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE events
      SET "attendanceSummary" = ("attendanceSummary" - 'noShow') || '{"childrenAttended": 0}'::jsonb
      WHERE "attendanceSummary" ? 'noShow'
         OR NOT ("attendanceSummary" ? 'childrenAttended')
    `);

    await queryRunner.query(`
      UPDATE events e
      SET "attendanceSummary" = jsonb_set(
        e."attendanceSummary",
        '{childrenAttended}',
        COALESCE((
          SELECT to_jsonb(count(*))
          FROM attendances a
          JOIN persons p ON p.id = a."personId"
          WHERE a."eventId" = e.id
            AND a.status = 'ASSISTIT'
            AND p."isXicalla" = true
        ), '0'::jsonb)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE events
      ALTER COLUMN "attendanceSummary"
      SET DEFAULT '{"confirmed":0,"declined":0,"pending":0,"attended":0,"lateCancel":0,"children":0,"childrenAttended":0,"total":0}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE events
      SET "attendanceSummary" = ("attendanceSummary" - 'childrenAttended') || '{"noShow": 0}'::jsonb
      WHERE "attendanceSummary" ? 'childrenAttended'
         OR NOT ("attendanceSummary" ? 'noShow')
    `);

    await queryRunner.query(`
      ALTER TABLE events
      ALTER COLUMN "attendanceSummary"
      SET DEFAULT '{"confirmed":0,"declined":0,"pending":0,"attended":0,"noShow":0,"lateCancel":0,"children":0,"total":0}'
    `);
  }
}
