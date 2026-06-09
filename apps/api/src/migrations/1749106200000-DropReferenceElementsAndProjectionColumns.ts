import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropReferenceElementsAndProjectionColumns1749106200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_elements"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "reference_element_type_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "projectionX"`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "projectionY"`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "projectionScale"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "reference_element_type_enum" AS ENUM('RECTANGLE', 'ARROW')`,
    );
    await queryRunner.query(`
      CREATE TABLE "reference_elements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "reference_element_type_enum" NOT NULL,
        "label" varchar,
        "x" double precision NOT NULL,
        "y" double precision NOT NULL,
        "width" double precision NOT NULL,
        "height" double precision NOT NULL,
        "rotation" double precision NOT NULL DEFAULT 0,
        "color" varchar,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "hiddenInSegments" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "eventId" uuid NOT NULL,
        CONSTRAINT "PK_reference_elements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reference_elements_event" FOREIGN KEY ("eventId")
          REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "figure_instances" ADD "projectionX" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances" ADD "projectionY" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "figure_instances" ADD "projectionScale" double precision NOT NULL DEFAULT 1.0`,
    );
  }
}
