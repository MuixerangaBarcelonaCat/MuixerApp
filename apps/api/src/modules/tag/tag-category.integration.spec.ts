import { Tag } from './tag.entity';
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';

/**
 * Regression for the `category` backfill migration: existing rows (inserted before the column
 * existed) must all end up with a non-null category, classified the same way the migration's
 * own backfill logic does — pinya-only → PINYA, tronc-only → TRONC, empty/mixed → ALTRES.
 */
describe('Tag category migration (integration)', () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    // Revert the TagCategory migration to simulate the pre-migration schema, insert rows the
    // way legacy data would look (no category column yet), then re-run the migration so its
    // backfill logic runs against real pre-existing rows.
    // Dues migracions enrere: primer TagCatalog, després TagCategory (la que estem provant).
    await db.dataSource.undoLastMigration();
    await db.dataSource.undoLastMigration();

    await db.dataSource.query(
      `INSERT INTO "positions" (id, name, slug, "positionTypes") VALUES
        (gen_random_uuid(), 'Vent test', 'vent-test-category', ARRAY['vents']),
        (gen_random_uuid(), 'Segona test', 'segona-test-category', ARRAY['segona']),
        (gen_random_uuid(), 'Mixed test', 'mixed-test-category', ARRAY['segona','vents']),
        (gen_random_uuid(), 'Empty test', 'empty-test-category', ARRAY[]::text[])`,
    );

    await db.dataSource.runMigrations();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('backfills category with no nulls', async () => {
    const repo = db.dataSource.getRepository(Tag);
    const tags = await repo.find();

    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag.category).not.toBeNull();
    }
  });

  it('classifies a pinya-only tag as PINYA', async () => {
    const repo = db.dataSource.getRepository(Tag);
    const found = await repo.findOneByOrFail({ slug: 'vent-test-category' });
    expect(found.category).toBe('PINYA');
  });

  it('classifies a tronc-only tag as TRONC', async () => {
    const repo = db.dataSource.getRepository(Tag);
    const found = await repo.findOneByOrFail({ slug: 'segona-test-category' });
    expect(found.category).toBe('TRONC');
  });

  it('classifies a mixed tronc+pinya tag as ALTRES', async () => {
    const repo = db.dataSource.getRepository(Tag);
    const found = await repo.findOneByOrFail({ slug: 'mixed-test-category' });
    expect(found.category).toBe('ALTRES');
  });

  it('classifies an empty positionTypes tag as ALTRES', async () => {
    const repo = db.dataSource.getRepository(Tag);
    const found = await repo.findOneByOrFail({ slug: 'empty-test-category' });
    expect(found.category).toBe('ALTRES');
  });
});
