import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a new rehearsal starts with in the event form (colla settings): the title the form used to
 * hard-code, and the colla's usual rehearsal start time and place. Performances start empty.
 */
export class AddRehearsalDefaults1786600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "colla_settings"
        ADD COLUMN "rehearsalDefaultTitle" varchar(200) NOT NULL DEFAULT 'Assaig general',
        ADD COLUMN "rehearsalDefaultStartTime" varchar(5) DEFAULT '18:45',
        ADD COLUMN "rehearsalDefaultLocation" varchar(200) NOT NULL DEFAULT 'Lleialtat Santsenca',
        ADD COLUMN "rehearsalDefaultLocationUrl" varchar(500),
        ADD CONSTRAINT "CHK_colla_settings_rehearsal_start_time"
          CHECK ("rehearsalDefaultStartTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "colla_settings"
        DROP CONSTRAINT "CHK_colla_settings_rehearsal_start_time",
        DROP COLUMN "rehearsalDefaultLocationUrl",
        DROP COLUMN "rehearsalDefaultLocation",
        DROP COLUMN "rehearsalDefaultStartTime",
        DROP COLUMN "rehearsalDefaultTitle"
    `);
  }
}
