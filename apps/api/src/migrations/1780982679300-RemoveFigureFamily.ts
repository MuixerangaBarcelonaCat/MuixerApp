import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the FigureFamily concept:
 *  1. Copies figure_family_nodes → figure_nodes for every template in each family
 *  2. Drops FK + columns familyId / variantOrder from figure_templates
 *  3. Drops figure_family_nodes table
 *  4. Drops figure_families table
 */
export class RemoveFigureFamily1780982679300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Copy family-level nodes (TRONC/BASE) to figure_nodes for each template
    //    Cast enum columns through text to bridge different-named but same-valued PG enums
    await queryRunner.query(`
      INSERT INTO figure_nodes (
        id, label, zone, "positionType", x, y, z, width, height, rotation,
        color, shape, "sortOrder", "climbPath", "ringLevel", "renglaId",
        "renglaPosition", metadata, "createdAt", "updatedAt", "templateId", "originNodeId"
      )
      SELECT
        uuid_generate_v4(),
        ffn.label,
        ffn.zone::text::figure_nodes_zone_enum,
        ffn."positionType",
        ffn.x,
        ffn.y,
        ffn.z,
        ffn.width,
        ffn.height,
        ffn.rotation,
        ffn.color,
        ffn.shape::text::figure_nodes_shape_enum,
        ffn."sortOrder",
        ffn."climbPath",
        ffn."ringLevel",
        ffn."renglaId",
        ffn."renglaPosition",
        ffn.metadata,
        ffn."createdAt",
        NOW(),
        ft.id,
        NULL
      FROM figure_family_nodes ffn
      JOIN figure_families ff ON ffn."familyId" = ff.id
      JOIN figure_templates ft ON ft."familyId" = ff.id
    `);

    // 2. Drop FK constraint on figure_templates.familyId
    await queryRunner.query(
      `ALTER TABLE figure_templates DROP CONSTRAINT IF EXISTS "FK_figure_templates_family"`,
    );

    // 3. Drop familyId and variantOrder columns from figure_templates
    await queryRunner.query(`ALTER TABLE figure_templates DROP COLUMN IF EXISTS "familyId"`);
    await queryRunner.query(`ALTER TABLE figure_templates DROP COLUMN IF EXISTS "variantOrder"`);

    // 4. Drop figure_family_nodes table (CASCADE handles any remaining FKs)
    await queryRunner.query(`DROP TABLE IF EXISTS figure_family_nodes`);

    // 5. Drop figure_families table
    await queryRunner.query(`DROP TABLE IF EXISTS figure_families`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate figure_families
    await queryRunner.query(`
      CREATE TABLE figure_families (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        name varchar NOT NULL,
        slug varchar NOT NULL,
        description text,
        metadata jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_figure_families_name" UNIQUE (name),
        CONSTRAINT "UQ_figure_families_slug" UNIQUE (slug),
        CONSTRAINT "PK_figure_families" PRIMARY KEY (id)
      )
    `);

    // Recreate figure_family_nodes
    await queryRunner.query(`
      CREATE TABLE figure_family_nodes (
        id uuid NOT NULL DEFAULT uuid_generate_v4(),
        label varchar NOT NULL,
        zone figure_nodes_zone_enum NOT NULL,
        "positionType" varchar,
        x float NOT NULL,
        y float NOT NULL,
        z integer NOT NULL DEFAULT 0,
        width float NOT NULL,
        height float NOT NULL,
        rotation float NOT NULL DEFAULT 0,
        color varchar,
        shape figure_nodes_shape_enum NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "climbPath" varchar,
        "ringLevel" integer,
        "renglaId" uuid,
        "renglaPosition" integer,
        metadata jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "familyId" uuid NOT NULL,
        CONSTRAINT "PK_figure_family_nodes" PRIMARY KEY (id),
        CONSTRAINT "FK_figure_family_nodes_family"
          FOREIGN KEY ("familyId") REFERENCES figure_families(id) ON DELETE CASCADE
      )
    `);

    // Re-add columns to figure_templates
    await queryRunner.query(`ALTER TABLE figure_templates ADD COLUMN "familyId" uuid`);
    await queryRunner.query(
      `ALTER TABLE figure_templates ADD COLUMN "variantOrder" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(`
      ALTER TABLE figure_templates
        ADD CONSTRAINT "FK_figure_templates_family"
          FOREIGN KEY ("familyId") REFERENCES figure_families(id) ON DELETE RESTRICT
    `);
  }
}
