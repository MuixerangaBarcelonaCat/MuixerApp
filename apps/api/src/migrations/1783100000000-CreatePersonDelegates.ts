import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePersonDelegates1783100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "delegate_type_enum" AS ENUM ('PARENT', 'PARTNER', 'GUARDIAN')
    `);

    await queryRunner.query(`
      CREATE TABLE "person_delegates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "person_id" uuid NOT NULL,
        "delegateType" "delegate_type_enum" NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_person_delegates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_person_delegates_user_person" UNIQUE ("user_id", "person_id"),
        CONSTRAINT "FK_person_delegates_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_person_delegates_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_person_delegates_user" ON "person_delegates" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_person_delegates_person" ON "person_delegates" ("person_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "person_delegates"`);
    await queryRunner.query(`DROP TYPE "delegate_type_enum"`);
  }
}
