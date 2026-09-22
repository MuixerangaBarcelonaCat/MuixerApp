import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSource, NotificationTargetType } from '@muixer/shared';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationLogService } from './notification-log.service';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for NotificationLog: proves the `jsonb` target column and the enum `source`
 * column actually round-trip through real SQL, and that the migration-created table matches the
 * entity. The mocked-repository unit test (notification-log.service.spec.ts) never sends a real
 * INSERT, so it can't catch a jsonb/enum mismatch that only Postgres itself would reject.
 */
describe('NotificationLog (integration)', () => {
  let db: IntegrationDb;
  let service: NotificationLogService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationLogService, ...realRepositoryProviders(db.dataSource, [NotificationLog])],
    }).compile();
    service = module.get(NotificationLogService);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('persists an entry with jsonb target and reads it back intact', async () => {
    await service.record({
      title: 'Assaig',
      body: 'Dijous a les 20h',
      target: { type: NotificationTargetType.EVENT_ATTENDANCE, eventId: '11111111-1111-1111-1111-111111111111' },
      recipientCount: 8,
      source: NotificationSource.MANUAL,
      triggeredByUserId: '22222222-2222-2222-2222-222222222222',
    });

    const rows = await db.dataSource.getRepository(NotificationLog).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe(NotificationSource.MANUAL);
    expect(rows[0].target).toEqual({
      type: NotificationTargetType.EVENT_ATTENDANCE,
      eventId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('persists an entry with null optional fields', async () => {
    await service.record({
      title: 'Actuació',
      body: 'Dissabte a les 18h',
      target: { type: NotificationTargetType.ALL },
      recipientCount: 0,
      source: NotificationSource.MANUAL,
    });

    const rows = await db.dataSource.getRepository(NotificationLog).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBeNull();
    expect(rows[0].scheduleId).toBeNull();
    expect(rows[0].triggeredEventId).toBeNull();
    expect(rows[0].triggeredByUserId).toBeNull();
  });

  it('findAll paginates and orders by sentAt descending', async () => {
    for (const title of ['First', 'Second', 'Third']) {
      await service.record({
        title,
        body: 'Body',
        target: { type: NotificationTargetType.ALL },
        recipientCount: 1,
        source: NotificationSource.MANUAL,
      });
    }

    const result = await service.findAll({ page: 1, limit: 2 });

    expect(result.meta).toEqual({ total: 3, page: 1, limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].title).toBe('Third');
  });
});
