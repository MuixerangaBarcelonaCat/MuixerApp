import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AvailablePersonsService } from './available-persons.service';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { NodeAssignment } from './entities/node-assignment.entity';
import { AttendanceStatus, EventType } from '@muixer/shared';

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const PERSON_ID_1 = 'person-uuid-1';
const PERSON_ID_2 = 'person-uuid-2';
const NEXT_EVENT_ID = 'event-uuid-2';

const makeEvent = (overrides: Partial<Event> = {}): Event =>
  ({
    id: EVENT_ID,
    eventType: EventType.ASSAIG,
    title: 'Assaig Diumenge',
    date: new Date('2026-05-01'),
    ...overrides,
  }) as Event;

const makePosition = (slug = 'agulla', overrides: any = {}): any => ({
  id: `pos-${slug}`,
  name: slug.charAt(0).toUpperCase() + slug.slice(1),
  slug,
  color: '#0d9488',
  ...overrides,
});

const makePerson = (id = PERSON_ID_1, overrides: any = {}): any => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
  isXicalla: false,
  attendances: [],
  positions: [],
  ...overrides,
});

const makeSegment = (id = SEGMENT_ID) => ({
  id,
  name: 'Bloc 1',
  event: { id: EVENT_ID },
});

// Mock query builder used by personRepository.createQueryBuilder
const mockPersonQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockAssignmentQb = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockPersonRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockPersonQb),
};

const mockAttendanceRepo = {
  find: jest.fn().mockResolvedValue([]),
};

const mockEventRepo = {
  findOne: jest.fn(),
};

const mockSegmentRepo = {
  findOne: jest.fn(),
};

const mockAssignmentRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockAssignmentQb),
  find: jest.fn().mockResolvedValue([]),
};

