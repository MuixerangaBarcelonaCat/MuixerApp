import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeasonDateOverlapConstraint1782700000000
  implements MigrationInterface
{
  name = 'AddSeasonDateOverlapConstraint1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS btree_gist`,
    );
    await queryRunner.query(
      `ALTER TABLE "seasons" ADD CONSTRAINT "seasons_no_date_overlap"
       EXCLUDE USING gist (
         daterange("startDate", "endDate", '[]') WITH &&
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seasons" DROP CONSTRAINT IF EXISTS "seasons_no_date_overlap"`,
    );
  }
}
