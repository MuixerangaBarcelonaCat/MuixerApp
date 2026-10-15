import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import { AttendanceStatus } from '@muixer/shared';
import { AuditService } from '../audit/audit.service';

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({ id: 'p1', alias: 'ADRI', name: 'Adrian', firstSurname: 'Abreu', isXicalla: false, positions: [], ...overrides } as Person);

const makeEvent = (overrides: Partial<Event> = {}): Partial<Event> => ({
  id: 'ev-1',
  date: new Date(),
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, lateCancel: 0, children: 0, childrenAttended: 0, total: 0 },
  ...overrides,
});

/** A person as the attendance list loads it: with this event's row (or null) mapped onto it. */
const toListedPerson = (a: Attendance) => ({ ...a.person, createdAt: new Date('2000-01-01'), attendance: a });

const makeAttendance = (status: AttendanceStatus): Attendance =>
  ({
    id: 'att-1',
    status,
    respondedAt: null,
    notes: null,
    person: makePerson(),
    event: { id: 'ev-1' } as Event,
    legacyId: null,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Attendance);

/** Mirrors what the GROUP BY status, isXicalla aggregate (PENDENT rows excluded) returns for a set of attendances. */
const toSummaryRows = (attendances: Attendance[]) => {
  const rows = new Map<string, { status: AttendanceStatus; isXicalla: boolean; count: string }>();
  for (const a of attendances.filter((att) => att.status !== AttendanceStatus.PENDENT)) {
    const key = `${a.status}|${a.person.isXicalla}`;
    const existing = rows.get(key);
    if (existing) existing.count = String(Number(existing.count) + 1);
    else rows.set(key, { status: a.status, isXicalla: a.person.isXicalla, count: '1' });
  }
  return [...rows.values()];
};

describe('AttendanceService', () => {
  let service: AttendanceService;
  const originalLockDays = process.env.ASSIGNMENT_LOCK_DAYS;

  afterEach(() => {
    process.env.ASSIGNMENT_LOCK_DAYS = originalLockDays;
    jest.clearAllMocks();
  });

  const makeRepos = (
    attendances: Attendance[] = [],
    event: Partial<Event> | null = makeEvent(),
    person: Partial<Person> | null = makePerson(),
  ) => {
    const personQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(attendances.length),
      getMany: jest.fn().mockResolvedValue(attendances.map(toListedPerson)),
    };

    const lockQb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(event),
    };

    const aggQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(toSummaryRows(attendances)),
    };

    const manager = {
      createQueryBuilder: jest.fn((entity: unknown) => (entity === Event ? lockQb : aggQb)),
      find: jest.fn().mockResolvedValue(attendances),
      update: jest.fn().mockResolvedValue(undefined),
      // Live pending count: here, the PENDENT rows (no person without a row in these fixtures).
      query: jest.fn().mockResolvedValue([
        { eventId: 'ev-1', pending: attendances.filter((a) => a.status === AttendanceStatus.PENDENT).length },
      ]),
      lockQb,
      aggQb,
    };

    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
      manager,
    };

    return {
      attendanceRepo: {
        find: jest.fn().mockResolvedValue(attendances),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((fields: Partial<Attendance>) => ({ id: 'att-1', ...fields }) as Attendance),
        save: jest.fn(async (att: Attendance) => att),
      },
      eventRepo: {
        findOne: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue(undefined),
      },
      personRepo: {
        findOne: jest.fn().mockResolvedValue(person),
        createQueryBuilder: jest.fn(() => personQb),
        personQb,
      },
      dataSource,
    };
  };

  const auditService = { record: jest.fn().mockResolvedValue(undefined) };

  const buildModule = async (repos: ReturnType<typeof makeRepos>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Attendance), useValue: repos.attendanceRepo },
        { provide: getRepositoryToken(Event), useValue: repos.eventRepo },
        { provide: getRepositoryToken(Person), useValue: repos.personRepo },
        { provide: DataSource, useValue: repos.dataSource },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();
    return module.get<AttendanceService>(AttendanceService);
  };

  // --- findByEvent ---
  describe('findByEvent', () => {
    it('throws NotFoundException when event does not exist', async () => {
      const repos = makeRepos([], null);
      service = await buildModule(repos);
      await expect(service.findByEvent('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('returns paginated attendance list', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ASSISTIT)]);
      service = await buildModule(repos);
      const result = await service.findByEvent('ev-1', {});
      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('orders by a case-insensitive alias with the provisional "~" prefix stripped', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ANIRE)]);
      service = await buildModule(repos);
      await service.findByEvent('ev-1', {});
      expect(repos.personRepo.personQb.addSelect).toHaveBeenCalledWith(
        "unaccent(lower(regexp_replace(person.alias, '^~', '')))",
        'normalized_alias',
      );
      expect(repos.personRepo.personQb.orderBy).toHaveBeenCalledWith('normalized_alias', 'ASC');
      expect(repos.personRepo.personQb.addOrderBy).toHaveBeenCalledWith('person.alias', 'ASC');
    });

    it('maps isProvisional onto the person ref', async () => {
      const repos = makeRepos([
        { ...makeAttendance(AttendanceStatus.ASSISTIT), person: makePerson({ isProvisional: true }) },
      ]);
      service = await buildModule(repos);
      const result = await service.findByEvent('ev-1', {});
      expect(result.data[0].person.isProvisional).toBe(true);
    });

    it('filters an answered status by its rows', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ASSISTIT)]);
      service = await buildModule(repos);
      await service.findByEvent('ev-1', { status: AttendanceStatus.ASSISTIT });
      expect(repos.personRepo.personQb.andWhere).toHaveBeenCalledWith(
        'attendance.status = :status',
        { status: AttendanceStatus.ASSISTIT },
      );
    });

    it('filters PENDENT as no row or a PENDENT row', async () => {
      const repos = makeRepos([]);
      service = await buildModule(repos);
      await service.findByEvent('ev-1', { status: AttendanceStatus.PENDENT });
      expect(repos.personRepo.personQb.andWhere).toHaveBeenCalledWith(
        '(attendance.id IS NULL OR attendance.status = :pendent)',
      );
    });

    it('lists a person without a row as PENDENT', async () => {
      const repos = makeRepos([]);
      repos.personRepo.personQb.getCount.mockResolvedValue(1);
      repos.personRepo.personQb.getMany.mockResolvedValue([
        { ...makePerson(), createdAt: new Date('2000-01-01'), attendance: null },
      ]);
      service = await buildModule(repos);

      const { data } = await service.findByEvent('ev-1', {});

      expect(data[0]).toEqual(
        expect.objectContaining({ status: AttendanceStatus.PENDENT, respondedAt: null, notes: null }),
      );
    });

    it('filters by positionIds when provided', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ANIRE)]);
      service = await buildModule(repos);
      await service.findByEvent('ev-1', { positionIds: ['pos-1'] });
      expect(repos.personRepo.personQb.setParameter).toHaveBeenCalledWith('positionIds', ['pos-1']);
    });

    it('does not add positionIds filter when array is empty', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ANIRE)]);
      service = await buildModule(repos);
      await service.findByEvent('ev-1', { positionIds: [] });
      expect(repos.personRepo.personQb.setParameter).not.toHaveBeenCalled();
    });
  });

  // --- set ---
  describe('set', () => {
    const futureEvent = () => makeEvent({ date: new Date('2099-01-01') });

    it('throws NotFoundException when event does not exist', async () => {
      const repos = makeRepos([], null);
      service = await buildModule(repos);
      await expect(service.set('missing', 'p1', { status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when person does not exist', async () => {
      const repos = makeRepos([], futureEvent(), null);
      service = await buildModule(repos);
      await expect(service.set('ev-1', 'bad', { status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(NotFoundException);
    });

    it('inserts a row with respondedAt when there is none and an answer is given', async () => {
      const repos = makeRepos([], futureEvent());
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.ANIRE });

      expect(repos.attendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.ANIRE, respondedAt: expect.any(Date) }),
      );
      expect(repos.attendanceRepo.save).toHaveBeenCalled();
    });

    it('writes nothing when setting PENDENT with no notes and there is no row', async () => {
      const repos = makeRepos([], futureEvent());
      service = await buildModule(repos);

      const result = await service.set('ev-1', 'p1', { status: AttendanceStatus.PENDENT });

      expect(repos.attendanceRepo.save).not.toHaveBeenCalled();
      expect(result.attendance).toEqual(
        expect.objectContaining({ status: AttendanceStatus.PENDENT, respondedAt: null, notes: null }),
      );
    });

    it('inserts a PENDENT row without respondedAt when only notes are given', async () => {
      const repos = makeRepos([], futureEvent());
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { notes: 'Lesionada' });

      expect(repos.attendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.PENDENT, respondedAt: null, notes: 'Lesionada' }),
      );
    });

    it('updates status and notes of an existing row', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      const result = await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT, notes: 'Va aparèixer' });

      expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.ASSISTIT, notes: 'Va aparèixer' }),
      );
      expect(result).toHaveProperty('summary');
    });

    it('clears notes when passed null', async () => {
      const att = { ...makeAttendance(AttendanceStatus.ANIRE), notes: 'Nota prèvia' };
      const repos = makeRepos([att as Attendance], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { notes: null });
      expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null }),
      );
    });

    it('does not touch respondedAt on a notes-only edit (SM-15)', async () => {
      const originalRespondedAt = new Date('2026-01-01T00:00:00Z');
      const att = { ...makeAttendance(AttendanceStatus.ANIRE), respondedAt: originalRespondedAt };
      const repos = makeRepos([att as Attendance], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { notes: 'Només una nota' });

      expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ respondedAt: originalRespondedAt }),
      );
    });

    it('keeps the row and bumps respondedAt when an answer goes back to PENDENT', async () => {
      const originalRespondedAt = new Date('2026-01-01T00:00:00Z');
      const att = { ...makeAttendance(AttendanceStatus.ANIRE), respondedAt: originalRespondedAt };
      const repos = makeRepos([att as Attendance], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.PENDENT });

      const saved = repos.attendanceRepo.save.mock.calls[0][0];
      expect(saved.status).toBe(AttendanceStatus.PENDENT);
      expect(saved.respondedAt).not.toEqual(originalRespondedAt);
    });

    it('throws ForbiddenException when locked and force is not set', async () => {
      process.env.ASSIGNMENT_LOCK_DAYS = '2';
      const pastEvent = makeEvent({ date: new Date('2000-01-01') });
      const repos = makeRepos([], pastEvent);
      service = await buildModule(repos);
      await expect(service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT }))
        .rejects.toThrow(ForbiddenException);
      expect(repos.attendanceRepo.save).not.toHaveBeenCalled();
    });

    it('applies the change and records an audit entry when locked and force is set', async () => {
      process.env.ASSIGNMENT_LOCK_DAYS = '2';
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const pastEvent = makeEvent({ date: new Date('2000-01-01') });
      const repos = makeRepos([att], pastEvent);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT, force: true }, 'user-1');

      expect(repos.attendanceRepo.save).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'ATTENDANCE_LOCK_OVERRIDE',
          targetType: 'Attendance',
          targetId: 'att-1',
          metadata: expect.objectContaining({ eventId: 'ev-1', personId: 'p1', previousStatus: AttendanceStatus.ANIRE, newStatus: AttendanceStatus.ASSISTIT }),
        }),
      );
    });

    it('audits a forced insert with PENDENT as the previous status', async () => {
      process.env.ASSIGNMENT_LOCK_DAYS = '2';
      const pastEvent = makeEvent({ date: new Date('2000-01-01') });
      const repos = makeRepos([], pastEvent);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT, force: true }, 'user-1');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ previousStatus: AttendanceStatus.PENDENT, newStatus: AttendanceStatus.ASSISTIT }),
        }),
      );
    });

    it('does not record an audit entry for an unlocked change', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT });

      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('recalculates the summary after a change', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT });
      expect(repos.dataSource.manager.update).toHaveBeenCalled();
    });

    it('returns the attendance without an id, keyed by person', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att], futureEvent());
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      const result = await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT });

      expect(result.attendance).not.toHaveProperty('id');
      expect(result.attendance.person.id).toBe('p1');
    });
  });

  // --- recalculateSummary ---
  describe('recalculateSummary', () => {
    it('calculates all counts correctly including children', async () => {
      const attendances: Attendance[] = [
        makeAttendance(AttendanceStatus.ASSISTIT),
        { ...makeAttendance(AttendanceStatus.ASSISTIT), person: makePerson({ isXicalla: true }) },
        makeAttendance(AttendanceStatus.NO_VAIG),
        makeAttendance(AttendanceStatus.PENDENT),
        makeAttendance(AttendanceStatus.ANIRE),
        makeAttendance(AttendanceStatus.ANIRE),
      ];
      const repos = makeRepos(attendances);
      service = await buildModule(repos);

      await service.recalculateSummary('ev-1');

      const [, , partialUpdate] = repos.dataSource.manager.update.mock.calls[0];
      const summary = partialUpdate.attendanceSummary;
      expect(summary.attended).toBe(2);
      expect(summary.declined).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.confirmed).toBe(2);
      expect(summary.children).toBe(1);
      expect(summary.total).toBe(6);
    });

    it('runs inside a transaction', async () => {
      const repos = makeRepos([]);
      service = await buildModule(repos);

      await service.recalculateSummary('ev-1');

      expect(repos.dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('takes a pessimistic write lock on the event row before reading attendances (serializes concurrent recalculations)', async () => {
      const repos = makeRepos([]);
      service = await buildModule(repos);

      const callOrder: string[] = [];
      repos.dataSource.manager.lockQb.getOne.mockImplementation(async () => {
        callOrder.push('lock');
        return makeEvent();
      });
      repos.dataSource.manager.aggQb.getRawMany.mockImplementation(async () => {
        callOrder.push('count');
        return [];
      });

      await service.recalculateSummary('ev-1');

      expect(repos.dataSource.manager.createQueryBuilder).toHaveBeenCalledWith(Event, 'event');
      expect(repos.dataSource.manager.lockQb.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(callOrder).toEqual(['lock', 'count']);
    });

    it('counts with a grouped aggregate instead of hydrating every attendance row', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ANIRE)]);
      service = await buildModule(repos);

      await service.recalculateSummary('ev-1');

      expect(repos.dataSource.manager.aggQb.getRawMany).toHaveBeenCalledTimes(1);
      expect(repos.dataSource.manager.find).not.toHaveBeenCalled();
    });

    it('returns the summary it just computed, so callers need no follow-up SELECT', async () => {
      const repos = makeRepos([
        makeAttendance(AttendanceStatus.ANIRE),
        { ...makeAttendance(AttendanceStatus.ASSISTIT), person: makePerson({ isXicalla: true }) } as Attendance,
      ]);
      service = await buildModule(repos);

      const summary = await service.recalculateSummary('ev-1');

      expect(summary.confirmed).toBe(1);
      expect(summary.attended).toBe(1);
      expect(summary.children).toBe(1);
      expect(summary.childrenAttended).toBe(1);
      expect(summary.total).toBe(2);
    });
  });

  // --- round trips ---
  describe('round trips per write', () => {
    it('set reads the event, the person and the attendance once each', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att], makeEvent({ date: new Date('2099-01-01') }));
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.set('ev-1', 'p1', { status: AttendanceStatus.ASSISTIT });

      expect(repos.eventRepo.findOne).toHaveBeenCalledTimes(1);
      expect(repos.personRepo.findOne).toHaveBeenCalledTimes(1);
      expect(repos.attendanceRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });
});
