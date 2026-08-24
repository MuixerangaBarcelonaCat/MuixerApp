import { MigrationInterface, QueryRunner } from 'typeorm';

const TRONC_TYPES = [
  'segona',
  'terça',
  'quarta',
  'quinta',
  'sisena',
  'puntal',
  'alçadora',
  'xiqueta',
  'direccio-figura',
  'direccio-xicalla',
  'base',
];

const PINYA_TYPES = [
  'agulla',
  'mans',
  'laterals',
  'vents',
  'cordo-obert',
  'tap',
  'crossa',
  'contrafort',
  'comodin',
];

export class TagCategory1784600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "positions" ADD COLUMN "category" varchar(20)`);

    // Non-empty subset of tronc/direction/base vocabulary → TRONC
    await queryRunner.query(
      `UPDATE "positions" SET "category" = 'TRONC'
       WHERE cardinality("positionTypes") > 0
         AND "positionTypes" <@ ARRAY[${TRONC_TYPES.map((t) => `'${t}'`).join(', ')}]::text[]`,
    );

    // Non-empty subset of pinya vocabulary → PINYA
    await queryRunner.query(
      `UPDATE "positions" SET "category" = 'PINYA'
       WHERE "category" IS NULL
         AND cardinality("positionTypes") > 0
         AND "positionTypes" <@ ARRAY[${PINYA_TYPES.map((t) => `'${t}'`).join(', ')}]::text[]`,
    );

    // Everything else (empty, unknown types, or mixed tronc+pinya) → ALTRES
    await queryRunner.query(`UPDATE "positions" SET "category" = 'ALTRES' WHERE "category" IS NULL`);

    await queryRunner.query(`ALTER TABLE "positions" ALTER COLUMN "category" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "positions" DROP COLUMN "category"`);
  }
}
