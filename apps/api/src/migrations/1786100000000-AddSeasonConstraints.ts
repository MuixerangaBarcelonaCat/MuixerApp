import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes seasons proper non-overlapping date ranges, the precondition for deriving an event's season
 * from its date. `SeasonService` already rejects overlaps in code, but two concurrent writes can both
 * pass that check; the exclusion constraint closes the race. Ranges are inclusive (`[]`), so adjacent
 * seasons must not share a day. Range types ship their own GiST opclass — no extension needed.
 */
export class AddSeasonConstraints1786100000000 implements MigrationInterface {
  name = 'AddSeasonConstraints1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.repairSeasons(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "seasons" ADD CONSTRAINT "CK_seasons_date_range" CHECK ("endDate" > "startDate")`,
    );
    await queryRunner.query(
      `ALTER TABLE "seasons" ADD CONSTRAINT "EX_seasons_no_overlap"
       EXCLUDE USING gist (daterange("startDate", "endDate", '[]') WITH &&)`,
    );
  }

  /**
   * Migrations run on boot, so rows breaking the constraints would keep the API from starting.
   * Repairs what has one obvious fix: inverted ranges are swapped, one-day seasons get a second
   * day, and of two overlapping seasons the one that starts first ends the day before the other
   * starts. Starts never move, so one pass in start order leaves the ranges disjoint. Anything
   * left without a valid range (two seasons starting on the same or consecutive days) fails with
   * the season names, to be fixed by hand.
   */
  private async repairSeasons(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "seasons" SET "startDate" = "endDate", "endDate" = "startDate" WHERE "endDate" < "startDate"`,
    );
    await queryRunner.query(`UPDATE "seasons" SET "endDate" = "startDate" + 1 WHERE "endDate" = "startDate"`);
    await queryRunner.query(
      `UPDATE "seasons" s SET "endDate" = n."nextStart" - 1
       FROM (
         SELECT "id", LEAD("startDate") OVER (ORDER BY "startDate", "endDate", "id") AS "nextStart"
         FROM "seasons"
       ) n
       WHERE s."id" = n."id" AND s."endDate" >= n."nextStart"`,
    );
    const broken: { name: string }[] = await queryRunner.query(
      `SELECT "name" FROM "seasons" WHERE "endDate" <= "startDate" ORDER BY "startDate", "name"`,
    );
    if (broken.length > 0) {
      const overlapping: { name: string }[] = await queryRunner.query(
        `SELECT DISTINCT o."name" FROM "seasons" b JOIN "seasons" o ON o."id" <> b."id"
         WHERE b."endDate" <= b."startDate" AND o."startDate" BETWEEN b."startDate" AND b."startDate" + 1
         ORDER BY o."name"`,
      );
      const names = [...new Set([...broken, ...overlapping].map((r) => r.name))].join(', ');
      throw new Error(
        `Overlapping seasons start on the same or consecutive days and can't be repaired automatically: ${names}. ` +
          'Fix their dates by hand and run the migrations again.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seasons" DROP CONSTRAINT "EX_seasons_no_overlap"`);
    await queryRunner.query(`ALTER TABLE "seasons" DROP CONSTRAINT "CK_seasons_date_range"`);
  }
}
