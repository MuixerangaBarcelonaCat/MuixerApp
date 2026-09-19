import { Test, TestingModule } from '@nestjs/testing';
import { CompositionService } from './composition.service';
import { Composition } from './entities/composition.entity';
import { CompositionEntry } from './entities/composition-entry.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres regression suite: `findAll`'s search filter used a plain `ILIKE` with no
 * `unaccent(...)`, unlike every other free-text search in the codebase (person/event/attendance/
 * user/figure-template) — a mocked-repository unit test can't catch a missing SQL function call.
 */
describe('CompositionService (integration)', () => {
  let db: IntegrationDb;
  let service: CompositionService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompositionService,
        ...realRepositoryProviders(db.dataSource, [Composition, CompositionEntry, FigureTemplate, FigureNode]),
      ],
    }).compile();

    service = module.get(CompositionService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  it('is accent-insensitive on the composition name (real unaccent extension)', async () => {
    await db.dataSource.getRepository(Composition).save({ name: 'Àliga vella' });

    const result = await service.findAll({ search: 'aliga' });

    expect(result.data.map((c) => c.name)).toContain('Àliga vella');
  });
});
