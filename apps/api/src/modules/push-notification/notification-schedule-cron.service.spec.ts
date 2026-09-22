import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationSource } from '@muixer/shared';
import { NotificationScheduleCronService } from './notification-schedule-cron.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { getLocalDayOfWeek, getLocalTimeOfDay, formatDateOnly, getLocalToday } from '../../common/utils/date.util';

jest.mock('../../common/utils/date.util');

const mockGetLocalDayOfWeek = getLocalDayOfWeek as jest.Mock;
const mockGetLocalTimeOfDay = getLocalTimeOfDay as jest.Mock;
const mockFormatDateOnly = formatDateOnly as jest.Mock;
const mockGetLocalToday = getLocalToday as jest.Mock;

describe('NotificationScheduleCronService', () => {
  let cronService: NotificationScheduleCronService;
  let repo: { createQueryBuilder: jest.Mock };
  let logRepo: { findOne: jest.Mock };
  let scheduleService: jest.Mocked<Pick<NotificationScheduleService, 'processSchedule'>>;
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetLocalDayOfWeek.mockReturnValue(1);
    mockGetLocalTimeOfDay.mockReturnValue('18:00');
    mockGetLocalToday.mockReturnValue('2026-06-01');

    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    logRepo = { findOne: jest.fn().mockResolvedValue(null) };
    scheduleService = { processSchedule: jest.fn().mockResolvedValue({ accepted: true }) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationScheduleCronService,
        { provide: getRepositoryToken(NotificationSchedule), useValue: repo },
        { provide: getRepositoryToken(NotificationLog), useValue: logRepo },
        { provide: NotificationScheduleService, useValue: scheduleService },
      ],
    }).compile();

    cronService = module.get(NotificationScheduleCronService);
  });

  it('does nothing when no schedule is due', async () => {
    await cronService.processDueOneOffSchedules();
    expect(scheduleService.processSchedule).not.toHaveBeenCalled();
  });

  it('dispatches every due schedule with source SCHEDULED_ONE_OFF', async () => {
    const due = [{ id: 's1' }, { id: 's2' }] as NotificationSchedule[];
    qb.getMany.mockResolvedValue(due);

    await cronService.processDueOneOffSchedules();

    expect(scheduleService.processSchedule).toHaveBeenCalledTimes(2);
    expect(scheduleService.processSchedule).toHaveBeenCalledWith(due[0], NotificationSource.SCHEDULED_ONE_OFF);
    expect(scheduleService.processSchedule).toHaveBeenCalledWith(due[1], NotificationSource.SCHEDULED_ONE_OFF);
  });

  it('continues processing remaining schedules if one fails', async () => {
    const due = [{ id: 's1' }, { id: 's2' }] as NotificationSchedule[];
    qb.getMany.mockResolvedValue(due);
    scheduleService.processSchedule.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ accepted: true });

    await expect(cronService.processDueOneOffSchedules()).resolves.toBeUndefined();

    expect(scheduleService.processSchedule).toHaveBeenCalledTimes(2);
  });

  describe('processDueWeeklySchedules', () => {
    it('does nothing when no schedule matches today/time', async () => {
      await cronService.processDueWeeklySchedules();
      expect(scheduleService.processSchedule).not.toHaveBeenCalled();
    });

    it('dispatches a due WEEKLY schedule that has not fired today', async () => {
      const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' } } as NotificationSchedule;
      qb.getMany.mockResolvedValue([due]);
      logRepo.findOne.mockResolvedValue(null);

      await cronService.processDueWeeklySchedules();

      expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
    });

    it('skips a WEEKLY schedule already fired earlier today', async () => {
      const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' } } as NotificationSchedule;
      qb.getMany.mockResolvedValue([due]);
      logRepo.findOne.mockResolvedValue({ sentAt: new Date('2026-06-01T10:00:00.000Z') });
      mockFormatDateOnly.mockReturnValue('2026-06-01');

      await cronService.processDueWeeklySchedules();

      expect(scheduleService.processSchedule).not.toHaveBeenCalled();
    });

    it('dispatches again if the last log for this schedule was on a previous day', async () => {
      const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' } } as NotificationSchedule;
      qb.getMany.mockResolvedValue([due]);
      logRepo.findOne.mockResolvedValue({ sentAt: new Date('2026-05-25T10:00:00.000Z') });
      mockFormatDateOnly.mockReturnValue('2026-05-25');

      await cronService.processDueWeeklySchedules();

      expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
    });

    it('continues processing remaining schedules if one fails', async () => {
      const due = [
        { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' } },
        { id: 's2', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' } },
      ] as NotificationSchedule[];
      qb.getMany.mockResolvedValue(due);
      scheduleService.processSchedule.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ accepted: true });

      await expect(cronService.processDueWeeklySchedules()).resolves.toBeUndefined();

      expect(scheduleService.processSchedule).toHaveBeenCalledTimes(2);
    });

    describe('active window (startDate/endDate)', () => {
      it('dispatches when today is within the window', async () => {
        const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-01-01', endDate: '2026-12-31' } } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
      });

      it('skips when today is before startDate', async () => {
        const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-07-01' } } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });

      it('skips when today is after endDate', async () => {
        const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', endDate: '2026-05-31' } } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });

      it('dispatches when today equals startDate', async () => {
        const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01' } } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
      });

      it('dispatches when today equals endDate', async () => {
        const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', endDate: '2026-06-01' } } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
      });

      it('dispatches when neither startDate nor endDate is set', async () => {
        const due = { id: 's1', ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' } } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
      });
    });
  });
});
