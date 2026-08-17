import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonDelegatePrimaryAndOtherType1783700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "delegate_type_enum" ADD VALUE IF NOT EXISTS 'OTHER'`,
    );

    await queryRunner.query(
      `ALTER TABLE "person_delegates" ADD COLUMN IF NOT EXISTS "isPrimary" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_person_delegates_primary" ON "person_delegates" ("person_id") WHERE "isPrimary" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_person_delegates_primary"`);
    await queryRunner.query(
      `ALTER TABLE "person_delegates" DROP COLUMN IF EXISTS "isPrimary"`,
    );
    // Postgres has no direct "remove enum value" — OTHER is left in the type on rollback.
  }
}
