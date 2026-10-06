import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
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
  season: { id: 's1', name: 'Temporada 2025-2026' } as Season,
  legacyId: '1',
  legacyType: 'assaig',
  lastSyncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  attendances: [],
  ...overrides,
} as Event);

describe('EventService', () => {
  let service: EventService;
  let eventQb: Record<string, jest.Mock>;

  const mockSeasonRepo = {
    findOne: jest.fn(),
  };

  const mockAttendanceRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  /** Live pending counts: nobody pending unless a test says otherwise. */
  const mockAttendanceService = {
    livePendingCounts: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, 0]))),
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

  beforeEach(async () => {
    eventQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
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
    mockSegmentRepo.createQueryBuilder.mockReturnValue(segmentQb);
    segmentQb.leftJoinAndSelect.mockReturnThis();
    segmentQb.where.mockReturnThis();
    segmentQb.orderBy.mockReturnThis();
    segmentQb.addOrderBy.mockReturnThis();
    segmentQb.getMany.mockResolvedValue([]);

    const mockEventRepo = {
      createQueryBuilder: jest.fn(() => eventQb),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
        { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
        { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
        { provide: AttendanceService, useValue: mockAttendanceService },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
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
      const eventRepo = { findOne: jest.fn().mockResolvedValue(makeEvent({ attendanceSummary: stored })) };
      mockAttendanceService.livePendingCounts.mockResolvedValueOnce(new Map([['evt-uuid', 3]]));
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
          { provide: AttendanceService, useValue: mockAttendanceService },
        ],
      }).compile();

      const detail = await mod.get(EventService).findOne('evt-uuid');

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

    it('applies seasonId filter', async () => {
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
      const eventRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
          { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: AttendanceService, useValue: mockAttendanceService },
        ],
      }).compile();
      const svc = mod.get<EventService>(EventService);
      await expect(svc.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns detail item with isSynced=true and no legacyId', async () => {
      const event = makeEvent();
      const eventRepo = { findOne: jest.fn().mockResolvedValue(event) };
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
          { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: AttendanceService, useValue: mockAttendanceService },
        ],
      }).compile();
      const svc = mod.get<EventService>(EventService);
      const result = await svc.findOne('evt-uuid');
      expect(result.id).toBe('evt-uuid');
      expect(result.isSynced).toBe(true);
      expect((result as unknown as Record<string, unknown>)['legacyId']).toBeUndefined();
    });

    it('returns isSynced=false for events without legacyId', async () => {
      const event = makeEvent({ legacyId: null });
      const eventRepo = { findOne: jest.fn().mockResolvedValue(event) };
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
          { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: AttendanceService, useValue: mockAttendanceService },
        ],
      }).compile();
      const svc = mod.get<EventService>(EventService);
      const result = await svc.findOne('evt-uuid');
      expect(result.isSynced).toBe(false);
    });
  });

  describe('update', () => {
    it('updates countsForStatistics without touching season', async () => {
      const event = makeEvent();
      const saveResult = { ...event, countsForStatistics: false };
      const eventRepo = {
        findOne: jest.fn().mockResolvedValue(event),
        save: jest.fn().mockResolvedValue(saveResult),
      };
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
          { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: AttendanceService, useValue: mockAttendanceService },
        ],
      }).compile();
      const svc = mod.get<EventService>(EventService);
      const result = await svc.update('evt-uuid', { countsForStatistics: false });
      expect(result.countsForStatistics).toBe(false);
      expect(mockSeasonRepo.findOne).not.toHaveBeenCalled();
    });

    it('reassigns season when seasonId is provided', async () => {
      const event = makeEvent();
      const newSeason = { id: 's2', name: 'Temporada 2025-2026' } as Season;
      const eventRepo = {
        findOne: jest.fn().mockResolvedValue(event),
        save: jest.fn().mockResolvedValue({ ...event, season: newSeason }),
      };
      mockSeasonRepo.findOne.mockResolvedValue(newSeason);
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
          { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: AttendanceService, useValue: mockAttendanceService },
        ],
      }).compile();
      const svc = mod.get<EventService>(EventService);
      const result = await svc.update('evt-uuid', { seasonId: 's2' });
      expect(result.season?.id).toBe('s2');
    });
  });

  /**
   * Technician-only free-text field. Distinct from `information`, which the PWA shows to
   * members and the legacy sync overwrites.
   */
  describe('notes', () => {
    const makeService = async (eventRepo: Record<string, jest.Mock>): Promise<EventService> => {
      const mod = await Test.createTestingModule({
        providers: [
          EventService,
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(Season), useValue: mockSeasonRepo },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
          { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
          { provide: SeasonService, useValue: { findCurrentEntity: jest.fn().mockResolvedValue(null) } },
        ],
      }).compile();
      return mod.get<EventService>(EventService);
    };

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
        seasonId: 's1',
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
      await svc.create({ title: 'ASSAIG', eventType: EventType.ASSAIG, date: '2026-03-26', seasonId: 's1' });
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
