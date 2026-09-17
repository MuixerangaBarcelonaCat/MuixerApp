import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { getLocalToday } from '../../common/utils/date.util';
import { AttendanceSweepService } from './attendance-sweep.service';
import { AttendanceService } from './attendance.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';

describe('AttendanceSweepService', () => {
  let service: AttendanceSweepService;
  let eventRepo: { find: jest.Mock };
  let attendanceRepo: { update: jest.Mock };
  let attendanceService: { recalculateSummary: jest.Mock };

  beforeEach(async () => {
    eventRepo = { find: jest.fn().mockResolvedValue([]) };
    attendanceRepo = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
    attendanceService = { recalculateSummary: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceSweepService,
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: getRepositoryToken(Attendance), useValue: attendanceRepo },
        { provide: AttendanceService, useValue: attendanceService },
      ],
    }).compile();

    service = module.get(AttendanceSweepService);
  });

  afterEach(() => jest.clearAllMocks());

  it('only queries ACTUACIO events dated today', async () => {
    await service.sweepTodaysPerformances();

    expect(eventRepo.find).toHaveBeenCalledWith({
      where: { eventType: EventType.ACTUACIO, date: getLocalToday() },
    });
  });

  it('flips only ANIRE attendances to ASSISTIT for each performance today', async () => {
    eventRepo.find.mockResolvedValue([{ id: 'ev-1' }]);
    attendanceRepo.update.mockResolvedValue({ affected: 3 });

    await service.sweepTodaysPerformances();

    expect(attendanceRepo.update).toHaveBeenCalledWith(
      { event: { id: 'ev-1' }, status: AttendanceStatus.ANIRE },
      { status: AttendanceStatus.ASSISTIT },
    );
  });

  it('does not touch respondedAt', async () => {
    eventRepo.find.mockResolvedValue([{ id: 'ev-1' }]);
    attendanceRepo.update.mockResolvedValue({ affected: 2 });

    await service.sweepTodaysPerformances();

    const [, patch] = attendanceRepo.update.mock.calls[0];
    expect(patch).not.toHaveProperty('respondedAt');
  });

  it('recalculates the summary for a performance whose attendances changed', async () => {
    eventRepo.find.mockResolvedValue([{ id: 'ev-1' }]);
    attendanceRepo.update.mockResolvedValue({ affected: 1 });

    await service.sweepTodaysPerformances();

    expect(attendanceService.recalculateSummary).toHaveBeenCalledWith('ev-1');
  });

  it('is a no-op when a performance has no ANIRE attendances (idempotent re-run)', async () => {
    eventRepo.find.mockResolvedValue([{ id: 'ev-1' }]);
    attendanceRepo.update.mockResolvedValue({ affected: 0 });

    await service.sweepTodaysPerformances();

    expect(attendanceService.recalculateSummary).not.toHaveBeenCalled();
  });

  it('does nothing when there are no performances today', async () => {
    await service.sweepTodaysPerformances();

    expect(attendanceRepo.update).not.toHaveBeenCalled();
    expect(attendanceService.recalculateSummary).not.toHaveBeenCalled();
  });
});
