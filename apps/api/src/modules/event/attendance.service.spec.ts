import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import { AttendanceStatus, EventType } from '@muixer/shared';

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({ id: 'p1', alias: 'ADRI', name: 'Adrian', firstSurname: 'Abreu', isXicalla: false, positions: [], ...overrides } as Person);

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

  const makeRepos = (attendances: Attendance[] = [], event: Partial<Event> | null = { id: 'ev-1' }) => {
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

    return {
      attendanceRepo: {
        createQueryBuilder: jest.fn(() => attQb),
        find: jest.fn().mockResolvedValue(attendances),
        upsert: jest.fn(),
        attQb,
      },
      eventRepo: {
        findOne: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
  };

  const buildModule = async (repos: ReturnType<typeof makeRepos>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Attendance), useValue: repos.attendanceRepo },
        { provide: getRepositoryToken(Event), useValue: repos.eventRepo },
      ],
    }).compile();
    return module.get<AttendanceService>(AttendanceService);
  };

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
    expect(repos.attendanceRepo.attQb.andWhere).toHaveBeenCalledWith('attendance.status = :status', { status: AttendanceStatus.ASSISTIT });
  });

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
      expect(summary.children).toBe(1); // only xicalla with ASSISTIT/ANIRE
      expect(summary.total).toBe(6);
    });
  });
});
