import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops `PARTNER` from `delegate_type_enum`: naming a delegate as someone's partner reveals
 * protected data (sexual orientation). Existing PARTNER delegates become OTHER, and the enum is
 * fully recreated (no vestigial value), the same way `1785100000000-UnifyAndRenameDirectionZones`
 * recreates `figure_zone_enum`.
 */
export class RemovePartnerDelegateType1785900000000 implements MigrationInterface {
  name = 'RemovePartnerDelegateType1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "delegate_type_enum_new" AS ENUM('PARENT', 'GUARDIAN', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "person_delegates" ALTER COLUMN "delegateType" TYPE "delegate_type_enum_new" USING (
         CASE WHEN "delegateType"::text = 'PARTNER' THEN 'OTHER' ELSE "delegateType"::text END
       )::"delegate_type_enum_new"`,
    );
    await queryRunner.query(`DROP TYPE "delegate_type_enum"`);
    await queryRunner.query(`ALTER TYPE "delegate_type_enum_new" RENAME TO "delegate_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restores the value only: which OTHER rows used to be PARTNER is deliberately not kept.
    await queryRunner.query(
      `CREATE TYPE "delegate_type_enum_new" AS ENUM('PARENT', 'PARTNER', 'GUARDIAN', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "person_delegates" ALTER COLUMN "delegateType" TYPE "delegate_type_enum_new"
       USING "delegateType"::text::"delegate_type_enum_new"`,
    );
    await queryRunner.query(`DROP TYPE "delegate_type_enum"`);
    await queryRunner.query(`ALTER TYPE "delegate_type_enum_new" RENAME TO "delegate_type_enum"`);
  }
}
