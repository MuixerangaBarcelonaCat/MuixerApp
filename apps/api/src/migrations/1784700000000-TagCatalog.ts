import { MigrationInterface, QueryRunner } from 'typeorm';

interface CatalogTag {
  slug: string;
  name: string;
  category: 'PINYA' | 'TRONC' | 'XICALLA' | 'ALTRES';
  positionTypes: string[];
  color: string;
}

/** Catàleg definitiu acordat amb l'equip tècnic (2026-08). Noms en singular: descriuen una persona. */
const CATALOG: CatalogTag[] = [
  { slug: 'mans',            name: 'Mans',                 category: 'PINYA',   positionTypes: ['mans'],           color: '#FFE082' },
  { slug: 'vent',            name: 'Vent',                 category: 'PINYA',   positionTypes: ['vents'],          color: '#A5D6A7' },
  { slug: 'segon-cordo',     name: 'Segon Cordó',          category: 'PINYA',   positionTypes: ['mans', 'vents'],  color: '#00897B' },
  { slug: 'lateral',         name: 'Lateral',              category: 'PINYA',   positionTypes: ['laterals'],       color: '#80DEEA' },
  { slug: 'agulla',          name: 'Agulla',               category: 'PINYA',   positionTypes: ['agulla'],         color: '#0D9488' },
  { slug: 'contrafort',      name: 'Contrafort',           category: 'PINYA',   positionTypes: ['contrafort'],     color: '#EF9A9A' },
  { slug: 'crossa',          name: 'Crossa',               category: 'PINYA',   positionTypes: ['crossa'],         color: '#9FA8DA' },
  { slug: 'tap',             name: 'Tap',                  category: 'PINYA',   positionTypes: ['tap'],            color: '#BE185D' },
  { slug: 'cordo-obert',     name: 'Cordó Obert',          category: 'PINYA',   positionTypes: ['cordo-obert'],    color: '#FFF9C4' },
  { slug: 'persona-nova',    name: 'Persona Nova',         category: 'PINYA',   positionTypes: [],                 color: '#5C6BC0' },
  { slug: 'baix',            name: 'Baix',                 category: 'TRONC',   positionTypes: ['base'],           color: '#64748B' },
  { slug: 'segona',          name: 'Segona',               category: 'TRONC',   positionTypes: ['segona'],         color: '#1E88E5' },
  { slug: 'terca',           name: 'Terça',                category: 'TRONC',   positionTypes: ['terça'],          color: '#43A047' },
  { slug: 'alcadora',        name: 'Alçadora',             category: 'TRONC',   positionTypes: ['alçadora'],       color: '#00ACC1' },
  { slug: 'figures-netes',   name: 'Figures Netes (SP)',   category: 'TRONC',   positionTypes: [],                 color: '#8E24AA' },
  { slug: 'sense-tronc',     name: 'Sense Tronc',          category: 'TRONC',   positionTypes: [],                 color: '#9E9E9E' },
  { slug: 'xicalla',         name: 'Xicalla',              category: 'XICALLA', positionTypes: [],                 color: '#FFB300' },
  { slug: 'xiquets-colla',   name: 'Xiquet/a de la Colla', category: 'XICALLA', positionTypes: [],                 color: '#FF7043' },
  { slug: 'acompanyant',     name: 'Acompanyant',          category: 'ALTRES',  positionTypes: [],                 color: '#78909C' },
  { slug: 'fem-pinya',       name: 'Fem Pinya',            category: 'ALTRES',  positionTypes: [],                 color: '#7CB342' },
  { slug: 'imatge-paradeta', name: 'Imatge i Paradeta',    category: 'ALTRES',  positionTypes: [],                 color: '#EC407A' },
];

/** Etiqueta legacy → etiqueta definitiva. Les que ja comparteixen slug s'actualitzen en el lloc. */
const REMAP: Record<string, string> = {
  'segon-lateral': 'lateral',
  novatos: 'persona-nova',
  acompanyants: 'acompanyant',
  'nens-colla': 'xiquets-colla',
};

/** Etiquetes legacy que desapareixen sense substituta. */
const DISCARD = ['altres'];

export class TagCatalog1784700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tag of CATALOG) {
      // `name` is unique too: free the name if a hand-made tag under another slug holds it,
      // otherwise the upsert below aborts the whole migration with a 23505.
      await queryRunner.query(
        `UPDATE "positions" SET name = name || ' (antiga)' WHERE name = $1 AND slug <> $2`,
        [tag.name, tag.slug],
      );

      await queryRunner.query(
        `INSERT INTO "positions" (name, slug, "positionTypes", color, category)
         VALUES ($1, $2, $3::text[], $4, $5)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               "positionTypes" = EXCLUDED."positionTypes",
               color = EXCLUDED.color,
               category = EXCLUDED.category`,
        [tag.name, tag.slug, tag.positionTypes, tag.color, tag.category],
      );
    }

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

    const obsolete = [...Object.keys(REMAP), ...DISCARD];
    const { count } = (
      await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "person_positions" pp
         JOIN "positions" t ON t.id = pp."positionsId"
         WHERE t.slug = ANY($1::text[])`,
        [obsolete],
      )
    )[0];
    console.log(`[TagCatalog] remapping done, dropping ${count} legacy tag assignments`);

    await queryRunner.query(
      `DELETE FROM "person_positions"
       WHERE "positionsId" IN (SELECT id FROM "positions" WHERE slug = ANY($1::text[]))`,
      [obsolete],
    );

    await queryRunner.query(`DELETE FROM "positions" WHERE slug = ANY($1::text[])`, [obsolete]);
  }

  /**
   * Irreversible per disseny: el catàleg legacy no es pot reconstruir. El `down` només lleva
   * les etiquetes noves que no tenen cap persona assignada, per no perdre dades introduïdes
   * després de la migració. Cal còpia de seguretat abans d'executar-la en producció.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "positions" t
       WHERE t.slug = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM "person_positions" pp WHERE pp."positionsId" = t.id)`,
      [CATALOG.map((tag) => tag.slug)],
    );
  }
}
