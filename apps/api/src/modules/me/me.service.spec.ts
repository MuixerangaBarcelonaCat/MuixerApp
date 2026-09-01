import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceStatus, DelegateType, EventType, FigureMode, Gender, JwtPayload, UserRole } from '@muixer/shared';
import { MeService } from './me.service';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { PersonService } from '../person/person.service';
import { ProjectionService } from '../event-segment/projection.service';
import { EventSegmentService } from '../event-segment/event-segment.service';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { NewsService } from '../news/news.service';
import { News } from '../news/news.entity';

const mockUser: JwtPayload = {
  sub: 'user-1',
  email: 'test@test.com',
  role: UserRole.MEMBER,
};

const mockSeason = { id: 'season-1', name: '2025-2026' };

const mockEvent: Partial<Event> = {
  id: 'event-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig',
  date: new Date('2026-07-01'),
  startTime: '20:00',
  location: 'Local',
  description: 'Desc',
  locationUrl: null,
  information: 'Info',
  attendanceSummary: {
    confirmed: 0, declined: 0, pending: 0, attended: 0,
    lateCancel: 0, children: 0, childrenAttended: 0, total: 0,
  },
};

describe('MeService', () => {
  let service: MeService;
  let userRepo: jest.Mocked<Repository<User>>;
  let eventRepo: jest.Mocked<Repository<Event>>;
  let attendanceRepo: jest.Mocked<Repository<Attendance>>;
  let seasonService: jest.Mocked<SeasonService>;
  let attendanceService: jest.Mocked<AttendanceService>;
  let personDelegateService: jest.Mocked<PersonDelegateService>;
  let personService: jest.Mocked<PersonService>;
  let projectionService: jest.Mocked<ProjectionService>;
  let eventSegmentService: jest.Mocked<EventSegmentService>;
  let nodeAssignmentRepo: jest.Mocked<Repository<NodeAssignment>>;
  let personRepo: jest.Mocked<Repository<Person>>;
  let newsService: jest.Mocked<NewsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Person),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Event),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            upsert: jest.fn(),
            findOneOrFail: jest.fn(),
          },
        },
        {
          provide: SeasonService,
          useValue: { findCurrentEntity: jest.fn(), findEntityById: jest.fn(), findAll: jest.fn() },
        },
        {
          provide: AttendanceService,
          useValue: { recalculateSummary: jest.fn() },
        },
        {
          provide: PersonDelegateService,
          useValue: {
            findByUser: jest.fn().mockResolvedValue([]),
            findProvisionalPrimaryDependents: jest.fn().mockResolvedValue([]),
            assertCanManagePerson: jest.fn().mockResolvedValue(undefined),
            findByPerson: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: PersonService,
          useValue: { update: jest.fn() },
        },
        {
          provide: ProjectionService,
          useValue: { getProjection: jest.fn() },
        },
        {
          provide: EventSegmentService,
          useValue: { findAllByEvent: jest.fn() },
        },
        {
          provide: getRepositoryToken(NodeAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NewsService,
          useValue: { findPublished: jest.fn(), findPublishedOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MeService);
    userRepo = module.get(getRepositoryToken(User));
    personRepo = module.get(getRepositoryToken(Person));
    eventRepo = module.get(getRepositoryToken(Event));
    attendanceRepo = module.get(getRepositoryToken(Attendance));
    seasonService = module.get(SeasonService);
    attendanceService = module.get(AttendanceService);
    personDelegateService = module.get(PersonDelegateService);
    personService = module.get(PersonService);
    projectionService = module.get(ProjectionService);
    eventSegmentService = module.get(EventSegmentService);
    nodeAssignmentRepo = module.get(getRepositoryToken(NodeAssignment));
    newsService = module.get(NewsService);
    attendanceRepo.find.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  describe('resolveManagedPersons', () => {
    it('should return only self when user has a linked person and no delegates', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig', alias: 'MartaP' },
      } as User);
      personDelegateService.findByUser.mockResolvedValue([]);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([
        { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null },
      ]);
    });

    it('should list self followed by active delegates in order', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig', alias: 'MartaP' },
      } as User);
      personDelegateService.findByUser.mockResolvedValue([
        {
          person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig', alias: 'JoanP' },
          delegateType: DelegateType.PARENT,
        },
        {
          person: { id: 'p-3', name: 'Anna', firstSurname: 'Puig', alias: 'AnnaP' },
          delegateType: DelegateType.GUARDIAN,
        },
      ] as never);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([
        { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null },
        { personId: 'p-2', displayName: 'JoanP', isSelf: false, delegateType: DelegateType.PARENT },
        { personId: 'p-3', displayName: 'AnnaP', isSelf: false, delegateType: DelegateType.GUARDIAN },
      ]);
    });

    it('should list only delegates when user has no linked person', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([
        {
          person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig', alias: 'JoanP' },
          delegateType: DelegateType.PARENT,
        },
      ] as never);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([
        { personId: 'p-2', displayName: 'JoanP', isSelf: false, delegateType: DelegateType.PARENT },
      ]);
    });

    it('should return empty array when user has no person and no delegates', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([]);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([]);
    });

    it('forwards options (e.g. primaryOnly) through to findByUser', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([]);

      await service.resolveManagedPersons('user-1', { primaryOnly: true });

      expect(personDelegateService.findByUser).toHaveBeenCalledWith('user-1', { primaryOnly: true });
    });
  });

  describe('getPersonSummary', () => {
    it('returns the person summary with the count of active delegates', async () => {
      personRepo.findOne.mockResolvedValue({
        id: 'p-1',
        alias: 'MartaP',
        name: 'Marta',
        firstSurname: 'Puig',
      } as Person);
      personDelegateService.findByPerson.mockResolvedValue([
        { id: 'del-1', isActive: true },
        { id: 'del-2', isActive: true },
        { id: 'del-3', isActive: false },
      ] as never);

      const result = await service.getPersonSummary('user-1', 'p-1');

      expect(personDelegateService.assertCanManagePerson).toHaveBeenCalledWith('user-1', 'p-1');
      expect(result).toEqual({
        personId: 'p-1',
        alias: 'MartaP',
        name: 'Marta',
        firstSurname: 'Puig',
        delegationCount: 2,
      });
    });

    it('propagates ForbiddenException from the authorization guard without querying the person', async () => {
      personDelegateService.assertCanManagePerson.mockRejectedValue(new ForbiddenException());

      await expect(service.getPersonSummary('user-1', 'p-1')).rejects.toThrow(ForbiddenException);
      expect(personRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the person does not exist', async () => {
      personRepo.findOne.mockResolvedValue(null);

      await expect(service.getPersonSummary('user-1', 'p-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPersonDelegates', () => {
    it('returns the delegates for a person the caller can manage', async () => {
      const delegates = [{ id: 'del-1', delegateType: DelegateType.PARENT, isActive: true }];
      personDelegateService.findByPerson.mockResolvedValue(delegates as never);

      const result = await service.listPersonDelegates('user-1', 'p-1');

      expect(personDelegateService.assertCanManagePerson).toHaveBeenCalledWith('user-1', 'p-1');
      expect(personDelegateService.findByPerson).toHaveBeenCalledWith('p-1');
      expect(result).toEqual(delegates);
    });

    it('propagates ForbiddenException from the authorization guard', async () => {
      personDelegateService.assertCanManagePerson.mockRejectedValue(new ForbiddenException());

      await expect(service.listPersonDelegates('user-1', 'p-1')).rejects.toThrow(ForbiddenException);
      expect(personDelegateService.findByPerson).not.toHaveBeenCalled();
    });
  });

  describe('createPersonDelegate', () => {
    const dto = { alias: 'JoanP', delegateType: DelegateType.PARTNER };

    function mockPersonQb(targetPerson: unknown) {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(targetPerson),
      };
      personRepo.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    }

    it('creates a delegate for the account linked to the matching alias, always as non-primary', async () => {
      const qb = mockPersonQb({ id: 'p-target', alias: 'JoanP', user: { id: 'user-target' } });
      const created = { id: 'del-new', delegateType: DelegateType.PARTNER, isPrimary: false };
      personDelegateService.create.mockResolvedValue(created as never);

      const result = await service.createPersonDelegate('user-1', 'p-1', dto);

      expect(personDelegateService.assertCanManagePerson).toHaveBeenCalledWith('user-1', 'p-1');
      expect(qb.where).toHaveBeenCalledWith('LOWER(person.alias) = LOWER(:alias)', { alias: 'JoanP' });
      expect(personDelegateService.create).toHaveBeenCalledWith('p-1', {
        userId: 'user-target',
        delegateType: DelegateType.PARTNER,
        isPrimary: false,
      });
      expect(result).toEqual(created);
    });

    it('matches the alias case-insensitively', async () => {
      mockPersonQb({ id: 'p-target', alias: 'JoanP', user: { id: 'user-target' } });
      personDelegateService.create.mockResolvedValue({} as never);

      await service.createPersonDelegate('user-1', 'p-1', { ...dto, alias: 'joanp' });

      expect(personDelegateService.create).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ userId: 'user-target' }),
      );
    });

    it('throws NotFoundException when no person matches the alias', async () => {
      mockPersonQb(null);

      await expect(service.createPersonDelegate('user-1', 'p-1', dto)).rejects.toThrow(NotFoundException);
      expect(personDelegateService.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the matching person has no linked account', async () => {
      mockPersonQb({ id: 'p-target', alias: 'JoanP', user: null });

      await expect(service.createPersonDelegate('user-1', 'p-1', dto)).rejects.toThrow(NotFoundException);
      expect(personDelegateService.create).not.toHaveBeenCalled();
    });

    it('propagates ForbiddenException from the authorization guard without querying the alias', async () => {
      personDelegateService.assertCanManagePerson.mockRejectedValue(new ForbiddenException());

      await expect(service.createPersonDelegate('user-1', 'p-1', dto)).rejects.toThrow(ForbiddenException);
      expect(personRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('removePersonDelegate', () => {
    it('removes the delegate after the authorization guard passes', async () => {
      personDelegateService.remove.mockResolvedValue(undefined);

      await service.removePersonDelegate('user-1', 'p-1', 'del-1');

      expect(personDelegateService.assertCanManagePerson).toHaveBeenCalledWith('user-1', 'p-1');
      expect(personDelegateService.remove).toHaveBeenCalledWith('p-1', 'del-1', {
        allowPrimaryRemoval: false,
      });
    });

    it('propagates ForbiddenException from the authorization guard', async () => {
      personDelegateService.assertCanManagePerson.mockRejectedValue(new ForbiddenException());

      await expect(service.removePersonDelegate('user-1', 'p-1', 'del-1')).rejects.toThrow(ForbiddenException);
      expect(personDelegateService.remove).not.toHaveBeenCalled();
    });
  });

  function mockListQb(events: Partial<Event>[], total: number) {
    const mockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(total),
      getMany: jest.fn().mockResolvedValue(events),
    };
    eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);
    return mockQb;
  }

  describe('findSeasons', () => {
    it('should map season list items to MeSeason', async () => {
      seasonService.findAll.mockResolvedValue({
        data: [{ id: 's-1', name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31'), description: null, eventCount: 3 }],
        total: 1,
      } as never);

      const result = await service.findSeasons();

      expect(result).toEqual([
        { id: 's-1', name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31') },
      ]);
    });
  });

  describe('findEvents', () => {
    it('should return empty page when user has no person and no delegates', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);

      const result = await service.findEvents(mockUser, {});
      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20 } });
    });

    it('should return events for a delegate-only user with no linked person', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig', alias: 'JoanP' }, delegateType: DelegateType.PARENT },
      ] as never);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);
      mockListQb([mockEvent as Event], 1);

      const result = await service.findEvents(mockUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].managedAttendances).toEqual([
        { personId: 'p-2', displayName: 'JoanP', isSelf: false, delegateType: DelegateType.PARENT, attendance: null },
      ]);
    });

    it('should return empty page when no current season', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(null);

      const result = await service.findEvents(mockUser, {});
      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20 } });
    });

    it('should return paginated events with attendance info', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);
      mockListQb([mockEvent as Event], 1);
      attendanceRepo.find.mockResolvedValue([
        {
          id: 'att-1',
          status: AttendanceStatus.ANIRE,
          respondedAt: new Date('2026-06-15T10:00:00Z'),
          event: { id: 'event-1' },
          person: { id: 'p-1' },
        },
      ] as never);

      const result = await service.findEvents(mockUser, { timeFilter: 'upcoming' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].myAttendance).toEqual({
        id: 'att-1',
        status: AttendanceStatus.ANIRE,
        respondedAt: '2026-06-15T10:00:00.000Z',
      });
      expect(result.meta.total).toBe(1);
    });

    it('should filter by event type', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);
      const mockQb = mockListQb([], 0);

      await service.findEvents(mockUser, { type: EventType.ACTUACIO });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'event."eventType" = :type',
        { type: EventType.ACTUACIO },
      );
    });

    it('should handle past timeFilter with DESC ordering', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);
      const mockQb = mockListQb([], 0);

      await service.findEvents(mockUser, { timeFilter: 'past' });

      expect(mockQb.orderBy).toHaveBeenCalledWith('event.date', 'DESC');
    });

    it('should return events with null attendance when no record exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);
      mockListQb([mockEvent as Event], 1);

      const result = await service.findEvents(mockUser, {});
      expect(result.data[0].myAttendance).toBeNull();
      expect(result.data[0].managedAttendances[0].attendance).toBeNull();
    });

    it('should use the requested season when seasonId is provided', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findEntityById.mockResolvedValue({ id: 'season-2' } as never);
      mockListQb([], 0);

      await service.findEvents(mockUser, { seasonId: 'season-2' });

      expect(seasonService.findEntityById).toHaveBeenCalledWith('season-2');
      expect(seasonService.findCurrentEntity).not.toHaveBeenCalled();
    });

    it('should return empty page when seasonId does not match any season', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findEntityById.mockResolvedValue(null);

      const result = await service.findEvents(mockUser, { seasonId: 'missing' });
      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20 } });
    });

    it('should respect pagination params', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'MartaP' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);
      const mockQb = mockListQb([], 50);

      await service.findEvents(mockUser, { page: 3, limit: 10 });

      expect(mockQb.offset).toHaveBeenCalledWith(20);
      expect(mockQb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('findEventDetail', () => {
    it('should return event detail with attendance for linked person', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', alias: 'MartaP' },
      } as User);
      eventRepo.findOne.mockResolvedValue(mockEvent as Event);
      attendanceRepo.find.mockResolvedValue([
        {
          id: 'att-1',
          status: AttendanceStatus.ANIRE,
          respondedAt: new Date('2026-06-15'),
          event: { id: 'event-1' },
          person: { id: 'p-1' },
        },
      ] as never);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.id).toBe('event-1');
      expect(result.description).toBe('Desc');
      expect(result.information).toBe('Info');
      expect(result.myAttendance?.status).toBe(AttendanceStatus.ANIRE);
    });

    it('should return event without attendance when no person linked', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      eventRepo.findOne.mockResolvedValue(mockEvent as Event);

      const result = await service.findEventDetail(mockUser, 'event-1');
      expect(result.myAttendance).toBeNull();
    });

    it('should throw NotFoundException for non-existent event', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      eventRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findEventDetail(mockUser, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include managedAttendances with self attendance when linked', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig', alias: 'MartaP' },
      } as User);
      eventRepo.findOne.mockResolvedValue(mockEvent as Event);
      attendanceRepo.find.mockResolvedValue([
        {
          id: 'att-1',
          status: AttendanceStatus.ANIRE,
          respondedAt: new Date('2026-06-15'),
          event: { id: 'event-1' },
          person: { id: 'p-1' },
        },
      ] as never);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.managedAttendances).toEqual([
        {
          personId: 'p-1',
          displayName: 'MartaP',
          isSelf: true,
          delegateType: null,
          attendance: {
            id: 'att-1',
            status: AttendanceStatus.ANIRE,
            respondedAt: '2026-06-15T00:00:00.000Z',
          },
        },
      ]);
    });

    it('should include a delegate row with null attendance when no record exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig', alias: 'JoanP' }, delegateType: DelegateType.PARENT },
      ] as never);
      eventRepo.findOne.mockResolvedValue(mockEvent as Event);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.managedAttendances).toEqual([
        {
          personId: 'p-2',
          displayName: 'JoanP',
          isSelf: false,
          delegateType: DelegateType.PARENT,
          attendance: null,
        },
      ]);
    });

    it('should list self followed by delegates in managedAttendances', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig', alias: 'MartaP' },
      } as User);
      personDelegateService.findByUser.mockResolvedValue([
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig', alias: 'JoanP' }, delegateType: DelegateType.PARENT },
      ] as never);
      eventRepo.findOne.mockResolvedValue(mockEvent as Event);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.managedAttendances.map((m) => m.personId)).toEqual(['p-1', 'p-2']);
    });
  });

  describe('findEventSegments', () => {
    const makeSegment = (overrides: Record<string, unknown> = {}) => ({
      id: 'seg-1',
      name: null,
      sortOrder: 0,
      isPublished: true,
      instances: [],
      ...overrides,
    });

    const makeAssignment = (overrides: Record<string, unknown> = {}) => ({
      segment: { id: 'seg-1' },
      figureInstance: { label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { name: 'pd4' } },
      instanceNode: { label: 'Vent', renglaPosition: null },
      ...overrides,
    });

    it('projects published segments to id/name/sortOrder plus the instance data titles need', async () => {
      eventSegmentService.findAllByEvent.mockResolvedValue([
        makeSegment({
          id: 'seg-1',
          name: 'Bloc 1',
          instances: [
            {
              id: 'i1',
              label: null,
              figureMode: FigureMode.COMPLETA,
              figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true },
            },
          ],
        }),
      ] as never);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(result).toEqual([
        {
          id: 'seg-1',
          name: 'Bloc 1',
          sortOrder: 0,
          instances: [
            { label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { name: 'pd4', hasPinya: true } },
          ],
          myPlacements: [],
        },
      ]);
    });

    it('filters out unpublished segments', async () => {
      eventSegmentService.findAllByEvent.mockResolvedValue([
        makeSegment({ id: 'seg-1', isPublished: true }),
        makeSegment({ id: 'seg-2', isPublished: false }),
      ] as never);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(result.map((s) => s.id)).toEqual(['seg-1']);
    });

    it('delegates to EventSegmentService.findAllByEvent with the event id', async () => {
      eventSegmentService.findAllByEvent.mockResolvedValue([]);

      await service.findEventSegments(mockUser, 'event-1');

      expect(eventSegmentService.findAllByEvent).toHaveBeenCalledWith('event-1');
    });

    it('propagates NotFoundException for a non-existent event', async () => {
      eventSegmentService.findAllByEvent.mockRejectedValue(new NotFoundException());

      await expect(service.findEventSegments(mockUser, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns myPlacements: [] when the caller holds no assignment in a segment', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'Marta' } } as User);
      eventSegmentService.findAllByEvent.mockResolvedValue([makeSegment()] as never);
      nodeAssignmentRepo.find.mockResolvedValue([]);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(result[0].myPlacements).toEqual([]);
    });

    it('projects one placement to nodeLabel/cordon/figureName/figureMode', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'Marta' } } as User);
      eventSegmentService.findAllByEvent.mockResolvedValue([
        makeSegment({
          instances: [
            { id: 'i1', label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true } },
            { id: 'i2', label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { id: 'f2', name: 'Roscana', hasPinya: true } },
          ],
        }),
      ] as never);
      nodeAssignmentRepo.find.mockResolvedValue([
        makeAssignment({
          figureInstance: { label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { name: 'Roscana' } },
          instanceNode: { label: 'Vent', renglaPosition: 1 },
        }),
      ] as never);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(result[0].myPlacements).toEqual([
        { nodeLabel: 'Vent', cordon: 1, figureName: 'Roscana', figureMode: FigureMode.COMPLETA },
      ]);
    });

    it('omits the figure name when the segment holds a single figure', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'Marta' } } as User);
      eventSegmentService.findAllByEvent.mockResolvedValue([
        makeSegment({
          instances: [
            { id: 'i1', label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true } },
          ],
        }),
      ] as never);
      nodeAssignmentRepo.find.mockResolvedValue([makeAssignment()] as never);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(result[0].myPlacements[0].figureName).toBeNull();
    });

    it('returns two placements both, not collapsed', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'Marta' } } as User);
      eventSegmentService.findAllByEvent.mockResolvedValue([
        makeSegment({
          instances: [
            { id: 'i1', label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { id: 'f1', name: 'pd4', hasPinya: true } },
            { id: 'i2', label: null, figureMode: FigureMode.COMPLETA, figureTemplate: { id: 'f2', name: 'Roscana', hasPinya: true } },
          ],
        }),
      ] as never);
      nodeAssignmentRepo.find.mockResolvedValue([
        makeAssignment({ instanceNode: { label: 'Vent', renglaPosition: 1 } }),
        makeAssignment({ instanceNode: { label: 'Mans', renglaPosition: 2 } }),
      ] as never);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(result[0].myPlacements.map((p) => p.nodeLabel)).toEqual(['Vent', 'Mans']);
    });

    it('only queries assignments for the caller\'s own person, never a query param', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1', alias: 'Marta' } } as User);
      eventSegmentService.findAllByEvent.mockResolvedValue([makeSegment()] as never);
      nodeAssignmentRepo.find.mockResolvedValue([]);

      await service.findEventSegments(mockUser, 'event-1');

      expect(nodeAssignmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ person: { id: 'p-1' } }),
        }),
      );
    });

    it('does not query assignments when the caller has no linked person', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      eventSegmentService.findAllByEvent.mockResolvedValue([makeSegment()] as never);

      const result = await service.findEventSegments(mockUser, 'event-1');

      expect(nodeAssignmentRepo.find).not.toHaveBeenCalled();
      expect(result[0].myPlacements).toEqual([]);
    });
  });

  describe('findEventSegments — personId targeting', () => {
    const technicalUser: JwtPayload = { sub: 'tech-user-id', role: UserRole.TECHNICAL } as JwtPayload;
    const memberUser: JwtPayload = { sub: 'member-user-id', role: UserRole.MEMBER } as JwtPayload;
    const eventId = 'event-1';
    const otherPersonId = 'person-not-managed-by-member';

    beforeEach(() => {
      jest.spyOn(service, 'resolveManagedPersons').mockResolvedValue([
        { personId: 'member-own-person-id', displayName: 'Membre', isSelf: true, delegateType: null },
      ]);
      (eventSegmentService.findAllByEvent as jest.Mock).mockResolvedValue([]);
    });

    it('lets TECHNICAL pass an arbitrary personId', async () => {
      await expect(
        service.findEventSegments(technicalUser, eventId, otherPersonId),
      ).resolves.toEqual([]);
    });

    it('lets ADMIN pass an arbitrary personId', async () => {
      const adminUser: JwtPayload = { sub: 'admin-id', role: UserRole.ADMIN } as JwtPayload;
      await expect(
        service.findEventSegments(adminUser, eventId, otherPersonId),
      ).resolves.toEqual([]);
    });

    it('rejects MEMBER passing a personId outside their managed persons', async () => {
      await expect(
        service.findEventSegments(memberUser, eventId, otherPersonId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets MEMBER pass a personId that is their own managed person', async () => {
      await expect(
        service.findEventSegments(memberUser, eventId, 'member-own-person-id'),
      ).resolves.toEqual([]);
    });

    it('keeps self-only behavior when no personId is passed', async () => {
      await expect(service.findEventSegments(memberUser, eventId)).resolves.toEqual([]);
    });
  });

  describe('findSegmentProjection', () => {
    it('delegates to ProjectionService.getProjection scoped to onlyPublished', async () => {
      const expected = { segment: {} } as never;
      projectionService.getProjection.mockResolvedValue(expected);

      const result = await service.findSegmentProjection('event-1', 'seg-1');

      expect(projectionService.getProjection).toHaveBeenCalledWith('event-1', 'seg-1', {
        onlyPublished: true,
      });
      expect(result).toBe(expected);
    });
  });

  describe('upsertAttendance', () => {
    it('should create new attendance record via upsert', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      eventRepo.findOne.mockResolvedValue({
        ...mockEvent,
        date: new Date('2026-12-01'),
      } as Event);
      attendanceRepo.upsert.mockResolvedValue(undefined as never);

      const persisted = {
        id: 'att-new',
        status: AttendanceStatus.ANIRE,
        respondedAt: new Date(),
      };
      attendanceRepo.findOneOrFail.mockResolvedValue(persisted as never);
      attendanceService.recalculateSummary.mockResolvedValue(undefined);

      const result = await service.upsertAttendance(mockUser, 'event-1', {
        status: AttendanceStatus.ANIRE,
      });

      expect(attendanceRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.ANIRE }),
        expect.objectContaining({ conflictPaths: ['person', 'event'] }),
      );
      expect(result.id).toBe('att-new');
      expect(result.status).toBe(AttendanceStatus.ANIRE);
      expect(attendanceService.recalculateSummary).toHaveBeenCalledWith('event-1');
    });

    it('should update existing attendance record via upsert', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      eventRepo.findOne.mockResolvedValue({
        ...mockEvent,
        date: new Date('2026-12-01'),
      } as Event);
      attendanceRepo.upsert.mockResolvedValue(undefined as never);

      const updated = {
        id: 'att-1',
        status: AttendanceStatus.NO_VAIG,
        respondedAt: new Date(),
      };
      attendanceRepo.findOneOrFail.mockResolvedValue(updated as never);
      attendanceService.recalculateSummary.mockResolvedValue(undefined);

      const result = await service.upsertAttendance(mockUser, 'event-1', {
        status: AttendanceStatus.NO_VAIG,
      });

      expect(result.status).toBe(AttendanceStatus.NO_VAIG);
    });

    it('should throw ForbiddenException when user has no person', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);

      await expect(
        service.upsertAttendance(mockUser, 'event-1', { status: AttendanceStatus.ANIRE }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent event', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      eventRepo.findOne.mockResolvedValue(null);

      await expect(
        service.upsertAttendance(mockUser, 'nonexistent', { status: AttendanceStatus.ANIRE }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for past events', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      eventRepo.findOne.mockResolvedValue({
        ...mockEvent,
        date: new Date('2020-01-01'),
      } as Event);

      await expect(
        service.upsertAttendance(mockUser, 'event-1', { status: AttendanceStatus.ANIRE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call recalculateSummary after upsert', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      eventRepo.findOne.mockResolvedValue({
        ...mockEvent,
        date: new Date('2026-12-01'),
      } as Event);
      attendanceRepo.upsert.mockResolvedValue(undefined as never);

      const persisted = { id: 'att-new', status: AttendanceStatus.ANIRE, respondedAt: new Date() };
      attendanceRepo.findOneOrFail.mockResolvedValue(persisted as never);
      attendanceService.recalculateSummary.mockResolvedValue(undefined);

      await service.upsertAttendance(mockUser, 'event-1', { status: AttendanceStatus.ANIRE });

      expect(attendanceService.recalculateSummary).toHaveBeenCalledWith('event-1');
    });

    it('should upsert attendance for an active delegate when personId is given', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      personDelegateService.findByUser.mockResolvedValue([
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig' }, delegateType: DelegateType.PARENT },
      ] as never);
      eventRepo.findOne.mockResolvedValue({
        ...mockEvent,
        date: new Date('2026-12-01'),
      } as Event);
      attendanceRepo.upsert.mockResolvedValue(undefined as never);
      attendanceRepo.findOneOrFail.mockResolvedValue({
        id: 'att-delegate',
        status: AttendanceStatus.ANIRE,
        respondedAt: new Date(),
      } as never);
      attendanceService.recalculateSummary.mockResolvedValue(undefined);

      const result = await service.upsertAttendance(mockUser, 'event-1', {
        status: AttendanceStatus.ANIRE,
        personId: 'p-2',
      });

      expect(attendanceRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ person: { id: 'p-2' } }),
        expect.objectContaining({ conflictPaths: ['person', 'event'] }),
      );
      expect(result.id).toBe('att-delegate');
    });

    it('should throw ForbiddenException when personId is not self nor an active delegate', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      personDelegateService.findByUser.mockResolvedValue([]);
      eventRepo.findOne.mockResolvedValue({
        ...mockEvent,
        date: new Date('2026-12-01'),
      } as Event);

      await expect(
        service.upsertAttendance(mockUser, 'event-1', {
          status: AttendanceStatus.ANIRE,
          personId: 'p-unrelated',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPendingDependents', () => {
    it('maps provisional primary dependents to the prefill shape', async () => {
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([
        {
          id: 'child-1',
          alias: '~xicalla1',
          name: 'Provisional',
          firstSurname: '',
          secondSurname: null,
          gender: null,
          phone: null,
          birthDate: null,
        } as never,
      ]);

      const result = await service.getPendingDependents('user-1');

      expect(personDelegateService.findProvisionalPrimaryDependents).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([
        {
          personId: 'child-1',
          alias: '~xicalla1',
          name: 'Provisional',
          firstSurname: '',
          secondSurname: null,
          gender: null,
          phone: null,
          birthDate: null,
        },
      ]);
    });

    it('returns an empty array when there are no pending dependents', async () => {
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([]);

      const result = await service.getPendingDependents('user-1');

      expect(result).toEqual([]);
    });

    it('handles a birthDate returned as a plain string instead of a Date (re-provisioned person)', async () => {
      // A `date` column can come back as a string rather than a Date depending on the query
      // path — this reproduces a real 500 seen when a previously-activated person (with a
      // string-typed birthDate already in the DB row) was flipped back to provisional.
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([
        {
          id: 'child-1',
          alias: 'xicalla1',
          name: 'Joan',
          firstSurname: 'Garcia',
          secondSurname: null,
          gender: Gender.MALE,
          phone: '+34612345678',
          birthDate: '2015-01-15',
        } as never,
      ]);

      const result = await service.getPendingDependents('user-1');

      expect(result[0].birthDate).toBe('2015-01-15');
    });
  });

  describe('completePendingDependent', () => {
    const dto = {
      personId: 'child-1',
      name: 'Joan',
      firstSurname: 'Garcia',
      gender: Gender.MALE,
      phone: '+34612345678',
      birthDate: '2015-01-15',
    };

    it('promotes the dependent when it is in the eligible set', async () => {
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([
        { id: 'child-1', alias: '~xicalla1' } as never,
      ]);

      await service.completePendingDependent('user-1', dto as never);

      expect(personService.update).toHaveBeenCalledWith('child-1', {
        name: 'Joan',
        firstSurname: 'Garcia',
        secondSurname: undefined,
        gender: Gender.MALE,
        phone: '+34612345678',
        birthDate: '2015-01-15',
        isProvisional: false,
        alias: 'xicalla1',
      });
    });

    it('rejects a personId outside the caller\'s eligible dependents', async () => {
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([
        { id: 'other-child', alias: '~other' } as never,
      ]);

      await expect(
        service.completePendingDependent('user-1', dto as never),
      ).rejects.toThrow(BadRequestException);
      expect(personService.update).not.toHaveBeenCalled();
    });

    it('rejects when the eligible set is empty', async () => {
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([]);

      await expect(
        service.completePendingDependent('user-1', dto as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not strip the alias prefix when the dependent alias has none', async () => {
      personDelegateService.findProvisionalPrimaryDependents.mockResolvedValue([
        { id: 'child-1', alias: 'xicalla1' } as never,
      ]);

      await service.completePendingDependent('user-1', dto as never);

      expect(personService.update).toHaveBeenCalledWith(
        'child-1',
        expect.objectContaining({ alias: 'xicalla1' }),
      );
    });
  });

  describe('findNews', () => {
    it('maps published news items to MeNewsItem shape', async () => {
      const publishedAt = new Date('2026-01-01T10:00:00.000Z');
      newsService.findPublished.mockResolvedValue([
        { id: 'news-1', title: 'Nova temporada', body: 'Cos', publishedAt } as News,
      ]);

      const result = await service.findNews();

      expect(result).toEqual([
        { id: 'news-1', title: 'Nova temporada', publishedAt: publishedAt.toISOString(), body: 'Cos' },
      ]);
    });

    it('returns an empty list when there are no published news items', async () => {
      newsService.findPublished.mockResolvedValue([]);
      const result = await service.findNews();
      expect(result).toEqual([]);
    });
  });

  describe('findNewsDetail', () => {
    it('maps a published news item to MeNewsItem shape, including the body', async () => {
      const publishedAt = new Date('2026-01-01T10:00:00.000Z');
      newsService.findPublishedOne.mockResolvedValue({
        id: 'news-1',
        title: 'Nova temporada',
        body: 'Cos en **markdown**',
        publishedAt,
      } as News);

      const result = await service.findNewsDetail('news-1');

      expect(result).toEqual({
        id: 'news-1',
        title: 'Nova temporada',
        publishedAt: publishedAt.toISOString(),
        body: 'Cos en **markdown**',
      });
      expect(newsService.findPublishedOne).toHaveBeenCalledWith('news-1');
    });

    it('propagates NotFoundException for a draft/scheduled/missing news', async () => {
      newsService.findPublishedOne.mockRejectedValue(new NotFoundException());
      await expect(service.findNewsDetail('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
