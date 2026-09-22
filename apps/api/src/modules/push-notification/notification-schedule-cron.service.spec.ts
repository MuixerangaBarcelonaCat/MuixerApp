import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BeforeEventOffsetUnit, EventType, NotificationSource } from '@muixer/shared';
import { NotificationScheduleCronService } from './notification-schedule-cron.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { Event } from '../event/event.entity';
import {
  getLocalDayOfWeek,
  getLocalTimeOfDay,
  formatDateOnly,
  getLocalToday,
  addDaysToDateOnly,
  zonedTimeToUtc,
} from '../../common/utils/date.util';

jest.mock('../../common/utils/date.util');

const mockGetLocalDayOfWeek = getLocalDayOfWeek as jest.Mock;
const mockGetLocalTimeOfDay = getLocalTimeOfDay as jest.Mock;
const mockFormatDateOnly = formatDateOnly as jest.Mock;
const mockGetLocalToday = getLocalToday as jest.Mock;
const mockAddDaysToDateOnly = addDaysToDateOnly as jest.Mock;
const mockZonedTimeToUtc = zonedTimeToUtc as jest.Mock;

const FIXED_NOW = new Date('2026-06-01T12:00:00.000Z');

describe('NotificationScheduleCronService', () => {
  let cronService: NotificationScheduleCronService;
  let repo: { createQueryBuilder: jest.Mock };
  let logRepo: { findOne: jest.Mock };
  let eventRepo: { find: jest.Mock };
  let scheduleService: jest.Mocked<Pick<NotificationScheduleService, 'processSchedule'>>;
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
    mockGetLocalDayOfWeek.mockReturnValue(1);
    mockGetLocalTimeOfDay.mockReturnValue('18:00');
    mockGetLocalToday.mockReturnValue('2026-06-01');
    mockFormatDateOnly.mockImplementation((date: Date) => date.toISOString().slice(0, 10));
    mockAddDaysToDateOnly.mockImplementation((dateStr: string) => dateStr);
    mockZonedTimeToUtc.mockImplementation(() => new Date('2026-05-01T00:00:00.000Z'));

    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    logRepo = { findOne: jest.fn().mockResolvedValue(null) };
    eventRepo = { find: jest.fn().mockResolvedValue([]) };
    scheduleService = { processSchedule: jest.fn().mockResolvedValue({ accepted: true }) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationScheduleCronService,
        { provide: getRepositoryToken(NotificationSchedule), useValue: repo },
        { provide: getRepositoryToken(NotificationLog), useValue: logRepo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: NotificationScheduleService, useValue: scheduleService },
      ],
    }).compile();

    cronService = module.get(NotificationScheduleCronService);
  });

  afterEach(() => {
    jest.useRealTimers();
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
    describe('a schedule created after its own send time today', () => {
      it('does not fire within the minute — its first send is next week', async () => {
        const due = {
          id: 's1',
          ruleConfig: { dayOfWeek: 1, timeOfDay: '09:00' },
          // FIXED_NOW is 12:00 UTC; today's 09:00 occurrence is already behind us.
          createdAt: FIXED_NOW,
        } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 3 * 3_600_000));

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });

      it('still fires for a schedule created before today\'s send time', async () => {
        const due = {
          id: 's1',
          ruleConfig: { dayOfWeek: 1, timeOfDay: '09:00' },
          createdAt: new Date('2026-05-20T10:00:00.000Z'),
        } as NotificationSchedule;
        qb.getMany.mockResolvedValue([due]);
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 3 * 3_600_000));

        await cronService.processDueWeeklySchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(due, NotificationSource.SCHEDULED_WEEKLY);
      });
    });
  });

  describe('processDueBeforeEventSchedules', () => {
    const makeSchedule = (ruleConfig: Record<string, unknown>): NotificationSchedule =>
      ({ id: 's1', ruleConfig } as unknown as NotificationSchedule);

    const daysRule = { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' };
    const hoursRule = { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 3 };

    it('does nothing when no schedule is active', async () => {
      qb.getMany.mockResolvedValue([]);

      await cronService.processDueBeforeEventSchedules();

      expect(eventRepo.find).not.toHaveBeenCalled();
      expect(scheduleService.processSchedule).not.toHaveBeenCalled();
    });

    it('queries events of the ruleConfig eventType from today onward', async () => {
      qb.getMany.mockResolvedValue([makeSchedule(daysRule)]);
      eventRepo.find.mockResolvedValue([]);

      await cronService.processDueBeforeEventSchedules();

      expect(eventRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ eventType: EventType.ACTUACIO }) }),
      );
    });

    it('does nothing when no upcoming event matches', async () => {
      qb.getMany.mockResolvedValue([makeSchedule(daysRule)]);
      eventRepo.find.mockResolvedValue([]);

      await cronService.processDueBeforeEventSchedules();

      expect(scheduleService.processSchedule).not.toHaveBeenCalled();
    });

    describe('DAYS offset', () => {
      it('dispatches when the computed fire instant has already passed, passing the event id through', async () => {
        const schedule = makeSchedule(daysRule);
        qb.getMany.mockResolvedValue([schedule]);
        const event = { id: 'evt-1', date: new Date('2026-06-04'), startTime: null };
        eventRepo.find.mockResolvedValue([event]);
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 60_000));

        await cronService.processDueBeforeEventSchedules();

        expect(mockAddDaysToDateOnly).toHaveBeenCalledWith('2026-06-04', -3);
        expect(scheduleService.processSchedule).toHaveBeenCalledWith(schedule, NotificationSource.SCHEDULED_BEFORE_EVENT, 'evt-1');
      });

      it('does not dispatch when the computed fire instant is still in the future', async () => {
        const schedule = makeSchedule(daysRule);
        qb.getMany.mockResolvedValue([schedule]);
        eventRepo.find.mockResolvedValue([{ id: 'evt-1', date: new Date('2026-06-04'), startTime: null }]);
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() + 60_000));

        await cronService.processDueBeforeEventSchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });
    });

    describe('HOURS offset', () => {
      it('dispatches when now is past the event start time minus the offset', async () => {
        const schedule = makeSchedule(hoursRule);
        qb.getMany.mockResolvedValue([schedule]);
        const event = { id: 'evt-2', date: new Date('2026-06-01'), startTime: '13:00' };
        eventRepo.find.mockResolvedValue([event]);
        // Event starts at FIXED_NOW + 2h; minus the 3h offset, the fire instant is 1h in the past.
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() + 2 * 3_600_000));

        await cronService.processDueBeforeEventSchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(schedule, NotificationSource.SCHEDULED_BEFORE_EVENT, 'evt-2');
      });

      it('does not dispatch before the offset has elapsed', async () => {
        const schedule = makeSchedule(hoursRule);
        qb.getMany.mockResolvedValue([schedule]);
        eventRepo.find.mockResolvedValue([{ id: 'evt-2', date: new Date('2026-06-01'), startTime: '20:00' }]);
        // Event starts 8h from now; minus the 3h offset, the fire instant is still 5h away.
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() + 8 * 3_600_000));

        await cronService.processDueBeforeEventSchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });

      it('skips an event with no startTime — there is no instant to compute', async () => {
        const schedule = makeSchedule(hoursRule);
        qb.getMany.mockResolvedValue([schedule]);
        eventRepo.find.mockResolvedValue([{ id: 'evt-2', date: new Date('2026-06-01'), startTime: null }]);

        await cronService.processDueBeforeEventSchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });
    });

    describe('an event that has already started', () => {
      it('does not send a reminder for an event whose start time has passed', async () => {
        const schedule = makeSchedule(hoursRule);
        qb.getMany.mockResolvedValue([schedule]);
        // Event started an hour ago: the fire instant (3h before that) is long past, but a
        // "d'aquí 3 hores" reminder makes no sense once the event is under way.
        eventRepo.find.mockResolvedValue([{ id: 'evt-late', date: new Date('2026-06-01'), startTime: '13:00' }]);
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 3_600_000));

        await cronService.processDueBeforeEventSchedules();

        expect(scheduleService.processSchedule).not.toHaveBeenCalled();
      });

      it('still sends for an event that has not started yet', async () => {
        const schedule = makeSchedule(hoursRule);
        qb.getMany.mockResolvedValue([schedule]);
        eventRepo.find.mockResolvedValue([{ id: 'evt-soon', date: new Date('2026-06-01'), startTime: '14:00' }]);
        mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() + 3_600_000));

        await cronService.processDueBeforeEventSchedules();

        expect(scheduleService.processSchedule).toHaveBeenCalledWith(
          schedule,
          NotificationSource.SCHEDULED_BEFORE_EVENT,
          'evt-soon',
        );
      });
    });

    it('skips an event this schedule has already fired for', async () => {
      const schedule = makeSchedule(daysRule);
      qb.getMany.mockResolvedValue([schedule]);
      eventRepo.find.mockResolvedValue([{ id: 'evt-1', date: new Date('2026-06-04'), startTime: null }]);
      mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 60_000));
      logRepo.findOne.mockResolvedValue({ id: 'log-1' });

      await cronService.processDueBeforeEventSchedules();

      expect(logRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { scheduleId: 's1', triggeredEventId: 'evt-1' } }),
      );
      expect(scheduleService.processSchedule).not.toHaveBeenCalled();
    });

    it('dispatches once per matching event, independently', async () => {
      const schedule = makeSchedule(daysRule);
      qb.getMany.mockResolvedValue([schedule]);
      eventRepo.find.mockResolvedValue([
        { id: 'evt-fired', date: new Date('2026-06-04'), startTime: null },
        { id: 'evt-pending', date: new Date('2026-06-05'), startTime: null },
      ]);
      mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 60_000));
      logRepo.findOne.mockImplementation(({ where }: { where: { triggeredEventId: string } }) =>
        Promise.resolve(where.triggeredEventId === 'evt-fired' ? { id: 'log-1' } : null),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(scheduleService.processSchedule).toHaveBeenCalledTimes(1);
      expect(scheduleService.processSchedule).toHaveBeenCalledWith(schedule, NotificationSource.SCHEDULED_BEFORE_EVENT, 'evt-pending');
    });

    it('continues processing remaining events if dispatching one fails', async () => {
      const schedule = makeSchedule(daysRule);
      qb.getMany.mockResolvedValue([schedule]);
      eventRepo.find.mockResolvedValue([
        { id: 'evt-1', date: new Date('2026-06-04'), startTime: null },
        { id: 'evt-2', date: new Date('2026-06-05'), startTime: null },
      ]);
      mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 60_000));
      scheduleService.processSchedule.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ accepted: true });

      await expect(cronService.processDueBeforeEventSchedules()).resolves.toBeUndefined();

      expect(scheduleService.processSchedule).toHaveBeenCalledTimes(2);
    });

    it('continues processing remaining schedules if one fails', async () => {
      const schedules = [makeSchedule(daysRule), makeSchedule(daysRule)];
      qb.getMany.mockResolvedValue(schedules);
      eventRepo.find
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce([{ id: 'evt-1', date: new Date('2026-06-04'), startTime: null }]);
      mockZonedTimeToUtc.mockReturnValue(new Date(FIXED_NOW.getTime() - 60_000));

      await expect(cronService.processDueBeforeEventSchedules()).resolves.toBeUndefined();

      expect(scheduleService.processSchedule).toHaveBeenCalledTimes(1);
    });

    describe('active window (startDate/endDate)', () => {
      it('skips when today is before startDate', async () => {
        qb.getMany.mockResolvedValue([makeSchedule({ ...daysRule, startDate: '2099-01-01' })]);

        await cronService.processDueBeforeEventSchedules();

        expect(eventRepo.find).not.toHaveBeenCalled();
      });

      it('skips when today is after endDate', async () => {
        qb.getMany.mockResolvedValue([makeSchedule({ ...daysRule, endDate: '2020-01-01' })]);

        await cronService.processDueBeforeEventSchedules();

        expect(eventRepo.find).not.toHaveBeenCalled();
      });

      it('proceeds when today is within the window', async () => {
        qb.getMany.mockResolvedValue([makeSchedule({ ...daysRule, startDate: '2020-01-01', endDate: '2099-12-31' })]);
        eventRepo.find.mockResolvedValue([]);

        await cronService.processDueBeforeEventSchedules();

        expect(eventRepo.find).toHaveBeenCalled();
      });
    });
  });
});
