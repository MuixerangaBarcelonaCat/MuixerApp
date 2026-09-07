// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
} from '../test-integration/integration-db';

/**
 * After the full migration run, the seeded «Tècnica» tag points at all three direction
 * flavours — `1784900000000-AddTecnicaTag` seeds tronc + xicalla, `1785200000000` adds pinya.
 */
describe('AddDireccioPinyaToTecnicaTag (integration)', () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();
  }, 180_000);

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('adds direccio-pinya to the Tècnica tag positionTypes, without duplicating the others', async () => {
    const [tag]: { positionTypes: string[] }[] = await db.dataSource.query(
      `SELECT "positionTypes" FROM "positions" WHERE "slug" = 'tecnica'`,
    );
    expect([...tag.positionTypes].sort()).toEqual(
      ['direccio-pinya', 'direccio-tronc', 'direccio-xicalla'],
    );
  });
});
