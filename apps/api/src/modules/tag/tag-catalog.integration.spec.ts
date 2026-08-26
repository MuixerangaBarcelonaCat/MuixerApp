import { Tag } from './tag.entity';
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';

/**
 * La migració del catàleg definitiu ha de: crear les etiquetes acordades amb la tècnica,
 * remapar les assignacions de les etiquetes legacy a les definitives i esborrar les legacy
 * que queden sense enllaços.
 */
describe('Tag catalog migration (integration)', () => {
  let db: IntegrationDb;
  let personId: string;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    // Torna a l'estat previ a la migració del catàleg i sembra dades com les de l'import legacy.
    await db.dataSource.undoLastMigration();

    await db.dataSource.query(
      `INSERT INTO "positions" (id, name, slug, "positionTypes", category) VALUES
        (gen_random_uuid(), 'Segon Lateral', 'segon-lateral', ARRAY['laterals'], 'PINYA'),
        (gen_random_uuid(), 'Lateral', 'lateral', ARRAY['laterals'], 'PINYA'),
        (gen_random_uuid(), 'Novatos', 'novatos', ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Altres', 'altres', ARRAY[]::text[], 'ALTRES'),
        (gen_random_uuid(), 'Tap', 'tap-manual', ARRAY['tap'], 'PINYA')`,
    );

    const [person] = await db.dataSource.query(
      `INSERT INTO "persons" (name, "firstSurname", alias) VALUES ('Test', 'Catalog', '~cataleg')
       RETURNING id`,
    );
    personId = person.id;

    await db.dataSource.query(
      `INSERT INTO "person_positions" ("personsId", "positionsId")
       SELECT $1, id FROM "positions" WHERE slug IN ('segon-lateral', 'lateral', 'novatos', 'altres')`,
      [personId],
    );

    await db.dataSource.runMigrations();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('crea les etiquetes del catàleg amb el seu grup', async () => {
    const repo = db.dataSource.getRepository(Tag);

    const segonCordo = await repo.findOneByOrFail({ slug: 'segon-cordo' });
    expect(segonCordo.name).toBe('Segon Cordó');
    expect(segonCordo.category).toBe('PINYA');
    expect(segonCordo.positionTypes.sort()).toEqual(['mans', 'vents']);

    const xiquets = await repo.findOneByOrFail({ slug: 'xiquets-colla' });
    expect(xiquets.category).toBe('XICALLA');

    const baix = await repo.findOneByOrFail({ slug: 'baix' });
    expect(baix.positionTypes).toEqual(['base']);
  });

  it('remapa segon-lateral i lateral a una sola Lateral, sense duplicats', async () => {
    const rows = await db.dataSource.query(
      `SELECT t.slug FROM "person_positions" pp
       JOIN "positions" t ON t.id = pp."positionsId"
       WHERE pp."personsId" = $1 AND t.slug = 'lateral'`,
      [personId],
    );
    expect(rows).toHaveLength(1);
  });

  it('remapa novatos a persona-nova', async () => {
    const rows = await db.dataSource.query(
      `SELECT t.slug FROM "person_positions" pp
       JOIN "positions" t ON t.id = pp."positionsId"
       WHERE pp."personsId" = $1 AND t.slug = 'persona-nova'`,
      [personId],
    );
    expect(rows).toHaveLength(1);
  });

  it('descarta l\'etiqueta legacy altres i esborra les legacy òrfenes', async () => {
    const repo = db.dataSource.getRepository(Tag);
    expect(await repo.findOneBy({ slug: 'altres' })).toBeNull();
    expect(await repo.findOneBy({ slug: 'segon-lateral' })).toBeNull();
    expect(await repo.findOneBy({ slug: 'novatos' })).toBeNull();
  });

  it('allibera el nom d\'una etiqueta feta a mà que xocaria amb el catàleg', async () => {
    const repo = db.dataSource.getRepository(Tag);

    expect((await repo.findOneByOrFail({ slug: 'tap-manual' })).name).toBe('Tap (antiga)');
    expect((await repo.findOneByOrFail({ slug: 'tap' })).name).toBe('Tap');
  });
});