describe('AvailablePersonsService', () => {
  let service: AvailablePersonsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailablePersonsService,
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
        { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepo },
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
        { provide: getRepositoryToken(NodeAssignment), useValue: mockAssignmentRepo },
      ],
    }).compile();

    service = module.get<AvailablePersonsService>(AvailablePersonsService);
    jest.clearAllMocks();

    // Reset query builder chains
    mockPersonRepo.createQueryBuilder.mockReturnValue(mockPersonQb);
    mockPersonQb.where.mockReturnThis();
    mockPersonQb.andWhere.mockReturnThis();
    mockPersonQb.leftJoinAndSelect.mockReturnThis();
    mockPersonQb.orderBy.mockReturnThis();
    mockPersonQb.setParameter.mockReturnThis();
    mockPersonQb.getMany.mockResolvedValue([]);

    mockAssignmentRepo.createQueryBuilder.mockReturnValue(mockAssignmentQb);
    mockAssignmentRepo.find.mockResolvedValue([]);
    mockAssignmentQb.innerJoin.mockReturnThis();
    mockAssignmentQb.where.mockReturnThis();
    mockAssignmentQb.select.mockReturnThis();
    mockAssignmentQb.getMany.mockResolvedValue([]);
  });

  // ── getAvailablePersons ────────────────────────────────────────────────────

  describe('getAvailablePersons', () => {
    it('returns persons with attendanceStatus for current event', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      const person = makePerson(PERSON_ID_1);
      mockPersonQb.getMany.mockResolvedValue([person]);
      // The service fetches attendance separately via attendanceRepository.find
      mockAttendanceRepo.find.mockResolvedValue([
        { person: { id: PERSON_ID_1 }, status: AttendanceStatus.ANIRE },
      ]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {});

      expect(result).toHaveLength(1);
      expect(result[0].attendanceStatus).toBe(AttendanceStatus.ANIRE);
    });

    it('filters by search — calls andWhere with ILIKE', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockPersonQb.getMany.mockResolvedValue([]);

      await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, { search: 'pere' });

      expect(mockPersonQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%pere%' }),
      );
    });

    it('filters by isXicalla', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockPersonQb.getMany.mockResolvedValue([]);

      await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, { isXicalla: true });

      expect(mockPersonQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('isXicalla'),
        { isXicalla: true },
      );
    });

    it('sorts by height proximity when height param present', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockPersonQb.getMany.mockResolvedValue([]);

      await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, { height: 140 });

      expect(mockPersonQb.orderBy).toHaveBeenCalledWith(
        expect.stringContaining('ABS'),
        'ASC',
      );
      expect(mockPersonQb.setParameter).toHaveBeenCalledWith('height', 140);
    });

    it('excludes assigned persons when excludeAssigned=true (default)', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockPersonQb.getMany.mockResolvedValue([]);

      await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, { excludeAssigned: true });

      expect(mockPersonQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('NOT EXISTS'),
        expect.objectContaining({ segmentId: SEGMENT_ID }),
      );
    });

    it('includes assigned persons when excludeAssigned=false', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      const person = makePerson();
      mockPersonQb.getMany.mockResolvedValue([person]);
      mockAssignmentRepo.find.mockResolvedValue([
        {
          person: { id: PERSON_ID_1 },
          figureInstance: { id: 'instance-uuid-1' },
          instanceNode: { label: 'Node A' },
        },
      ]);
      mockAttendanceRepo.find.mockResolvedValue([]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, { excludeAssigned: false });

      expect(result).toHaveLength(1);
      expect(result[0].assignedInSegment).toBe(true);
      expect(result[0].assignedInstanceId).toBe('instance-uuid-1');
      expect(result[0].assignedNodeLabel).toBe('Node A');
    });

    it('returns nextPerformanceStatus when event is ASSAIG', async () => {
      const assaigEvent = makeEvent({ eventType: EventType.ASSAIG });
      const nextPerformance = makeEvent({ id: NEXT_EVENT_ID, eventType: EventType.ACTUACIO, date: new Date('2026-05-10') });
      mockEventRepo.findOne
        .mockResolvedValueOnce(assaigEvent)    // getAvailablePersons: look up current event
        .mockResolvedValueOnce(assaigEvent)    // getNextPerformance: look up current event (to get its date)
        .mockResolvedValueOnce(nextPerformance); // getNextPerformance: find next ACTUACIO
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      const person = makePerson();
      mockPersonQb.getMany.mockResolvedValue([person]);
      mockAttendanceRepo.find.mockResolvedValue([
        { person: { id: PERSON_ID_1 }, status: AttendanceStatus.ANIRE },
      ]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {});

      expect(result[0].nextPerformanceStatus).toBe(AttendanceStatus.ANIRE);
    });

    it('returns nextPerformanceStatus as null when event is ACTUACIO', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent({ eventType: EventType.ACTUACIO }));
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      const person = makePerson();
      mockPersonQb.getMany.mockResolvedValue([person]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {});

      expect(result[0].nextPerformanceStatus).toBeNull();
    });

    it('returns empty array when no persons match filters', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockPersonQb.getMany.mockResolvedValue([]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, { search: 'xyz' });

      expect(result).toEqual([]);
    });

    it('throws NotFoundException if event not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if segment not found or does not belong to event', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns positions[] for each person with id, name, slug, color', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      const pos1 = makePosition('agulla', { color: '#0d9488' });
      const pos2 = makePosition('vents', { color: '#A5D6A7' });
      const person = makePerson(PERSON_ID_1, { positions: [pos1, pos2] });
      mockPersonQb.getMany.mockResolvedValue([person]);
      mockAttendanceRepo.find.mockResolvedValue([]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {});

      expect(result[0].positions).toHaveLength(2);
      expect(result[0].positions[0]).toEqual({ id: pos1.id, name: pos1.name, slug: 'agulla', color: '#0d9488' });
      expect(result[0].positions[1]).toEqual({ id: pos2.id, name: pos2.name, slug: 'vents', color: '#A5D6A7' });
    });

    it('returns empty positions[] when person has no positions', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      const person = makePerson(PERSON_ID_1, { positions: [] });
      mockPersonQb.getMany.mockResolvedValue([person]);
      mockAttendanceRepo.find.mockResolvedValue([]);

      const result = await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {});

      expect(result[0].positions).toEqual([]);
    });

    it('calls leftJoinAndSelect for person.positions', async () => {
      mockEventRepo.findOne.mockResolvedValueOnce(makeEvent()).mockResolvedValue(null);
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockPersonQb.getMany.mockResolvedValue([]);

      await service.getAvailablePersons(EVENT_ID, SEGMENT_ID, {});

      expect(mockPersonQb.leftJoinAndSelect).toHaveBeenCalledWith('person.positions', 'positions');
    });
  });

  // ── getNextPerformance ─────────────────────────────────────────────────────

  describe('getNextPerformance', () => {
    it('returns next ACTUACIO after current event date', async () => {
      const current = makeEvent({ date: new Date('2026-05-01') });
      const next = makeEvent({ id: NEXT_EVENT_ID, eventType: EventType.ACTUACIO, date: new Date('2026-05-10') });
      mockEventRepo.findOne
        .mockResolvedValueOnce(current)  // look up current event for its date
        .mockResolvedValueOnce(next);    // find next ACTUACIO after current.date

      const result = await service.getNextPerformance(EVENT_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(NEXT_EVENT_ID);
    });

    it('returns null when no future ACTUACIO exists', async () => {
      mockEventRepo.findOne
        .mockResolvedValueOnce(makeEvent()) // look up current event
        .mockResolvedValueOnce(null);       // no next ACTUACIO

      const result = await service.getNextPerformance(EVENT_ID);

      expect(result).toBeNull();
    });
  });
});
