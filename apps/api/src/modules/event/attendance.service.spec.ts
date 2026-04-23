import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import { AttendanceStatus } from '@muixer/shared';

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({ id: 'p1', alias: 'ADRI', name: 'Adrian', firstSurname: 'Abreu', isXicalla: false, positions: [], ...overrides } as Person);

const makeEvent = (): Partial<Event> => ({
  id: 'ev-1',
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, noShow: 0, lateCancel: 0, children: 0, total: 0 },
});

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

describe('AttendanceService', () => {
  let service: AttendanceService;

  const makeRepos = (
    attendances: Attendance[] = [],
    event: Partial<Event> | null = makeEvent(),
    person: Partial<Person> | null = makePerson(),
  ) => {
    const attQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(attendances.length),
      getMany: jest.fn().mockResolvedValue(attendances),
    };

    const savedAtt = attendances[0] ?? makeAttendance(AttendanceStatus.ANIRE);

    return {
      attendanceRepo: {
        createQueryBuilder: jest.fn(() => attQb),
        find: jest.fn().mockResolvedValue(attendances),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(savedAtt),
        save: jest.fn().mockResolvedValue(savedAtt),
        remove: jest.fn().mockResolvedValue(undefined),
        attQb,
      },
      eventRepo: {
        findOne: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue(undefined),
      },
      personRepo: {
        findOne: jest.fn().mockResolvedValue(person),
      },
    };
  };

  const buildModule = async (repos: ReturnType<typeof makeRepos>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Attendance), useValue: repos.attendanceRepo },
        { provide: getRepositoryToken(Event), useValue: repos.eventRepo },
        { provide: getRepositoryToken(Person), useValue: repos.personRepo },
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

    it('filters by status', async () => {
      const repos = makeRepos([makeAttendance(AttendanceStatus.ASSISTIT)]);
      service = await buildModule(repos);
      await service.findByEvent('ev-1', { status: AttendanceStatus.ASSISTIT });
      expect(repos.attendanceRepo.attQb.andWhere).toHaveBeenCalledWith(
        'attendance.status = :status',
        { status: AttendanceStatus.ASSISTIT },
      );
    });
  });

  // --- create ---
  describe('create', () => {
    it('creates attendance and returns attendance + summary', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att]);
      // No existing attendance for the person
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(att);
      service = await buildModule(repos);

      const result = await service.create('ev-1', { personId: 'p1', status: AttendanceStatus.ANIRE });
      expect(result).toHaveProperty('attendance');
      expect(result).toHaveProperty('summary');
      expect(repos.attendanceRepo.save).toHaveBeenCalled();
      expect(repos.eventRepo.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when event does not exist', async () => {
      const repos = makeRepos([], null);
      service = await buildModule(repos);
      await expect(service.create('missing', { personId: 'p1', status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when person does not exist', async () => {
      const repos = makeRepos([], makeEvent(), null);
      service = await buildModule(repos);
      await expect(service.create('ev-1', { personId: 'bad', status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on duplicate person+event', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);
      await expect(service.create('ev-1', { personId: 'p1', status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(ConflictException);
    });
  });

  // --- update ---
  describe('update', () => {
    it('updates status and notes and returns attendance + summary', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      const result = await service.update('ev-1', 'att-1', { status: AttendanceStatus.NO_PRESENTAT, notes: 'No va aparèixer' });
      expect(result).toHaveProperty('attendance');
      expect(result).toHaveProperty('summary');
      expect(repos.attendanceRepo.save).toHaveBeenCalled();
    });

    it('clears notes when passed null', async () => {
      const att = { ...makeAttendance(AttendanceStatus.ANIRE), notes: 'Nota prèvia' };
      const repos = makeRepos([att as Attendance]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.update('ev-1', 'att-1', { notes: null });
      expect(repos.attendanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null }),
      );
    });

    it('throws NotFoundException when attendance not found', async () => {
      const repos = makeRepos([]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(null);
      service = await buildModule(repos);
      await expect(service.update('ev-1', 'bad-att', {})).rejects.toThrow(NotFoundException);
    });

    it('recalculates summary after update', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.update('ev-1', 'att-1', { status: AttendanceStatus.ASSISTIT });
      expect(repos.eventRepo.update).toHaveBeenCalled();
    });
  });

  // --- remove ---
  describe('remove', () => {
    it('removes attendance and returns summary', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      const result = await service.remove('ev-1', 'att-1');
      expect(result).toHaveProperty('summary');
      expect(repos.attendanceRepo.remove).toHaveBeenCalledWith(att);
    });

    it('throws NotFoundException when event not found', async () => {
      const repos = makeRepos([], null);
      service = await buildModule(repos);
      await expect(service.remove('missing', 'att-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when attendance not found', async () => {
      const repos = makeRepos([]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(null);
      service = await buildModule(repos);
      await expect(service.remove('ev-1', 'bad-att')).rejects.toThrow(NotFoundException);
    });

    it('recalculates summary after deletion', async () => {
      const att = makeAttendance(AttendanceStatus.ANIRE);
      const repos = makeRepos([att]);
      repos.attendanceRepo.findOne = jest.fn().mockResolvedValue(att);
      service = await buildModule(repos);

      await service.remove('ev-1', 'att-1');
      expect(repos.eventRepo.update).toHaveBeenCalled();
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
        makeAttendance(AttendanceStatus.NO_PRESENTAT),
        makeAttendance(AttendanceStatus.ANIRE),
      ];
      const repos = makeRepos(attendances);
      service = await buildModule(repos);

      await service.recalculateSummary('ev-1');

      const [, partialUpdate] = repos.eventRepo.update.mock.calls[0];
      const summary = partialUpdate.attendanceSummary;
      expect(summary.attended).toBe(2);
      expect(summary.declined).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.noShow).toBe(1);
      expect(summary.confirmed).toBe(1);
      expect(summary.children).toBe(1);
      expect(summary.total).toBe(6);
    });
  });
});
