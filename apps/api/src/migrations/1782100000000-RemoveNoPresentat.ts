import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveNoPresentat1782100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migrate existing NO_PRESENTAT records to ANIRE
    await queryRunner.query(`UPDATE attendances SET status = 'ANIRE' WHERE status = 'NO_PRESENTAT'`);

    // Replace enum type without NO_PRESENTAT
    await queryRunner.query(`CREATE TYPE "attendance_status_enum_new" AS ENUM('PENDENT', 'ANIRE', 'NO_VAIG', 'ASSISTIT')`);
    await queryRunner.query(`ALTER TABLE attendances ALTER COLUMN status TYPE "attendance_status_enum_new" USING status::text::"attendance_status_enum_new"`);
    await queryRunner.query(`DROP TYPE "attendance_status_enum"`);
    await queryRunner.query(`ALTER TYPE "attendance_status_enum_new" RENAME TO "attendance_status_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "attendance_status_enum_new" AS ENUM('PENDENT', 'ANIRE', 'NO_VAIG', 'ASSISTIT', 'NO_PRESENTAT')`);
    await queryRunner.query(`ALTER TABLE attendances ALTER COLUMN status TYPE "attendance_status_enum_new" USING status::text::"attendance_status_enum_new"`);
    await queryRunner.query(`DROP TYPE "attendance_status_enum"`);
    await queryRunner.query(`ALTER TYPE "attendance_status_enum_new" RENAME TO "attendance_status_enum"`);
  }
}
