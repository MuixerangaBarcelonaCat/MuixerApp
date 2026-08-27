import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etiqueta legacy en plural → etiqueta definitiva del catàleg.
 *
 * La migració `TagCatalog` va construir el seu remapatge amb els slugs singulars de
 * `POSITION_MAPPING` (`segon-lateral`, `novatos`…), però les bases de dades importades de
 * l'app legacy tenen aquestes sis amb el slug en plural, així que van sobreviure amb la seua
 * gent assignada i al grup ALTRES.
 */
const REMAP: Record<string, string> = {
  primeres: 'mans',
  vents: 'vent',
  laterals: 'lateral',
  'segons-laterals': 'lateral',
  contraforts: 'contrafort',
  crosses: 'crossa',
};

/**
 * Noms del catàleg tal com els escriu l'equip tècnic. Els slugs no canvien: són
 * identificadors interns i `persona-nova` és, a més, el punt d'ancoratge de l'etiqueta per
 * defecte a l'alta d'una persona.
 */
const RENAMES: { slug: string; from: string; to: string }[] = [
  { slug: 'mans',          from: 'Mans',                 to: '1es Mans' },
  { slug: 'vent',          from: 'Vent',                 to: '1es Vents' },
  { slug: 'lateral',       from: 'Lateral',              to: 'Laterals / Diagonals' },
  { slug: 'agulla',        from: 'Agulla',               to: 'Agulles' },
  { slug: 'contrafort',    from: 'Contrafort',           to: 'Contraforts' },
  { slug: 'crossa',        from: 'Crossa',               to: 'Crosses' },
  { slug: 'tap',           from: 'Tap',                  to: 'Taps' },
  { slug: 'persona-nova',  from: 'Persona Nova',         to: 'Persones Noves' },
  { slug: 'baix',          from: 'Baix',                 to: 'Baixes' },
  { slug: 'segona',        from: 'Segona',               to: 'Segones' },
  { slug: 'terca',         from: 'Terça',                to: 'Terces' },
  { slug: 'alcadora',      from: 'Alçadora',             to: 'Alçadores' },
  { slug: 'figures-netes', from: 'Figures Netes (SP)',   to: 'Figures SP / Figures Netes' },
  { slug: 'sense-tronc',   from: 'Sense Tronc',          to: 'No troncs' },
  { slug: 'xiquets-colla', from: 'Xiquet/a de la Colla', to: 'Xiquets/es de la colla' },
  { slug: 'acompanyant',   from: 'Acompanyant',          to: 'Acompanyants' },
];

export class TagCatalogLegacyPlurals1784800000000 implements MigrationInterface {
  /**
   * L'ordre no és negociable: «Contraforts» i «Crosses» són alhora el nom nou d'una etiqueta
   * del catàleg i el nom actual d'una etiqueta legacy, i `positions.name` és únic. Absorbir
   * primer les legacy allibera els noms; renombrar primer avortaria la migració amb un 23505.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [legacySlug, targetSlug] of Object.entries(REMAP)) {
      await queryRunner.query(
        `INSERT INTO "person_positions" ("personsId", "positionsId")
         SELECT pp."personsId", target.id
         FROM "person_positions" pp
         JOIN "positions" legacy ON legacy.id = pp."positionsId" AND legacy.slug = $1
         JOIN "positions" target ON target.slug = $2
         ON CONFLICT DO NOTHING`,
        [legacySlug, targetSlug],
      );
    }

    const obsolete = Object.keys(REMAP);
    const { count } = (
      await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "person_positions" pp
         JOIN "positions" t ON t.id = pp."positionsId"
         WHERE t.slug = ANY($1::text[])`,
        [obsolete],
      )
    )[0];
    console.log(`[TagCatalogLegacyPlurals] remapping done, dropping ${count} legacy tag assignments`);

    await queryRunner.query(
      `DELETE FROM "person_positions"
       WHERE "positionsId" IN (SELECT id FROM "positions" WHERE slug = ANY($1::text[]))`,
      [obsolete],
    );

    await queryRunner.query(`DELETE FROM "positions" WHERE slug = ANY($1::text[])`, [obsolete]);

    for (const rename of RENAMES) {
      await this.renameTo(queryRunner, rename.slug, rename.to);
    }
  }

  /**
   * Restaura els noms anteriors. Les etiquetes legacy absorbides no es reconstrueixen: la
   * gent ja viu a les definitives i no hi ha manera de saber qui portava quina.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const rename of RENAMES) {
      await this.renameTo(queryRunner, rename.slug, rename.from);
    }
  }

  /**
   * Allibera el nom si el té una altra etiqueta —feta a mà des del dashboard, per exemple—
   * abans d'aplicar-lo, perquè `positions.name` és únic i un xoc avortaria la migració.
   */
  private async renameTo(queryRunner: QueryRunner, slug: string, name: string): Promise<void> {
    // El driver de postgres torna `[rows, affectedRowCount]` per a una query amb RETURNING.
    const [renamedRows] = await queryRunner.query(
      `UPDATE "positions" SET name = name || ' (antiga)' WHERE name = $1 AND slug <> $2 RETURNING slug, name`,
      [name, slug],
    );
    for (const row of renamedRows as { slug: string; name: string }[]) {
      console.log(`[TagCatalogLegacyPlurals] renamed colliding tag slug=${row.slug} to name="${row.name}"`);
    }

    await queryRunner.query(`UPDATE "positions" SET name = $1 WHERE slug = $2`, [name, slug]);
  }
}
