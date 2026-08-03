import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { LegalDocumentType } from '@muixer/shared';
import { LegalDocument } from './legal-document.entity';
import { LegalDocumentService } from './legal-document.service';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for invariants that only a live database enforces: the "one active
 * document per type" partial unique index (`UQ_legal_documents_active_per_type`), and that the
 * seed migration (`SeedLegalDocuments`) leaves exactly one active v1 row per type. Mocked-repository
 * unit tests (legal-document.service.spec.ts) cover the service logic but cannot catch a broken
 * SQL constraint or a migration that silently fails to seed.
 */
describe('LegalDocument invariants (integration)', () => {
  let db: IntegrationDb;
  let service: LegalDocumentService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalDocumentService,
        ...realRepositoryProviders(db.dataSource, [LegalDocument]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();
    service = module.get(LegalDocumentService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('the seed migration leaves exactly one active v1 document per type', async () => {
    const repo = db.dataSource.getRepository(LegalDocument);

    const privacyPolicy = await repo.findOne({
      where: { type: LegalDocumentType.PRIVACY_POLICY, isActive: true },
    });
    const transparencyClause = await repo.findOne({
      where: { type: LegalDocumentType.TRANSPARENCY_CLAUSE, isActive: true },
    });

    expect(privacyPolicy?.version).toBe(1);
    expect(transparencyClause?.version).toBe(1);
  });

  it('rejects a second active document of the same type at the database level', async () => {
    await expect(
      db.dataSource.query(
        `INSERT INTO "legal_documents" ("type", "version", "content", "isActive")
         VALUES ($1, $2, $3, true)`,
        [LegalDocumentType.PRIVACY_POLICY, 999, 'duplicate active'],
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('publish() increments the version and deactivates the previous active document, atomically', async () => {
    await truncateAllTables(db.dataSource);
    const repo = db.dataSource.getRepository(LegalDocument);
    await repo.save(
      repo.create({
        type: LegalDocumentType.PRIVACY_POLICY,
        version: 1,
        content: 'v1',
        isActive: true,
      }),
    );

    const published = await service.publish({
      type: LegalDocumentType.PRIVACY_POLICY,
      content: 'v2',
    });

    expect(published.version).toBe(2);
    expect(published.isActive).toBe(true);

    const all = await repo.find({ where: { type: LegalDocumentType.PRIVACY_POLICY } });
    expect(all).toHaveLength(2);
    expect(all.find((d) => d.version === 1)?.isActive).toBe(false);
    expect(all.filter((d) => d.isActive)).toHaveLength(1);
  });
});
