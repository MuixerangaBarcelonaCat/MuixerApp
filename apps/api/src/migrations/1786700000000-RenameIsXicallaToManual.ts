import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Xicalla is worked out on read from the birth date and the colla's age of majority
 * (`xicallaSql()` in `person/xicalla.sql.ts`). The stored flag only counts when the birth date is
 * unknown, so it is renamed to say so. Data is kept as it is: nothing derived is written.
 */
export class RenameIsXicallaToManual1786700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "persons" RENAME COLUMN "isXicalla" TO "isXicallaManual"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "persons" RENAME COLUMN "isXicallaManual" TO "isXicalla"`);
  }
}
