import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Afegeix l'etiqueta «Tècnica» (grup TRONC) al catàleg. Apunta als dos `positionType`s de
 * direcció —figura i xicalla— i pren el color del preset «Direcció fig.» (#d97706).
 *
 * El catàleg no és tancat (§2 de docs/TAGS.md): esta migració només fixa un punt de partida
 * més; `/config/tags` permet editar-la o esborrar-la després.
 */
const SLUG = 'tecnica';
const NAME = 'Tècnica';
const CATEGORY = 'TRONC';
const POSITION_TYPES = ['direccio-figura', 'direccio-xicalla'];
const COLOR = '#d97706';

export class AddTecnicaTag1784900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // `positions.name` és únic: allibera el nom si el porta una altra etiqueta —feta a mà des
    // del dashboard, per exemple—, o l'`INSERT` de baix avortaria la migració amb un 23505.
    // El driver de postgres torna `[rows, affectedRowCount]` per a una query amb RETURNING.
    const [renamedRows] = await queryRunner.query(
      `UPDATE "positions" SET name = name || ' (antiga)' WHERE name = $1 AND slug <> $2 RETURNING slug, name`,
      [NAME, SLUG],
    );
    for (const row of renamedRows as { slug: string; name: string }[]) {
      console.log(`[AddTecnicaTag] renamed colliding tag slug=${row.slug} to name="${row.name}"`);
    }

    await queryRunner.query(
      `INSERT INTO "positions" (name, slug, "positionTypes", color, category)
       VALUES ($1, $2, $3::text[], $4, $5)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             "positionTypes" = EXCLUDED."positionTypes",
             color = EXCLUDED.color,
             category = EXCLUDED.category`,
      [NAME, SLUG, POSITION_TYPES, COLOR, CATEGORY],
    );
  }

  /** Només lleva l'etiqueta si no té cap persona assignada, per no perdre dades introduïdes
   *  després de la migració. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "positions" t
       WHERE t.slug = $1
         AND NOT EXISTS (SELECT 1 FROM "person_positions" pp WHERE pp."positionsId" = t.id)`,
      [SLUG],
    );
  }
}
