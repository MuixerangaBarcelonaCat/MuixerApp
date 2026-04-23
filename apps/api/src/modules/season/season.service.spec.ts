import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SeasonService } from './season.service';
import { Season } from './season.entity';

describe('SeasonService', () => {
  let service: SeasonService;

  const makeSeason = (id: string, name: string, eventCount = 0): Season & { eventCount?: number } => ({
    id,
    name,
    startDate: new Date('2024-09-01'),
    endDate: new Date('2025-09-05'),
    description: null,
    legacyId: null,
    events: [],
    eventCount,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const makeQb = (seasons: (Season & { eventCount?: number })[]) => ({
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(seasons),
    getOne: jest.fn().mockResolvedValue(seasons[0] ?? null),
  });

  const buildModule = async (qb: ReturnType<typeof makeQb>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonService,
        {
          provide: getRepositoryToken(Season),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
      ],
    }).compile();
    return module.get<SeasonService>(SeasonService);
  };

  it('returns list with event count', async () => {
    const qb = makeQb([makeSeason('s1', 'Temporada 2024-2025', 74)]);
    service = await buildModule(qb);
    const result = await service.findAll();
    expect(result.data[0].eventCount).toBe(74);
    expect(result.data[0].name).toBe('Temporada 2024-2025');
  });

  it('returns total count', async () => {
    const qb = makeQb([makeSeason('s1', 'T1', 10), makeSeason('s2', 'T2', 5)]);
    service = await buildModule(qb);
    const result = await service.findAll();
    expect(result.total).toBe(2);
  });

  it('throws NotFoundException when season not found', async () => {
    const qb = makeQb([]);
    qb.getOne = jest.fn().mockResolvedValue(null);
    service = await buildModule(qb);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('does not expose legacyId in list item', async () => {
    const season = { ...makeSeason('s1', 'T1', 0), legacyId: '2025' };
    const qb = makeQb([season]);
    service = await buildModule(qb);
    const result = await service.findAll();
    expect((result.data[0] as unknown as Record<string, unknown>)['legacyId']).toBeUndefined();
  });
});
