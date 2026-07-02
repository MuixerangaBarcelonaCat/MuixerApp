import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompositions1782400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "compositions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compositions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "composition_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" varchar,
        "offsetX" float NOT NULL DEFAULT 0,
        "offsetY" float NOT NULL DEFAULT 0,
        "angle" float NOT NULL DEFAULT 0,
        "troncPanelX" float,
        "troncPanelY" float,
        "figureMode" varchar NOT NULL DEFAULT 'COMPLETA',
        "numberOfCordons" int,
        "sortOrder" int NOT NULL DEFAULT 0,
        "compositionId" uuid NOT NULL,
        "figureTemplateId" uuid NOT NULL,
        CONSTRAINT "PK_composition_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_composition_entries_composition" FOREIGN KEY ("compositionId") REFERENCES "compositions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_composition_entries_figureTemplate" FOREIGN KEY ("figureTemplateId") REFERENCES "figure_templates"("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "composition_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "compositions"`);
  }
}
