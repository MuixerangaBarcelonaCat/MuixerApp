import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { News } from './news.entity';
import { NewsService } from './news.service';

const NEWS_ID = 'news-uuid-1';

const makeNews = (overrides: Partial<News> = {}): Partial<News> => ({
  id: NEWS_ID,
  title: 'Nova temporada',
  body: 'Cos en **markdown**',
  publishedAt: null,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => ({ ...data, id: NEWS_ID })),
  save: jest.fn(),
  delete: jest.fn(),
};

describe('NewsService', () => {
  let service: NewsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.create.mockImplementation((data: Record<string, unknown>) => ({ ...data, id: NEWS_ID }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getRepositoryToken(News), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
  });

  describe('findAll', () => {
    it('returns every news ordered by publishedAt desc', async () => {
      const news = makeNews();
      mockRepo.find.mockResolvedValue([news]);

      const result = await service.findAll();

      expect(result).toEqual([news]);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { publishedAt: 'DESC' } });
    });
  });

  describe('findOne', () => {
    it('returns news by ID', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews());
      const result = await service.findOne(NEWS_ID);
      expect(result.id).toBe(NEWS_ID);
    });

    it('throws NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('stores publishedAt as null when omitted (draft)', async () => {
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create({ title: 'Draft', body: 'x' });

      expect(result.publishedAt).toBeNull();
    });

    it('parses a provided publishedAt into a Date', async () => {
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.create({ title: 'Now', body: 'x', publishedAt: '2026-01-01T00:00:00.000Z' });

      expect(result.publishedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    });
  });

  describe('update', () => {
    it('throws NotFoundException if news does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-id', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates fields and returns the refreshed entity', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews());
      mockRepo.save.mockResolvedValue(undefined);

      const result = await service.update(NEWS_ID, { title: 'Updated' });

      expect(result.title).toBe('Nova temporada');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('clears publishedAt back to draft when explicitly set to null', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews({ publishedAt: new Date('2026-01-01') }));
      mockRepo.save.mockResolvedValue(undefined);

      await service.update(NEWS_ID, { publishedAt: null });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ publishedAt: null }),
      );
    });

    it('leaves publishedAt untouched when the field is omitted from the update', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews());
      mockRepo.save.mockResolvedValue(undefined);

      await service.update(NEWS_ID, { title: 'Just a title change' });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ publishedAt: expect.anything() }),
      );
    });
  });

  describe('remove', () => {
    it('deletes an existing news', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews());
      mockRepo.delete.mockResolvedValue({});

      await service.remove(NEWS_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(NEWS_ID);
    });

    it('throws NotFoundException if news does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPublished', () => {
    it('queries published news items ordered by publishedAt desc', async () => {
      const news = makeNews({ publishedAt: new Date('2026-01-01') });
      mockRepo.find.mockResolvedValue([news]);

      const result = await service.findPublished();

      expect(result).toEqual([news]);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { publishedAt: 'DESC' } }),
      );
    });
  });

  describe('findPublishedOne', () => {
    it('returns the news when published in the past', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews({ publishedAt: new Date(Date.now() - 1000) }));
      const result = await service.findPublishedOne(NEWS_ID);
      expect(result.id).toBe(NEWS_ID);
    });

    it('throws NotFoundException for a draft news', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews({ publishedAt: null }));
      await expect(service.findPublishedOne(NEWS_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a news item scheduled in the future', async () => {
      mockRepo.findOne.mockResolvedValue(makeNews({ publishedAt: new Date(Date.now() + 60 * 60 * 1000) }));
      await expect(service.findPublishedOne(NEWS_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
