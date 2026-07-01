import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropOldCompositionTables1782300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop FK and compositionSlotId column from node_assignments
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "FK_node_assignments_compositionSlot"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_node_slot"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person_slot"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP COLUMN IF EXISTS "compositionSlotId"`);

    // Add simpler unique constraints without compositionSlotId (drop first to be idempotent)
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_node"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "UQ_node_assignments_instance_node" UNIQUE ("figureInstanceId", "instanceNodeId")`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "UQ_node_assignments_instance_person" UNIQUE ("figureInstanceId", "personId")`);

    // Nullify and drop compositionTemplateId from figure_instances
    await queryRunner.query(`UPDATE "figure_instances" SET "compositionTemplateId" = NULL WHERE "compositionTemplateId" IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP CONSTRAINT IF EXISTS "FK_figure_instances_compositionTemplate"`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP COLUMN IF EXISTS "compositionTemplateId"`);

    // Drop old composition tables (order matters: slots ref templates)
    await queryRunner.query(`DROP TABLE IF EXISTS "composition_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "composition_templates"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate composition tables
    await queryRunner.query(`
      CREATE TABLE "composition_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_composition_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_composition_templates_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "composition_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" varchar,
        "offsetX" float NOT NULL DEFAULT 0,
        "offsetY" float NOT NULL DEFAULT 0,
        "sortOrder" int NOT NULL DEFAULT 0,
        "compositionId" uuid NOT NULL,
        "figureTemplateId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_composition_slots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_composition_slots_composition" FOREIGN KEY ("compositionId") REFERENCES "composition_templates"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_composition_slots_figureTemplate" FOREIGN KEY ("figureTemplateId") REFERENCES "figure_templates"("id") ON DELETE RESTRICT
      )
    `);

    // Restore compositionSlotId column and constraints on node_assignments
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_node"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT IF EXISTS "UQ_node_assignments_instance_person"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD COLUMN "compositionSlotId" uuid`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "FK_node_assignments_compositionSlot" FOREIGN KEY ("compositionSlotId") REFERENCES "composition_slots"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "UQ_node_assignments_instance_node_slot" UNIQUE ("figureInstanceId", "instanceNodeId", "compositionSlotId")`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "UQ_node_assignments_instance_person_slot" UNIQUE ("figureInstanceId", "personId", "compositionSlotId")`);

    // Restore compositionTemplateId on figure_instances
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD COLUMN "compositionTemplateId" uuid`);
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD CONSTRAINT "FK_figure_instances_compositionTemplate" FOREIGN KEY ("compositionTemplateId") REFERENCES "composition_templates"("id") ON DELETE RESTRICT`);
  }
}
