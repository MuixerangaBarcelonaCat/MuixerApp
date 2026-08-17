import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retires `persons.managedById` in favour of `PersonDelegate` (guardian case) and
 * `users.person_id` (self-management case, via the `Person.user` inverse relation
 * added in the same rollout — see person.entity.ts). Backfills any pre-existing
 * guardian-case rows into `person_delegates` before dropping the column; the
 * self-management case needs no backfill since `users.person_id` already
 * independently held that fact.
 */
export class DropPersonManagedBy1783800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill the guardian case: managedById pointing at a user whose own
    // linked person (users.person_id) is NOT this person.
    await queryRunner.query(`
      INSERT INTO "person_delegates" ("user_id", "person_id", "delegateType", "isPrimary", "isActive")
      SELECT p."managedById", p."id", 'PARENT', true, true
      FROM "persons" p
      JOIN "users" u ON u."id" = p."managedById"
      WHERE p."managedById" IS NOT NULL
        AND (u."person_id" IS NULL OR u."person_id" != p."id")
      ON CONFLICT ("user_id", "person_id")
      DO UPDATE SET "isPrimary" = true, "delegateType" = 'PARENT'
    `);

    await queryRunner.query(`ALTER TABLE "persons" DROP CONSTRAINT "FK_persons_managedBy"`);
    await queryRunner.query(`ALTER TABLE "persons" DROP COLUMN "managedById"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "persons" ADD COLUMN "managedById" uuid`);
    await queryRunner.query(
      `ALTER TABLE "persons" ADD CONSTRAINT "FK_persons_managedBy" FOREIGN KEY ("managedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Self case: reverse-populate from users.person_id.
    await queryRunner.query(`
      UPDATE "persons" p
      SET "managedById" = u."id"
      FROM "users" u
      WHERE u."person_id" = p."id"
    `);

    // Guardian case: reverse-populate from primary person_delegates rows.
    await queryRunner.query(`
      UPDATE "persons" p
      SET "managedById" = pd."user_id"
      FROM "person_delegates" pd
      WHERE pd."person_id" = p."id" AND pd."isPrimary" = true AND p."managedById" IS NULL
    `);
  }
}
