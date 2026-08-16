import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { NewsService } from './news.service';
import { News } from './news.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the published-news visibility rule: `NULL <= now()` is falsy in SQL,
 * so a mocked repository (which would happily return whatever a test hands it) can't prove drafts
 * and future-scheduled news items are actually excluded — only a real query against real rows can.
 */
describe('NewsService published-news visibility (integration)', () => {
  let db: IntegrationDb;
  let service: NewsService;
  let newsRepo: Repository<News>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [NewsService, ...realRepositoryProviders(db.dataSource, [News])],
    }).compile();

    service = module.get(NewsService);
    newsRepo = db.dataSource.getRepository(News);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const HOUR = 60 * 60 * 1000;

  describe('findPublished', () => {
    it('excludes draft news items (publishedAt null)', async () => {
      await newsRepo.save(newsRepo.create({ title: 'Draft', body: 'x', publishedAt: null }));

      const result = await service.findPublished();

      expect(result).toHaveLength(0);
    });

    it('excludes news items scheduled in the future', async () => {
      await newsRepo.save(
        newsRepo.create({ title: 'Future', body: 'x', publishedAt: new Date(Date.now() + HOUR) }),
      );

      const result = await service.findPublished();

      expect(result).toHaveLength(0);
    });

    it('includes news items published in the past, ordered by publishedAt desc', async () => {
      const older = await newsRepo.save(
        newsRepo.create({ title: 'Older', body: 'x', publishedAt: new Date(Date.now() - 2 * HOUR) }),
      );
      const newer = await newsRepo.save(
        newsRepo.create({ title: 'Newer', body: 'x', publishedAt: new Date(Date.now() - HOUR) }),
      );

      const result = await service.findPublished();

      expect(result.map((a) => a.id)).toEqual([newer.id, older.id]);
    });
  });

  describe('findPublishedOne', () => {
    it('returns a published news', async () => {
      const news = await newsRepo.save(
        newsRepo.create({ title: 'Published', body: 'x', publishedAt: new Date(Date.now() - HOUR) }),
      );

      const result = await service.findPublishedOne(news.id);

      expect(result.id).toBe(news.id);
    });

    it('throws for a draft news', async () => {
      const news = await newsRepo.save(newsRepo.create({ title: 'Draft', body: 'x', publishedAt: null }));

      await expect(service.findPublishedOne(news.id)).rejects.toThrow();
    });

    it('throws for a scheduled (future) news', async () => {
      const news = await newsRepo.save(
        newsRepo.create({ title: 'Future', body: 'x', publishedAt: new Date(Date.now() + HOUR) }),
      );

      await expect(service.findPublishedOne(news.id)).rejects.toThrow();
    });
  });
});
