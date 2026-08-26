import { Tag } from './tag.entity';
import { IntegrationDb, setupIntegrationDb, teardownIntegrationDb } from '../../test-integration/integration-db';

/**
 * Reverts migrations one at a time, from the current head, until `migrationName` itself has
 * been undone. Robust to any migration added after it — a hardcoded revert count silently
 * breaks the moment the migration history grows.
 */
async function undoMigrationsThrough(db: IntegrationDb, migrationName: string): Promise<void> {
  const maxAttempts = db.dataSource.migrations.length + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rows: { name: string }[] = await db.dataSource.query(
      `SELECT name FROM typeorm_migrations ORDER BY id DESC LIMIT 1`,
    );
    if (rows.length === 0) {
      throw new Error(
        `Reverted all migrations without finding "${migrationName}" — has it been renamed or removed?`,
      );
    }
    const head = rows[0].name;
    await db.dataSource.undoLastMigration();
    if (head === migrationName) return;
  }
  throw new Error(`Migration "${migrationName}" not reached after ${maxAttempts} reverts.`);
}

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
    // Revert one migration at a time until TagCategory itself has been undone — robust to any
    // migration added after it (rather than a hardcoded "two migrations back").
    await undoMigrationsThrough(db, 'TagCategory1784600000000');

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
