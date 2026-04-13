import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';
import { Event } from './event.entity';
import { Attendance } from './attendance.entity';
import { Season } from '../season/season.entity';
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
  countsForStatistics: true,
  metadata: {},
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 69, noShow: 0, lateCancel: 0, children: 11, total: 80 },
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
      ],
    }).compile();

    service = module.get<EventService>(EventService);
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
      expect(eventQb.orderBy).toHaveBeenCalledWith('event.title', 'ASC');
    });

    it('respects sortBy location', async () => {
      await service.findAll({ sortBy: 'location', sortOrder: 'DESC' });
      expect(eventQb.orderBy).toHaveBeenCalledWith('event.location', 'DESC');
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
        ],
      }).compile();
      const svc = mod.get<EventService>(EventService);
      const result = await svc.update('evt-uuid', { seasonId: 's2' });
      expect(result.season?.id).toBe('s2');
    });
  });
});
