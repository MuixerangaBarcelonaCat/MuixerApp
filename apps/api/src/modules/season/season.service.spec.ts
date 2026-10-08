import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SeasonService } from './season.service';
import { Season } from './season.entity';
import { Event } from '../event/event.entity';
import { EventType, SEASON_LEAVES_EVENTS_UNCOVERED } from '@muixer/shared';
import { getLocalToday } from '../../common/utils/date.util';

jest.mock('../../common/utils/date.util', () => ({
  ...jest.requireActual('../../common/utils/date.util'),
  getLocalToday: jest.fn(() => jest.requireActual('../../common/utils/date.util').getLocalToday()),
}));

describe('SeasonService', () => {
  let service: SeasonService;
  let repository: Record<string, jest.Mock>;
  let eventRepository: Record<string, jest.Mock>;
  let eventQb: ReturnType<typeof makeEventQb>;

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

  /** Query builder on the events table: per-season counts (`getRawMany`) and uncovered counts (`getCount`). */
  function makeEventQb(counts: { seasonId: string; eventType: EventType; count: string }[] = [], uncovered = 0) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(counts),
      getCount: jest.fn().mockResolvedValue(uncovered),
    };
  }

  const buildModule = async (qbFactory?: () => ReturnType<typeof makeQb>) => {
    const defaultQb = makeQb();
    eventQb = makeEventQb();
    eventRepository = {
      createQueryBuilder: jest.fn(() => eventQb),
    };
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
        { provide: getRepositoryToken(Event), useValue: eventRepository },
      ],
    }).compile();

    return module.get<SeasonService>(SeasonService);
  };

  describe('findAll', () => {
    it('returns list with the count of events whose date falls in each season', async () => {
      const seasons = [makeSeason('s1', 'Temporada 2024-2025'), makeSeason('s2', 'Buida')];
      const qb = makeQb(seasons);
      service = await buildModule(() => qb);
      eventQb.getRawMany.mockResolvedValue([{ seasonId: 's1', eventType: EventType.ASSAIG, count: '74' }]);
      const result = await service.findAll();
      expect(result.data[1].eventCount).toBe(0);
      expect(result.data[0].eventCount).toBe(74);
      expect(result.data[0].name).toBe('Temporada 2024-2025');
    });

    it('splits each season count into rehearsals and performances', async () => {
      const seasons = [makeSeason('s1', 'Temporada 2024-2025'), makeSeason('s2', 'Buida')];
      const qb = makeQb(seasons);
      service = await buildModule(() => qb);
      eventQb.getRawMany.mockResolvedValue([
        { seasonId: 's1', eventType: EventType.ASSAIG, count: '70' },
        { seasonId: 's1', eventType: EventType.ACTUACIO, count: '4' },
      ]);
      const result = await service.findAll();
      expect(result.data[0]).toMatchObject({ eventCount: 74, rehearsalCount: 70, performanceCount: 4 });
      expect(result.data[1]).toMatchObject({ eventCount: 0, rehearsalCount: 0, performanceCount: 0 });
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
      const season = makeSeason('s1', 'T1');
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      eventQb.getRawMany.mockResolvedValue([{ seasonId: 's1', eventType: EventType.ASSAIG, count: '3' }]);
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

    it("uses today's date in Europe/Madrid, not UTC", async () => {
      (getLocalToday as jest.Mock).mockReturnValueOnce('2026-09-06');
      const qb = makeQb(null);
      service = await buildModule(() => qb);
      await service.findCurrentEntity();
      expect(qb.where).toHaveBeenCalledWith(':today BETWEEN season.startDate AND season.endDate', {
        today: '2026-09-06',
      });
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
    const buildWithSeason = async (season: Season | null, eventsInRange = 0) => {
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      eventQb.getRawMany.mockResolvedValue(
        season ? [{ seasonId: season.id, eventType: EventType.ASSAIG, count: String(eventsInRange) }] : [],
      );
    };

    it('removes a season with 0 events', async () => {
      const season = makeSeason('s1', 'Empty');
      await buildWithSeason(season, 0);
      await expect(service.remove('s1')).resolves.toBeUndefined();
      expect(repository.remove).toHaveBeenCalledWith(season);
    });

    it('refuses to remove a season with events unless allowUncovered is set', async () => {
      await buildWithSeason(makeSeason('s1', 'Busy'), 5);
      const err = await service.remove('s1').catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({
        code: SEASON_LEAVES_EVENTS_UNCOVERED,
        uncoveredCount: 5,
        message: '5 esdeveniments quedarien fora de qualsevol temporada.',
      });
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('removes a season with events when allowUncovered is set', async () => {
      const season = makeSeason('s1', 'Busy');
      await buildWithSeason(season, 5);
      await expect(service.remove('s1', { allowUncovered: true })).resolves.toBeUndefined();
      expect(repository.remove).toHaveBeenCalledWith(season);
    });

    it('throws NotFoundException if season not found', async () => {
      await buildWithSeason(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update — events left without a season', () => {
    const existing = () =>
      makeSeason('s1', 'T1', {
        startDate: '2025-09-06' as unknown as Date,
        endDate: '2026-09-05' as unknown as Date,
      });

    const buildForUpdate = async (uncovered: number) => {
      service = await buildModule(() => {
        const qb = makeQb(null);
        qb.getOne = jest.fn().mockResolvedValue(null);
        return qb;
      });
      repository.findOne = jest.fn().mockResolvedValue(existing());
      eventQb.getCount.mockResolvedValue(uncovered);
      // 1st season query is the overlap (or name) check → none; later ones are findOne() reloading after save
      let call = 0;
      repository.createQueryBuilder = jest.fn(() => {
        call++;
        const qb = makeQb(null);
        qb.getOne = jest.fn().mockResolvedValue(call === 1 ? null : existing());
        return qb;
      });
    };

    it('counts events in the old range that fall outside the new range', async () => {
      await buildForUpdate(0);
      await service.update('s1', { startDate: '2025-09-10' });
      expect(eventQb.where).toHaveBeenCalledWith(
        'event.date BETWEEN :oldStart AND :oldEnd',
        { oldStart: '2025-09-06', oldEnd: '2026-09-05' },
      );
      expect(eventQb.andWhere).toHaveBeenCalledWith(
        'NOT (event.date BETWEEN :newStart AND :newEnd)',
        { newStart: '2025-09-10', newEnd: '2026-09-05' },
      );
    });

    it('refuses to shrink a season when events would be left out', async () => {
      await buildForUpdate(3);
      const err = await service.update('s1', { startDate: '2025-09-10' }).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code: SEASON_LEAVES_EVENTS_UNCOVERED, uncoveredCount: 3 });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('shrinks a season leaving events out when allowUncovered is set', async () => {
      await buildForUpdate(3);
      await service.update('s1', { startDate: '2025-09-10' }, { allowUncovered: true });
      expect(repository.save).toHaveBeenCalled();
    });

    it('does not check for uncovered events when dates are unchanged', async () => {
      await buildForUpdate(3);
      await service.update('s1', { name: 'Renamed' });
      expect(eventQb.getCount).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('exclusion-constraint race', () => {
    const exclusionViolation = Object.assign(new Error('conflicting key value violates exclusion constraint'), {
      code: '23P01',
    });

    it('maps a 23P01 on create to the overlap ConflictException', async () => {
      service = await buildModule(() => makeQb(null));
      repository.save = jest.fn().mockRejectedValue(exclusionViolation);
      await expect(
        service.create({ name: 'Race', startDate: '2026-09-01', endDate: '2027-09-01' }),
      ).rejects.toThrow(new ConflictException('Les dates se solapen amb una altra temporada'));
    });

    it('maps a 23P01 on update to the overlap ConflictException', async () => {
      service = await buildModule(() => makeQb(null));
      repository.findOne = jest.fn().mockResolvedValue(makeSeason('s1', 'T1'));
      repository.save = jest.fn().mockRejectedValue(exclusionViolation);
      await expect(service.update('s1', { endDate: '2027-01-01' }, { allowUncovered: true })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows other save errors untouched', async () => {
      service = await buildModule(() => makeQb(null));
      const boom = new Error('boom');
      repository.save = jest.fn().mockRejectedValue(boom);
      await expect(
        service.create({ name: 'X', startDate: '2026-09-01', endDate: '2027-09-01' }),
      ).rejects.toBe(boom);
    });
  });

  describe('countUncoveredEvents', () => {
    it('counts events whose date is in no season', async () => {
      service = await buildModule();
      eventQb.getCount.mockResolvedValue(7);
      await expect(service.countUncoveredEvents()).resolves.toEqual({ count: 7 });
      expect(eventQb.leftJoin).toHaveBeenCalledWith(
        Season,
        'season',
        'event.date BETWEEN season.startDate AND season.endDate',
      );
      expect(eventQb.where).toHaveBeenCalledWith('season.id IS NULL');
    });
  });

  describe('findByDate', () => {
    it('looks up the season whose inclusive range contains the date', async () => {
      const season = makeSeason('s1', 'T1');
      const qb = makeQb(season);
      qb.getOne = jest.fn().mockResolvedValue(season);
      service = await buildModule(() => qb);
      await expect(service.findByDate('2025-09-05')).resolves.toBe(season);
      expect(qb.where).toHaveBeenCalledWith(':date BETWEEN season.startDate AND season.endDate', {
        date: '2025-09-05',
      });
    });

    it('returns null when no season contains the date', async () => {
      service = await buildModule(() => makeQb(null));
      await expect(service.findByDate('2030-01-01')).resolves.toBeNull();
    });
  });
});
