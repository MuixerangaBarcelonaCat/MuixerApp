import { Test } from '@nestjs/testing';
import { AuditAction, DEFAULT_COLLA_SETTINGS, TagCategory } from '@muixer/shared';
import { AuditService } from '../audit/audit.service';
import { AuditLog } from '../audit/audit-log.entity';
import { Tag } from '../tag/tag.entity';
import {
  IntegrationDb,
  realRepositoryProviders,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
} from '../../test-integration/integration-db';
import { CollaSettingsEntity } from './colla-settings.entity';
import { CollaSettingsService } from './colla-settings.service';

/**
 * Real-Postgres checks the unit spec can't make: the service stores its defaults again after the
 * row is wiped, its writes satisfy the table's constraints, and the audit row really lands
 * (the audit enum value comes from a migration).
 */
describe('CollaSettingsService (integration)', () => {
  let db: IntegrationDb;
  const actor = { userId: '3f2b6a1e-8c4d-4e5f-9a0b-1c2d3e4f5a6b', ipAddress: '10.0.0.1' };

  // A fresh service per test: its cache would otherwise outlive the truncation.
  const newService = async () =>
    (
      await Test.createTestingModule({
        providers: [
          CollaSettingsService,
          AuditService,
          ...realRepositoryProviders(db.dataSource, [CollaSettingsEntity, Tag, AuditLog]),
        ],
      }).compile()
    ).get(CollaSettingsService);

  beforeAll(async () => {
    db = await setupIntegrationDb();
  }, 180_000);

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('reads the row the migration seeded', async () => {
    const settings = await (await newService()).get();

    expect({ ...settings, defaultTagId: null }).toEqual(DEFAULT_COLLA_SETTINGS);
    expect(settings.defaultTagId).not.toBeNull();
  });

  it('stores the defaults again when the row has been wiped', async () => {
    await truncateAllTables(db.dataSource);

    expect(await (await newService()).get()).toEqual(DEFAULT_COLLA_SETTINGS);
    expect(await db.dataSource.getRepository(CollaSettingsEntity).count()).toBe(1);
  });

  it('persists an update and audits it', async () => {
    await truncateAllTables(db.dataSource);
    const tag = await db.dataSource
      .getRepository(Tag)
      .save({ name: 'Nova', slug: 'nova', category: TagCategory.ALTRES, positionTypes: [] });

    await (await newService()).update({ majorityAge: 18, defaultTagId: tag.id }, actor);

    expect(await (await newService()).get()).toMatchObject({ majorityAge: 18, defaultTagId: tag.id });
    const [log] = await db.dataSource.getRepository(AuditLog).find();
    expect(log).toMatchObject({
      action: AuditAction.COLLA_SETTINGS_UPDATED,
      actorUserId: actor.userId,
      metadata: { changes: { majorityAge: { from: 16, to: 18 }, defaultTagId: { from: null, to: tag.id } } },
    });
  });
});
