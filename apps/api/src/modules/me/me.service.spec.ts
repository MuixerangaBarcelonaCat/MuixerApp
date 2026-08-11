import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceStatus, DelegateType, EventType, JwtPayload, UserRole } from '@muixer/shared';
import { MeService } from './me.service';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
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
          useValue: { findCurrentEntity: jest.fn() },
        },
        {
          provide: AttendanceService,
          useValue: { recalculateSummary: jest.fn() },
        },
        {
          provide: PersonDelegateService,
          useValue: { findByUser: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get(MeService);
    userRepo = module.get(getRepositoryToken(User));
    eventRepo = module.get(getRepositoryToken(Event));
    attendanceRepo = module.get(getRepositoryToken(Attendance));
    seasonService = module.get(SeasonService);
    attendanceService = module.get(AttendanceService);
    personDelegateService = module.get(PersonDelegateService);
    attendanceRepo.find.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  describe('resolveManagedPersons', () => {
    it('should return only self when user has a linked person and no delegates', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig' },
      } as User);
      personDelegateService.findByUser.mockResolvedValue([]);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([
        { personId: 'p-1', displayName: 'Marta Puig', isSelf: true, delegateType: null },
      ]);
    });

    it('should list self followed by active delegates in order', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig' },
      } as User);
      personDelegateService.findByUser.mockResolvedValue([
        {
          person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig' },
          delegateType: DelegateType.PARENT,
        },
        {
          person: { id: 'p-3', name: 'Anna', firstSurname: 'Puig' },
          delegateType: DelegateType.GUARDIAN,
        },
      ] as never);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([
        { personId: 'p-1', displayName: 'Marta Puig', isSelf: true, delegateType: null },
        { personId: 'p-2', displayName: 'Joan Puig', isSelf: false, delegateType: DelegateType.PARENT },
        { personId: 'p-3', displayName: 'Anna Puig', isSelf: false, delegateType: DelegateType.GUARDIAN },
      ]);
    });

    it('should list only delegates when user has no linked person', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([
        {
          person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig' },
          delegateType: DelegateType.PARENT,
        },
      ] as never);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([
        { personId: 'p-2', displayName: 'Joan Puig', isSelf: false, delegateType: DelegateType.PARENT },
      ]);
    });

    it('should return empty array when user has no person and no delegates', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);
      personDelegateService.findByUser.mockResolvedValue([]);

      const result = await service.resolveManagedPersons('user-1');

      expect(result).toEqual([]);
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
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig' }, delegateType: DelegateType.PARENT },
      ] as never);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);

      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{ att_id: null, att_status: null, att_respondedAt: null }],
        }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.findEvents(mockUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty page when no current season', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(null);

      const result = await service.findEvents(mockUser, {});
      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 20 } });
    });

    it('should return paginated events with attendance info', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);

      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{
            att_id: 'att-1',
            att_status: AttendanceStatus.ANIRE,
            att_respondedAt: new Date('2026-06-15T10:00:00Z'),
          }],
        }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

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
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);

      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findEvents(mockUser, { type: EventType.ACTUACIO });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'event."eventType" = :type',
        { type: EventType.ACTUACIO },
      );
    });

    it('should handle past timeFilter with DESC ordering', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);

      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findEvents(mockUser, { timeFilter: 'past' });

      expect(mockQb.orderBy).toHaveBeenCalledWith('event.date', 'DESC');
    });

    it('should return events with null attendance when no record exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);

      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{ att_id: null, att_status: null, att_respondedAt: null }],
        }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.findEvents(mockUser, {});
      expect(result.data[0].myAttendance).toBeNull();
    });

    it('should respect pagination params', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);
      seasonService.findCurrentEntity.mockResolvedValue(mockSeason as never);

      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(50),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findEvents(mockUser, { page: 3, limit: 10 });

      expect(mockQb.offset).toHaveBeenCalledWith(20);
      expect(mockQb.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('findEventDetail', () => {
    it('should return event detail with attendance for linked person', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: { id: 'p-1' } } as User);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{
            att_id: 'att-1',
            att_status: AttendanceStatus.ANIRE,
            att_respondedAt: new Date('2026-06-15'),
          }],
        }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.id).toBe('event-1');
      expect(result.description).toBe('Desc');
      expect(result.information).toBe('Info');
      expect(result.myAttendance?.status).toBe(AttendanceStatus.ANIRE);
    });

    it('should return event without attendance when no person linked', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{}],
        }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.findEventDetail(mockUser, 'event-1');
      expect(result.myAttendance).toBeNull();
    });

    it('should throw NotFoundException for non-existent event', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', person: null } as User);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await expect(
        service.findEventDetail(mockUser, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include managedAttendances with self attendance when linked', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig' },
      } as User);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{ att_id: 'att-1', att_status: AttendanceStatus.ANIRE, att_respondedAt: new Date('2026-06-15') }],
        }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      attendanceRepo.find.mockResolvedValue([
        { person: { id: 'p-1' }, id: 'att-1', status: AttendanceStatus.ANIRE, respondedAt: new Date('2026-06-15') },
      ] as never);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.managedAttendances).toEqual([
        {
          personId: 'p-1',
          displayName: 'Marta Puig',
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
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig' }, delegateType: DelegateType.PARENT },
      ] as never);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [mockEvent], raw: [{}] }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      attendanceRepo.find.mockResolvedValue([]);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.managedAttendances).toEqual([
        {
          personId: 'p-2',
          displayName: 'Joan Puig',
          isSelf: false,
          delegateType: DelegateType.PARENT,
          attendance: null,
        },
      ]);
    });

    it('should list self followed by delegates in managedAttendances', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        person: { id: 'p-1', name: 'Marta', firstSurname: 'Puig' },
      } as User);
      personDelegateService.findByUser.mockResolvedValue([
        { person: { id: 'p-2', name: 'Joan', firstSurname: 'Puig' }, delegateType: DelegateType.PARENT },
      ] as never);

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [mockEvent], raw: [{}] }),
      };
      eventRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      attendanceRepo.find.mockResolvedValue([]);

      const result = await service.findEventDetail(mockUser, 'event-1');

      expect(result.managedAttendances.map((m) => m.personId)).toEqual(['p-1', 'p-2']);
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
});
