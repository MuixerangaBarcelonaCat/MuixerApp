import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapses the two direction zones (`FIGURE_DIRECTION`, `XICALLA_DIRECTION`) into a single
 * `FigureZone.DIRECTION`, with the flavour carried by `positionType` — the same shape PINYA
 * already uses. Also renames the "figure" flavour to "tronc" (`direccio-figura` →
 * `direccio-tronc`), which is what it actually directs.
 *
 * The enum is fully recreated (no vestigial values), the same way
 * `1782100000000-RemoveNoPresentat` recreates `attendance_status_enum`.
 */
export class UnifyAndRenameDirectionZones1785100000000 implements MigrationInterface {
  name = 'UnifyAndRenameDirectionZones1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Backfill positionType from the old zone while those values still exist (covers rows
    //    with a null positionType — ad-hoc direction nodes — and the legacy 'direccio-figura').
    for (const table of ['figure_nodes', 'instance_nodes']) {
      await queryRunner.query(
        `UPDATE "${table}" SET "positionType" = 'direccio-tronc' WHERE "zone"::text = 'FIGURE_DIRECTION'`,
      );
      await queryRunner.query(
        `UPDATE "${table}" SET "positionType" = 'direccio-xicalla' WHERE "zone"::text = 'XICALLA_DIRECTION'`,
      );
    }

    // 2. Recreate figure_zone_enum without the two direction values, collapsing both to DIRECTION.
    await queryRunner.query(
      `CREATE TYPE "figure_zone_enum_new" AS ENUM('BASE', 'PINYA', 'TRONC', 'DIRECTION', 'DECORATION')`,
    );
    for (const table of ['figure_nodes', 'instance_nodes']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "zone" TYPE "figure_zone_enum_new" USING (
           CASE WHEN "zone"::text IN ('FIGURE_DIRECTION', 'XICALLA_DIRECTION')
                THEN 'DIRECTION' ELSE "zone"::text END
         )::"figure_zone_enum_new"`,
      );
    }
    await queryRunner.query(`DROP TYPE "figure_zone_enum"`);
    await queryRunner.query(`ALTER TYPE "figure_zone_enum_new" RENAME TO "figure_zone_enum"`);

    // 3. Rename the flavour anywhere else it is persisted — tag → figure-node positionType links.
    await queryRunner.query(
      `UPDATE "positions" SET "positionTypes" = array_replace("positionTypes", 'direccio-figura', 'direccio-tronc')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "positions" SET "positionTypes" = array_replace("positionTypes", 'direccio-tronc', 'direccio-figura')`,
    );

    await queryRunner.query(
      `CREATE TYPE "figure_zone_enum_new" AS ENUM('BASE', 'PINYA', 'TRONC', 'FIGURE_DIRECTION', 'XICALLA_DIRECTION', 'DECORATION')`,
    );
    for (const table of ['figure_nodes', 'instance_nodes']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "zone" TYPE "figure_zone_enum_new" USING (
           CASE WHEN "zone"::text = 'DIRECTION' AND "positionType" = 'direccio-xicalla' THEN 'XICALLA_DIRECTION'
                WHEN "zone"::text = 'DIRECTION' THEN 'FIGURE_DIRECTION'
                ELSE "zone"::text END
         )::"figure_zone_enum_new"`,
      );
      await queryRunner.query(
        `UPDATE "${table}" SET "positionType" = 'direccio-figura' WHERE "positionType" = 'direccio-tronc'`,
      );
    }
    await queryRunner.query(`DROP TYPE "figure_zone_enum"`);
    await queryRunner.query(`ALTER TYPE "figure_zone_enum_new" RENAME TO "figure_zone_enum"`);
  }
}
