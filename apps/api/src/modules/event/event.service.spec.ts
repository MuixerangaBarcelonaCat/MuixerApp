import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';
import { Event } from './event.entity';
import { Attendance } from './attendance.entity';
import { Season } from '../season/season.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from './attendance.service';
import { EventType } from '@muixer/shared';

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'evt-uuid',
  eventType: EventType.ASSAIG,
  title: 'ASSAIG GENERAL',
  date: new Date('2026-03-26'),
  startTime: '18:45',
  location: 'Local',
  locationUrl: null,
  description: null,
  information: null,
  notes: null,
  countsForStatistics: true,
  metadata: {},
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 69, lateCancel: 0, children: 11, childrenAttended: 0, total: 80 },
  legacyId: '1',
  legacyType: 'assaig',
  lastSyncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  attendances: [],
  ...overrides,
} as Event);

const SEASON_2526 = { id: 's1', name: 'Temporada 2025-2026' } as Season;

describe('EventService', () => {
  let service: EventService;
  let eventQb: Record<string, jest.Mock>;

  const mockAttendanceRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  /** Live pending counts: nobody pending unless a test says otherwise. */
  const mockAttendanceService = {
    livePendingCounts: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, 0]))),
  };

  /** Every date falls in «Temporada 2025-2026» unless a test says otherwise. */
  const mockSeasonService = {
    findByDate: jest.fn(),
  };

  const segmentQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const mockSegmentRepo = {
    createQueryBuilder: jest.fn(() => segmentQb),
  };

  /** Builds an EventService whose event repository is `eventRepo`; everything else uses the shared mocks. */
  const makeService = async (eventRepo: Record<string, jest.Mock>): Promise<EventService> => {
    const mod = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
        { provide: SeasonService, useValue: mockSeasonService },
        { provide: AttendanceService, useValue: mockAttendanceService },
      ],
    }).compile();
    return mod.get<EventService>(EventService);
  };

  beforeEach(async () => {
    eventQb = {
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    jest.clearAllMocks();
    mockSeasonService.findByDate.mockResolvedValue(SEASON_2526);
    mockSegmentRepo.createQueryBuilder.mockReturnValue(segmentQb);
    segmentQb.leftJoinAndSelect.mockReturnThis();
    segmentQb.where.mockReturnThis();
    segmentQb.orderBy.mockReturnThis();
    segmentQb.addOrderBy.mockReturnThis();
    segmentQb.getMany.mockResolvedValue([]);

    service = await makeService({
      createQueryBuilder: jest.fn(() => eventQb),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    });
  });

  describe('live pending count', () => {
    const stored = { confirmed: 5, declined: 1, pending: 2, attended: 0, lateCancel: 0, children: 0, childrenAttended: 0, total: 8 };

    it('lays the live pending count over each listed summary and adjusts total', async () => {
      eventQb.getCount.mockResolvedValue(1);
      eventQb.getMany.mockResolvedValue([makeEvent({ attendanceSummary: stored })]);
      mockAttendanceService.livePendingCounts.mockResolvedValueOnce(new Map([['evt-uuid', 10]]));

      const result = await service.findAll({});

      expect(mockAttendanceService.livePendingCounts).toHaveBeenCalledWith(['evt-uuid']);
      expect(result.data[0].attendanceSummary).toEqual(expect.objectContaining({ pending: 10, total: 16, confirmed: 5 }));
    });

    it('lays the live pending count over the detail summary', async () => {
      const svc = await makeService({ findOne: jest.fn().mockResolvedValue(makeEvent({ attendanceSummary: stored })) });
      mockAttendanceService.livePendingCounts.mockResolvedValueOnce(new Map([['evt-uuid', 3]]));

      const detail = await svc.findOne('evt-uuid');

      expect(detail.attendanceSummary).toEqual(expect.objectContaining({ pending: 3, total: 9 }));
    });
  });

  describe('findAll', () => {
    it('returns paginated empty list', async () => {
      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies eventType filter', async () => {
      eventQb.getCount.mockResolvedValue(1);
      eventQb.getMany.mockResolvedValue([makeEvent()]);

      await service.findAll({ eventType: EventType.ASSAIG });

      expect(eventQb.andWhere).toHaveBeenCalledWith(
        'event.eventType = :eventType',
        { eventType: EventType.ASSAIG },
      );
    });

    it('joins each event to the season whose date range contains its date', async () => {
      await service.findAll({});
      expect(eventQb.leftJoinAndMapOne).toHaveBeenCalledWith(
        'event.season',
        Season,
        'season',
        'event.date BETWEEN season.startDate AND season.endDate',
      );
    });

    it('returns the date-derived season on each list item, or null when the date is in no season', async () => {
      eventQb.getCount.mockResolvedValue(2);
      eventQb.getMany.mockResolvedValue([
        Object.assign(makeEvent({ id: 'a' }), { season: SEASON_2526 }),
        Object.assign(makeEvent({ id: 'b' }), { season: null }),
      ]);
      const { data } = await service.findAll({});
      expect(data.map((e) => e.season)).toEqual([{ id: 's1', name: 'Temporada 2025-2026' }, null]);
    });

    it('applies seasonId filter on the date-joined season', async () => {
      await service.findAll({ seasonId: 's1' });
      expect(eventQb.andWhere).toHaveBeenCalledWith('season.id = :seasonId', { seasonId: 's1' });
    });

    it('applies dateFrom filter', async () => {
      await service.findAll({ dateFrom: '2026-01-01' });
      expect(eventQb.andWhere).toHaveBeenCalledWith('event.date >= :dateFrom', { dateFrom: '2026-01-01' });
    });

    it('applies dateTo filter', async () => {
      await service.findAll({ dateTo: '2026-12-31' });
      expect(eventQb.andWhere).toHaveBeenCalledWith('event.date <= :dateTo', { dateTo: '2026-12-31' });
    });

    it('applies search filter', async () => {
      await service.findAll({ search: 'general' });
      expect(eventQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%general%' },
      );
    });

    it('applies countsForStatistics filter', async () => {
      await service.findAll({ countsForStatistics: false });
      expect(eventQb.andWhere).toHaveBeenCalledWith(
        'event.countsForStatistics = :countsForStatistics',
        { countsForStatistics: false },
      );
    });

    it('includes segmentsSummary as null when event has no segments', async () => {
      eventQb.getMany.mockResolvedValue([makeEvent({ id: 'evt-uuid' })]);
      eventQb.getCount.mockResolvedValue(1);
      segmentQb.getMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.data[0].segmentsSummary).toBeNull();
    });

    it('includes segmentsSummary with segment and instance counts', async () => {
      eventQb.getMany.mockResolvedValue([makeEvent({ id: 'evt-uuid' })]);
      eventQb.getCount.mockResolvedValue(1);
      segmentQb.getMany.mockResolvedValue([
        {
          id: 'seg-1',
          name: 'Bloc 1',
          event: { id: 'evt-uuid' },
          instances: [
            { figureTemplate: { name: 'pd4' } },
            { figureTemplate: { name: 'Morera' } },
          ],
        },
      ]);

      const result = await service.findAll({});
      const summary = result.data[0].segmentsSummary;

      expect(summary).not.toBeNull();
      expect(summary!.segmentCount).toBe(1);
      expect(summary!.instanceCount).toBe(2);
      expect(summary!.segments[0].figureNames).toEqual(['pd4', 'Morera']);
    });

    it('defaults to chronological smart sort when no sortBy given', async () => {
      await service.findAll({});
      expect(eventQb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('CASE WHEN event.date >= CURRENT_DATE'),
        'sort_group',
      );
      expect(eventQb.orderBy).toHaveBeenCalledWith('sort_group', 'ASC');
      expect(eventQb.addOrderBy).toHaveBeenCalledTimes(2);
    });

    it('uses chronological sort when sortBy=chronological', async () => {
      await service.findAll({ sortBy: 'chronological' });
      expect(eventQb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('CASE WHEN'),
        'sort_group',
      );
      expect(eventQb.orderBy).toHaveBeenCalledWith('sort_group', 'ASC');
    });

    it('respects sortBy whitelist — title ASC', async () => {
      await service.findAll({ sortBy: 'title', sortOrder: 'ASC' });
      expect(eventQb.addSelect).toHaveBeenCalledWith('unaccent(lower(event.title))', 'sort_column');
      expect(eventQb.orderBy).toHaveBeenCalledWith('sort_column', 'ASC');
    });

    it('respects sortBy location', async () => {
      await service.findAll({ sortBy: 'location', sortOrder: 'DESC' });
      expect(eventQb.addSelect).toHaveBeenCalledWith('unaccent(lower(event.location))', 'sort_column');
      expect(eventQb.orderBy).toHaveBeenCalledWith('sort_column', 'DESC');
    });

    it('applies timeFilter=upcoming', async () => {
      await service.findAll({ timeFilter: 'upcoming' });
      expect(eventQb.andWhere).toHaveBeenCalledWith('event.date >= CURRENT_DATE');
    });

    it('applies timeFilter=past', async () => {
      await service.findAll({ timeFilter: 'past' });
      expect(eventQb.andWhere).toHaveBeenCalledWith('event.date < CURRENT_DATE');
    });

    it('does not add date filter when timeFilter=all', async () => {
      await service.findAll({ timeFilter: 'all' });
      const calls: string[] = eventQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('CURRENT_DATE'))).toBe(false);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      const svc = await makeService({ findOne: jest.fn().mockResolvedValue(null) });
      await expect(svc.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns detail item with isSynced=true and no legacyId', async () => {
      const svc = await makeService({ findOne: jest.fn().mockResolvedValue(makeEvent()) });
      const result = await svc.findOne('evt-uuid');
      expect(result.id).toBe('evt-uuid');
      expect(result.isSynced).toBe(true);
      expect((result as unknown as Record<string, unknown>)['legacyId']).toBeUndefined();
    });

    it('returns isSynced=false for events without legacyId', async () => {
      const svc = await makeService({ findOne: jest.fn().mockResolvedValue(makeEvent({ legacyId: null })) });
      const result = await svc.findOne('evt-uuid');
      expect(result.isSynced).toBe(false);
    });

    it("derives the season from the event's date", async () => {
      // pg hands `date` columns back as YYYY-MM-DD strings despite the Date typing
      const svc = await makeService({
        findOne: jest.fn().mockResolvedValue(makeEvent({ date: '2026-03-26' as unknown as Date })),
      });
      const result = await svc.findOne('evt-uuid');
      expect(mockSeasonService.findByDate).toHaveBeenCalledWith('2026-03-26');
      expect(result.season).toEqual({ id: 's1', name: 'Temporada 2025-2026' });
    });

    it('returns season null when the date is in no season', async () => {
      mockSeasonService.findByDate.mockResolvedValue(null);
      const svc = await makeService({ findOne: jest.fn().mockResolvedValue(makeEvent()) });
      await expect(svc.findOne('evt-uuid')).resolves.toMatchObject({ season: null });
    });
  });

  describe('create', () => {
    const makeCreateRepo = () => ({
      create: jest.fn((partial) => ({ id: 'evt-uuid', ...partial })),
      save: jest.fn((e) => Promise.resolve(e)),
      findOne: jest.fn().mockResolvedValue(makeEvent()),
    });

    it('creates an event whose date falls in a season and returns that season', async () => {
      const repo = makeCreateRepo();
      const svc = await makeService(repo);
      const result = await svc.create({ title: 'ASSAIG', eventType: EventType.ASSAIG, date: '2026-03-26' });
      expect(mockSeasonService.findByDate).toHaveBeenCalledWith('2026-03-26');
      expect(repo.save).toHaveBeenCalled();
      expect(result.season).toEqual({ id: 's1', name: 'Temporada 2025-2026' });
    });

    it('rejects a date that falls in no season, without saving', async () => {
      mockSeasonService.findByDate.mockResolvedValue(null);
      const repo = makeCreateRepo();
      const svc = await makeService(repo);
      await expect(
        svc.create({ title: 'ASSAIG', eventType: EventType.ASSAIG, date: '2030-08-01' }),
      ).rejects.toThrow(new BadRequestException("La data de l'esdeveniment no és dins de cap temporada."));
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const makeUpdateRepo = (event: Event) => ({
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn((e) => Promise.resolve(e)),
    });

    it('updates countsForStatistics', async () => {
      const svc = await makeService(makeUpdateRepo(makeEvent()));
      const result = await svc.update('evt-uuid', { countsForStatistics: false });
      expect(result.countsForStatistics).toBe(false);
    });

    it('moves the event to a date inside a season and returns the new season', async () => {
      const season2627 = { id: 's2', name: 'Temporada 2026-2027' } as Season;
      mockSeasonService.findByDate.mockResolvedValue(season2627);
      const repo = makeUpdateRepo(makeEvent());
      const svc = await makeService(repo);
      const result = await svc.update('evt-uuid', { date: '2026-10-01' });
      expect(mockSeasonService.findByDate).toHaveBeenCalledWith('2026-10-01');
      expect(repo.save).toHaveBeenCalled();
      expect(result.season).toEqual({ id: 's2', name: 'Temporada 2026-2027' });
    });

    it('rejects moving the event to a date in no season, without saving', async () => {
      mockSeasonService.findByDate.mockResolvedValue(null);
      const repo = makeUpdateRepo(makeEvent());
      const svc = await makeService(repo);
      await expect(svc.update('evt-uuid', { date: '2030-08-01' })).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('saves other changes to an event with no season when its date is unchanged', async () => {
      mockSeasonService.findByDate.mockResolvedValue(null);
      const repo = makeUpdateRepo(makeEvent({ date: '2019-05-01' as unknown as Date }));
      const svc = await makeService(repo);
      // The dashboard sends every field on PUT, so the unchanged date comes along too
      const result = await svc.update('evt-uuid', { title: 'ALTRE TÍTOL', date: '2019-05-01' });
      expect(repo.save).toHaveBeenCalled();
      expect(result.title).toBe('ALTRE TÍTOL');
      expect(result.season).toBeNull();
    });
  });

  /**
   * Technician-only free-text field. Distinct from `information`, which the PWA shows to
   * members and the legacy sync overwrites.
   */
  describe('notes', () => {
    it('returns notes on the detail item', async () => {
      const event = makeEvent({ notes: 'Portar les faixes noves' });
      const svc = await makeService({ findOne: jest.fn().mockResolvedValue(event) });
      const result = await svc.findOne('evt-uuid');
      expect(result.notes).toBe('Portar les faixes noves');
    });

    it('persists notes on create', async () => {
      const created = makeEvent({ notes: 'Revisar el tram' });
      const eventRepo = {
        create: jest.fn((partial) => partial),
        save: jest.fn().mockResolvedValue(created),
        findOne: jest.fn().mockResolvedValue(created),
      };
      const svc = await makeService(eventRepo);
      const result = await svc.create({
        title: 'ASSAIG',
        eventType: EventType.ASSAIG,
        date: '2026-03-26',
        notes: 'Revisar el tram',
      });
      expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Revisar el tram' }));
      expect(result.notes).toBe('Revisar el tram');
    });

    it('defaults notes to null when create omits them', async () => {
      const eventRepo = {
        create: jest.fn((partial) => partial),
        save: jest.fn().mockResolvedValue(makeEvent()),
        findOne: jest.fn().mockResolvedValue(makeEvent()),
      };
      const svc = await makeService(eventRepo);
      await svc.create({ title: 'ASSAIG', eventType: EventType.ASSAIG, date: '2026-03-26' });
      expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
    });

    it('updates notes when present in the DTO', async () => {
      const event = makeEvent({ notes: 'Antic' });
      const eventRepo = {
        findOne: jest.fn().mockResolvedValue(event),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      };
      const svc = await makeService(eventRepo);
      const result = await svc.update('evt-uuid', { notes: 'Nou' });
      expect(result.notes).toBe('Nou');
    });

    it('clears notes when the DTO sends an empty value', async () => {
      const event = makeEvent({ notes: 'Antic' });
      const eventRepo = {
        findOne: jest.fn().mockResolvedValue(event),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      };
      const svc = await makeService(eventRepo);
      const result = await svc.update('evt-uuid', { notes: '' });
      expect(result.notes).toBeNull();
    });

    it('leaves notes untouched when the DTO omits them', async () => {
      const event = makeEvent({ notes: 'Es manté' });
      const eventRepo = {
        findOne: jest.fn().mockResolvedValue(event),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      };
      const svc = await makeService(eventRepo);
      const result = await svc.update('evt-uuid', { title: 'ALTRE TÍTOL' });
      expect(result.notes).toBe('Es manté');
    });

    it('omits notes from list items, which feed the events table', async () => {
      eventQb.getMany.mockResolvedValue([makeEvent({ notes: 'Intern' })]);
      eventQb.getCount.mockResolvedValue(1);
      const { data } = await service.findAll({});
      expect(data[0]).not.toHaveProperty('notes');
    });
  });
});
