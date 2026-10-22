import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Node colors become "customized or nothing": a NULL color means "follow the type", and the
 * canvas resolves it to the type palette at render time. Until now every node stored a copy of its
 * preset hex, so a palette change could never reach existing templates and snapshots.
 *
 * Clears, in figure_nodes and instance_nodes, every color that only repeats the old preset of the
 * row's own zone and positionType (compared case-insensitively), every BASE color (BASE colors
 * can't be edited), and the gray that ad-hoc nodes with no preset got server-side. Custom colors
 * stay. The preset values are frozen here: they are no longer in the code.
 *
 * The revert writes the presets back into NULL colors of a known type. It can't tell a color that
 * was NULL before the migration from one it cleared, so those get the preset too.
 */
const OLD_PRESETS: [zone: string, positionType: string, color: string][] = [
  ['PINYA', 'agulla', '#0d9488'],
  ['PINYA', 'mans', '#FFE082'],
  ['PINYA', 'laterals', '#80DEEA'],
  ['PINYA', 'vents', '#A5D6A7'],
  ['PINYA', 'cordo-obert', '#FFF9C4'],
  ['PINYA', 'tap', '#be185d'],
  ['PINYA', 'crossa', '#9FA8DA'],
  ['PINYA', 'contrafort', '#EF9A9A'],
  ['PINYA', 'comodin', '#B0BEC5'],
  ['TRONC', 'segona', '#1E88E5'],
  ['TRONC', 'terça', '#43A047'],
  ['TRONC', 'quarta', '#FB8C00'],
  ['TRONC', 'quinta', '#8E24AA'],
  ['TRONC', 'sisena', '#546E7A'],
  ['TRONC', 'puntal', '#795548'],
  ['TRONC', 'alçadora', '#00ACC1'],
  ['TRONC', 'xiqueta', '#E53935'],
  ['DIRECTION', 'direccio-tronc', '#d97706'],
  ['DIRECTION', 'direccio-xicalla', '#db2777'],
  ['DIRECTION', 'direccio-pinya', '#065f46'],
];
const OLD_BASE_COLOR = '#EEEEEE';
const OLD_AD_HOC_DEFAULT = '#B0BEC5';
const TABLES = ['figure_nodes', 'instance_nodes'];

const presetValues = () => {
  const params = OLD_PRESETS.flat();
  const rows = OLD_PRESETS.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
  return { rows, params };
};

export class NullPresetNodeColors1786400000000 implements MigrationInterface {
  name = 'NullPresetNodeColors1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { rows, params } = presetValues();
    for (const table of TABLES) {
      await queryRunner.query(
        `UPDATE "${table}" n SET "color" = NULL
           FROM (VALUES ${rows}) AS p("zone", "positionType", "color")
          WHERE n."zone"::text = p."zone" AND n."positionType" = p."positionType"
            AND lower(n."color") = lower(p."color")`,
        params,
      );
      await queryRunner.query(`UPDATE "${table}" SET "color" = NULL WHERE "zone" = 'BASE'`);
    }
    await queryRunner.query(
      `UPDATE "instance_nodes" SET "color" = NULL
        WHERE "isAdHoc" AND "zone" <> 'DECORATION' AND lower("color") = lower($1)`,
      [OLD_AD_HOC_DEFAULT],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const { rows, params } = presetValues();
    for (const table of TABLES) {
      await queryRunner.query(
        `UPDATE "${table}" n SET "color" = p."color"
           FROM (VALUES ${rows}) AS p("zone", "positionType", "color")
          WHERE n."zone"::text = p."zone" AND n."positionType" = p."positionType" AND n."color" IS NULL`,
        params,
      );
      await queryRunner.query(`UPDATE "${table}" SET "color" = $1 WHERE "zone" = 'BASE'`, [OLD_BASE_COLOR]);
    }
    await queryRunner.query(
      `UPDATE "instance_nodes" SET "color" = $1
        WHERE "isAdHoc" AND "zone" <> 'DECORATION' AND "color" IS NULL`,
      [OLD_AD_HOC_DEFAULT],
    );
  }
}
