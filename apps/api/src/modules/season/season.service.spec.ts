import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SeasonService } from './season.service';
import { Season } from './season.entity';

describe('SeasonService', () => {
  let service: SeasonService;
  let repository: Record<string, jest.Mock>;

  const makeSeason = (
    id: string,
    name: string,
    overrides: Partial<Season & { eventCount?: number }> = {},
  ): Season & { eventCount?: number } => ({
    id,
    name,
    startDate: new Date('2024-09-01'),
    endDate: new Date('2025-09-05'),
    description: null,
    legacyId: null,
    events: [],
    eventCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const makeQb = (result: unknown = null) => ({
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
    getOne: jest.fn().mockResolvedValue(Array.isArray(result) ? result[0] ?? null : result),
  });

  const buildModule = async (qbFactory?: () => ReturnType<typeof makeQb>) => {
    const defaultQb = makeQb();
    repository = {
      createQueryBuilder: jest.fn(() => (qbFactory ? qbFactory() : defaultQb)),
      create: jest.fn((data) => ({ id: 'new-id', ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'new-id', ...entity })),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonService,
        { provide: getRepositoryToken(Season), useValue: repository },
      ],
    }).compile();

    return module.get<SeasonService>(SeasonService);
  };

  describe('findAll', () => {
    it('returns list with event count', async () => {
      const seasons = [makeSeason('s1', 'Temporada 2024-2025', { eventCount: 74 })];
      const qb = makeQb(seasons);
      service = await buildModule(() => qb);
      const result = await service.findAll();
      expect(result.data[0].eventCount).toBe(74);
      expect(result.data[0].name).toBe('Temporada 2024-2025');
    });

    it('returns total count', async () => {
      const seasons = [makeSeason('s1', 'T1', { eventCount: 10 }), makeSeason('s2', 'T2', { eventCount: 5 })];
      const qb = makeQb(seasons);
      service = await buildModule(() => qb);
      const result = await service.findAll();
      expect(result.total).toBe(2);
    });

    it('does not expose legacyId in list item', async () => {
      const seasons = [makeSeason('s1', 'T1', { legacyId: '2025' })];
      const qb = makeQb(seasons);
      service = await buildModule(() => qb);
      const result = await service.findAll();
      expect((result.data[0] as unknown as Record<string, unknown>)['legacyId']).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when season not found', async () => {
      const qb = makeQb(null);
      service = await buildModule(() => qb);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns season by id', async () => {
      const season = makeSeason('s1', 'T1', { eventCount: 3 });
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      const result = await service.findOne('s1');
      expect(result.id).toBe('s1');
      expect(result.eventCount).toBe(3);
    });
  });

  describe('findCurrent', () => {
    it('returns the season containing today', async () => {
      const today = new Date();
      const season = makeSeason('s1', 'Current', {
        startDate: new Date(today.getFullYear(), 0, 1),
        endDate: new Date(today.getFullYear(), 11, 31),
        eventCount: 5,
      });
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      const result = await service.findCurrent();
      expect(result.name).toBe('Current');
    });

    it('falls back to most recent season if none contains today', async () => {
      let callCount = 0;
      const fallbackSeason = makeSeason('s2', 'Recent');
      const qbFactory = () => {
        callCount++;
        if (callCount === 1) return makeQb(null);
        const qb = makeQb(fallbackSeason);
        qb.getOne = jest.fn().mockResolvedValue(fallbackSeason);
        return qb;
      };
      service = await buildModule(qbFactory);
      const result = await service.findCurrent();
      expect(result.name).toBe('Recent');
    });

    it('throws NotFoundException if no seasons exist', async () => {
      service = await buildModule(() => makeQb(null));
      await expect(service.findCurrent()).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a season successfully', async () => {
      const created = makeSeason('new-id', 'Nova temporada', { eventCount: 0 });
      let callCount = 0;
      const qbFactory = () => {
        callCount++;
        const qb = makeQb(null);
        if (callCount >= 3) {
          qb.getOne = jest.fn().mockResolvedValue(created);
        }
        return qb;
      };
      service = await buildModule(qbFactory);
      const result = await service.create({
        name: 'Nova temporada',
        startDate: '2026-09-01',
        endDate: '2027-09-01',
      });
      expect(result.name).toBe('Nova temporada');
      expect(repository.save).toHaveBeenCalled();
    });

    it('throws BadRequestException if endDate <= startDate', async () => {
      service = await buildModule();
      await expect(
        service.create({ name: 'Bad', startDate: '2026-09-01', endDate: '2026-08-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on name collision', async () => {
      const existing = makeSeason('s1', 'Existing');
      const qb = makeQb(existing);
      qb.getOne = jest.fn().mockResolvedValue(existing);
      service = await buildModule(() => qb);
      await expect(
        service.create({ name: 'Existing', startDate: '2026-09-01', endDate: '2027-09-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on date overlap', async () => {
      let callCount = 0;
      const overlapping = makeSeason('s1', 'Overlap');
      const qbFactory = () => {
        callCount++;
        if (callCount === 1) return makeQb(null); // name check
        const qb = makeQb(overlapping);
        qb.getOne = jest.fn().mockResolvedValue(overlapping);
        return qb;
      };
      service = await buildModule(qbFactory);
      await expect(
        service.create({ name: 'New', startDate: '2024-09-01', endDate: '2025-09-01' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates a season successfully', async () => {
      const existing = makeSeason('s1', 'Old Name', { eventCount: 0 });
      let callCount = 0;
      const qbFactory = () => {
        callCount++;
        const qb = makeQb(null);
        if (callCount >= 2) {
          const updated = makeSeason('s1', 'New Name', { eventCount: 0 });
          qb.getOne = jest.fn().mockResolvedValue(updated);
        }
        return qb;
      };
      service = await buildModule(qbFactory);
      repository.findOne = jest.fn().mockResolvedValue(existing);
      const result = await service.update('s1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('throws NotFoundException if season does not exist', async () => {
      service = await buildModule();
      repository.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes a season with 0 events', async () => {
      const season = makeSeason('s1', 'Empty', { eventCount: 0 });
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      await expect(service.remove('s1')).resolves.toBeUndefined();
      expect(repository.remove).toHaveBeenCalledWith(season);
    });

    it('throws ConflictException if season has events', async () => {
      const season = makeSeason('s1', 'Busy', { eventCount: 5 });
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      await expect(service.remove('s1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if season not found', async () => {
      const qb = makeQb(null);
      service = await buildModule(() => qb);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
