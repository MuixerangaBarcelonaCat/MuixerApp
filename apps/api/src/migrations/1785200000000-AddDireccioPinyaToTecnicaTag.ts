import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Points the seeded «Tècnica» tag at the new `direccio-pinya` figure-node positionType too,
 * alongside `direccio-tronc` and `direccio-xicalla`. Idempotent and a no-op if the tag was
 * deleted or edited away from the catalog default (`/config/tags` owns it after seeding).
 */
export class AddDireccioPinyaToTecnicaTag1785200000000 implements MigrationInterface {
  name = 'AddDireccioPinyaToTecnicaTag1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "positions"
         SET "positionTypes" = array_append("positionTypes", 'direccio-pinya')
       WHERE "slug" = 'tecnica'
         AND NOT ('direccio-pinya' = ANY("positionTypes"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "positions"
         SET "positionTypes" = array_remove("positionTypes", 'direccio-pinya')
       WHERE "slug" = 'tecnica'`,
    );
  }
}
