import { Tag } from './tag.entity';
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';
import { undoMigrationsThrough } from '../../test-integration/undo-migrations';

/**
 * Les colles que van importar de l'app legacy tenen les etiquetes amb els slugs en plural
 * (`primeres`, `vents`, `contraforts`…), que la migració del catàleg no reconeixia. Aquesta
 * migració les absorbeix i, tot seguit, renombra el catàleg amb els noms que fa servir
 * l'equip tècnic. L'ordre importa: «Contraforts» i «Crosses» són alhora el nom nou d'una
 * etiqueta del catàleg i el nom actual d'una etiqueta legacy, i `positions.name` és únic.
 */
describe('Tag catalog legacy plurals migration (integration)', () => {
  let db: IntegrationDb;
  let personId: string;
  let soloLateralPersonId: string;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    await undoMigrationsThrough(db, 'TagCatalogLegacyPlurals1784800000000');

    await db.dataSource.query(
      `INSERT INTO "positions" (id, name, slug, "positionTypes", category) VALUES
        (gen_random_uuid(), 'Primeres',        'primeres',        ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Vents',           'vents',           ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Laterals',        'laterals',        ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Segons Laterals', 'segons-laterals', ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Contraforts',     'contraforts',     ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Crosses',         'crosses',         ARRAY[]::text[], 'ALTRES')`,
    );

    const [person] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias) VALUES ('Test', 'Plurals', '~plurals')
       RETURNING id`,
    );
    personId = person.id;

    // Aquesta persona porta les dues laterals alhora: han de col·lapsar en una sola.
    await db.dataSource.query(
      `INSERT INTO "person_positions" ("personsId", "positionsId")
       SELECT $1, id FROM "positions"
       WHERE slug IN ('primeres', 'vents', 'laterals', 'segons-laterals', 'contraforts', 'crosses')`,
      [personId],
    );

    const [soloLateral] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias) VALUES ('Sols', 'Lateral', '~sols-lat')
       RETURNING id`,
    );
    soloLateralPersonId = soloLateral.id;

    await db.dataSource.query(
      `INSERT INTO "person_positions" ("personsId", "positionsId")
       SELECT $1, id FROM "positions" WHERE slug = 'segons-laterals'`,
      [soloLateralPersonId],
    );

    await db.dataSource.runMigrations();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  const slugsOf = async (id: string): Promise<string[]> => {
    const rows: { slug: string }[] = await db.dataSource.query(
      `SELECT t.slug FROM "person_positions" pp
       JOIN "positions" t ON t.id = pp."positionsId"
       WHERE pp."personsId" = $1
       ORDER BY t.slug`,
      [id],
    );
    return rows.map((row) => row.slug);
  };

  it('esborra les etiquetes legacy en plural', async () => {
    const repo = db.dataSource.getRepository(Tag);

    for (const slug of ['primeres', 'vents', 'laterals', 'segons-laterals', 'contraforts', 'crosses']) {
      expect(await repo.findOneBy({ slug })).toBeNull();
    }
  });

  it('mou cada persona a l\'etiqueta definitiva equivalent', async () => {
    expect(await slugsOf(personId)).toEqual(['contrafort', 'crossa', 'lateral', 'mans', 'vent']);
  });

  it('col·lapsa laterals i segons-laterals en una sola etiqueta', async () => {
    const slugs = await slugsOf(personId);
    expect(slugs.filter((slug) => slug === 'lateral')).toHaveLength(1);
  });

  it('remapa segons-laterals encara que la persona no tinga laterals', async () => {
    expect(await slugsOf(soloLateralPersonId)).toEqual(['lateral']);
  });

  it('renombra el catàleg amb els noms de l\'equip tècnic', async () => {
    const repo = db.dataSource.getRepository(Tag);
    const nameOf = async (slug: string): Promise<string> =>
      (await repo.findOneByOrFail({ slug })).name;

    expect(await nameOf('mans')).toBe('1es Mans');
    expect(await nameOf('vent')).toBe('1es Vents');
    expect(await nameOf('lateral')).toBe('Laterals / Diagonals');
    expect(await nameOf('contrafort')).toBe('Contraforts');
    expect(await nameOf('crossa')).toBe('Crosses');
    expect(await nameOf('persona-nova')).toBe('Persones Noves');
    expect(await nameOf('sense-tronc')).toBe('No troncs');
    expect(await nameOf('xiquets-colla')).toBe('Xiquets/es de la colla');
  });

  it('deixa intactes els noms que ja eren els acordats', async () => {
    const repo = db.dataSource.getRepository(Tag);

    expect((await repo.findOneByOrFail({ slug: 'segon-cordo' })).name).toBe('Segon Cordó');
    expect((await repo.findOneByOrFail({ slug: 'xicalla' })).name).toBe('Xicalla');
    expect((await repo.findOneByOrFail({ slug: 'fem-pinya' })).name).toBe('Fem Pinya');
  });

  it('no toca els grups ni els positionTypes del catàleg', async () => {
    const repo = db.dataSource.getRepository(Tag);

    const mans = await repo.findOneByOrFail({ slug: 'mans' });
    expect(mans.category).toBe('PINYA');
    expect(mans.positionTypes).toEqual(['mans']);

    const baix = await repo.findOneByOrFail({ slug: 'baix' });
    expect(baix.category).toBe('TRONC');
    expect(baix.positionTypes).toEqual(['base']);
  });
});
