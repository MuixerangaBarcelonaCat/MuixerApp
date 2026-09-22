import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationSource } from '@muixer/shared';
import { NotificationScheduleCronService } from './notification-schedule-cron.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';

describe('NotificationScheduleCronService', () => {
  let cronService: NotificationScheduleCronService;
  let repo: { createQueryBuilder: jest.Mock };
  let scheduleService: jest.Mocked<Pick<NotificationScheduleService, 'processSchedule'>>;
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    scheduleService = { processSchedule: jest.fn().mockResolvedValue({ accepted: true }) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationScheduleCronService,
        { provide: getRepositoryToken(NotificationSchedule), useValue: repo },
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
});
