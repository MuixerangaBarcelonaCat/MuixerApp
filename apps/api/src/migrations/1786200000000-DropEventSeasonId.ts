import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An event's season is now derived from its date (seasons are non-overlapping ranges since
 * `AddSeasonConstraints`), so the stored `events.seasonId` goes away. Events whose date falls in no
 * season simply have none («Sense temporada»). `IDX_events_date` already serves the date lookups.
 *
 * `down` restores the column and backfills it from the dates — not the values dropped here, which
 * could disagree with the dates (the legacy sync put out-of-range events into the latest season).
 */
export class DropEventSeasonId1786200000000 implements MigrationInterface {
  name = 'DropEventSeasonId1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_season_date"`);
    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "FK_events_season"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "seasonId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD "seasonId" uuid`);
    await queryRunner.query(
      `UPDATE "events" e SET "seasonId" = s."id"
       FROM "seasons" s
       WHERE e."date" BETWEEN s."startDate" AND s."endDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_events_season"
       FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_events_season_date" ON "events" ("seasonId", "date")`);
  }
}
