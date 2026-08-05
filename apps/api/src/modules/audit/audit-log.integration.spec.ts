import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction } from '@muixer/shared';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for AuditLog: proves the `jsonb` metadata column and the enum column
 * actually round-trip through real SQL. The mocked-repository unit test (audit.service.spec.ts)
 * exercises the service logic but never sends a real INSERT, so it can't catch a jsonb/enum
 * mismatch that only Postgres itself would reject.
 */
describe('AuditLog (integration)', () => {
  let db: IntegrationDb;
  let service: AuditService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, ...realRepositoryProviders(db.dataSource, [AuditLog])],
    }).compile();
    service = module.get(AuditService);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('persists an entry with jsonb metadata and reads it back intact', async () => {
    await service.record({
      actorUserId: '11111111-1111-1111-1111-111111111111',
      action: AuditAction.CONSENT_ACCEPTED,
      targetType: 'User',
      targetId: '11111111-1111-1111-1111-111111111111',
      metadata: { privacyPolicyVersion: 3 },
      ipAddress: '203.0.113.5',
    });

    const rows = await db.dataSource.getRepository(AuditLog).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe(AuditAction.CONSENT_ACCEPTED);
    expect(rows[0].metadata).toEqual({ privacyPolicyVersion: 3 });
  });

  it('persists an entry with null optional fields', async () => {
    await service.record({ action: AuditAction.SENSITIVE_DATA_ACCESS });

    const rows = await db.dataSource.getRepository(AuditLog).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].actorUserId).toBeNull();
    expect(rows[0].metadata).toBeNull();
  });
});
