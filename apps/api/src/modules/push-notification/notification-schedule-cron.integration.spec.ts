import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import {
  BeforeEventOffsetUnit,
  EventType,
  NotificationLinkType,
  NotificationScheduleType,
  NotificationSource,
  NotificationTargetType,
} from '@muixer/shared';
import { NotificationScheduleCronService } from './notification-schedule-cron.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { NotificationScheduleNextRunService } from './notification-schedule-next-run.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { Event } from '../event/event.entity';
import { getLocalDayOfWeek, getLocalToday, addDaysToDateOnly } from '../../common/utils/date.util';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the due-schedule sweeps. The mocked-repository unit test
 * (notification-schedule-cron.service.spec.ts) stubs `createQueryBuilder` entirely, so it can't
 * catch a raw-SQL mistake in a jsonb `->>'...'` expression — which is exactly what happened for
 * ONE_OFF: an unquoted `s.ruleConfig` reached Postgres as `s.ruleconfig` and errored on every
 * tick, silently leaving every pending schedule stuck at "Pendent" forever. WEEKLY's sweep uses
 * the same kind of raw jsonb expression (`dayOfWeek`/`timeOfDay`), so it gets the same real-DB
 * coverage rather than trusting it by analogy.
 */
describe('NotificationScheduleCronService (integration)', () => {
  let db: IntegrationDb;
  let cronService: NotificationScheduleCronService;
  let scheduleRepo: Repository<NotificationSchedule>;
  let logRepo: Repository<NotificationLog>;
  let eventRepo: Repository<Event>;
  let sendMock: jest.Mock;

  const makeOneOff = (title: string, scheduledFor: string, isActive = true) =>
    scheduleRepo.create({
      title,
      body: 'Body',
      linkedEvent: null,
      linkTo: NotificationLinkType.HOME,
      url: null,
      target: { type: NotificationTargetType.ALL },
      scheduleType: NotificationScheduleType.ONE_OFF,
      ruleConfig: { scheduledFor },
      isActive,
      createdByUserId: null,
    });

  const makeWeekly = (
    title: string,
    dayOfWeek: number,
    timeOfDay: string,
    options: { isActive?: boolean; startDate?: string; endDate?: string } = {},
  ) =>
    scheduleRepo.create({
      title,
      body: 'Body',
      linkedEvent: null,
      linkTo: NotificationLinkType.HOME,
      url: null,
      target: { type: NotificationTargetType.ALL },
      scheduleType: NotificationScheduleType.WEEKLY,
      ruleConfig: {
        dayOfWeek,
        timeOfDay,
        ...(options.startDate ? { startDate: options.startDate } : {}),
        ...(options.endDate ? { endDate: options.endDate } : {}),
      },
      isActive: options.isActive ?? true,
      createdByUserId: null,
    });

  /** Persists a WEEKLY schedule as if it had been created before today, which is the normal case:
   *  a schedule created after its own send time deliberately waits for next week (see the test
   *  covering that), so every other weekly case has to be backdated to exercise the sweep. */
  const saveWeekly = async (...args: Parameters<typeof makeWeekly>) => {
    const schedule = await scheduleRepo.save(makeWeekly(...args));
    await scheduleRepo.update(schedule.id, { createdAt: new Date(Date.now() - 7 * 24 * 3_600_000) });
    return schedule;
  };

  const makeBeforeEvent = (
    title: string,
    ruleConfig: {
      eventType: EventType;
      offsetUnit: BeforeEventOffsetUnit;
      offsetValue: number;
      timeOfDay?: string;
      startDate?: string;
      endDate?: string;
    },
    isActive = true,
  ) =>
    scheduleRepo.create({
      title,
      body: 'Body',
      linkedEvent: null,
      linkTo: NotificationLinkType.HOME,
      url: null,
      target: { type: NotificationTargetType.ALL },
      scheduleType: NotificationScheduleType.BEFORE_EVENT,
      ruleConfig,
      isActive,
      createdByUserId: null,
    });

  const makeEvent = (eventType: EventType, date: string, startTime: string | null = null) =>
    eventRepo.create({ eventType, title: 'Event', date: new Date(date), startTime });

  beforeAll(async () => {
    db = await setupIntegrationDb();
    sendMock = jest.fn().mockResolvedValue({ accepted: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationScheduleCronService,
        NotificationScheduleService,
        NotificationScheduleNextRunService,
        ...realRepositoryProviders(db.dataSource, [NotificationSchedule, NotificationLog, Event]),
        { provide: PushNotificationService, useValue: { send: sendMock } },
      ],
    }).compile();

    cronService = module.get(NotificationScheduleCronService);
    scheduleRepo = db.dataSource.getRepository(NotificationSchedule);
    logRepo = db.dataSource.getRepository(NotificationLog);
    eventRepo = db.dataSource.getRepository(Event);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
    sendMock.mockClear();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  describe('ONE_OFF', () => {
    it('dispatches a due schedule and marks it inactive', async () => {
      const due = await scheduleRepo.save(makeOneOff('Due', new Date(Date.now() - 60_000).toISOString()));

      await cronService.processDueOneOffSchedules();

      expect(sendMock).toHaveBeenCalledTimes(1);
      const row = await scheduleRepo.findOneBy({ id: due.id });
      expect(row?.isActive).toBe(false);
    });

    it('leaves a schedule dated in the future untouched', async () => {
      const future = await scheduleRepo.save(makeOneOff('Future', new Date(Date.now() + 3_600_000).toISOString()));

      await cronService.processDueOneOffSchedules();

      expect(sendMock).not.toHaveBeenCalled();
      const row = await scheduleRepo.findOneBy({ id: future.id });
      expect(row?.isActive).toBe(true);
    });

    it('ignores an already-inactive schedule even if its time has passed', async () => {
      await scheduleRepo.save(makeOneOff('Already fired', new Date(Date.now() - 60_000).toISOString(), false));

      await cronService.processDueOneOffSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('WEEKLY', () => {
    const today = getLocalDayOfWeek();
    const otherDay = (today + 1) % 7;

    it('dispatches a schedule due today whose time has passed, and leaves it active', async () => {
      const due = await saveWeekly('Weekly', today, '00:00');

      await cronService.processDueWeeklySchedules();

      expect(sendMock).toHaveBeenCalledTimes(1);
      const row = await scheduleRepo.findOneBy({ id: due.id });
      expect(row?.isActive).toBe(true);
    });

    it('does not dispatch a schedule created later today than its own send time', async () => {
      // Saved just now, with a send time of 00:00: its first send belongs to next week, which is
      // also what the Dashboard's "next run" column shows.
      await scheduleRepo.save(makeWeekly('Weekly', today, '00:00'));

      await cronService.processDueWeeklySchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not dispatch a schedule for a different day of week', async () => {
      await saveWeekly('Weekly', otherDay, '00:00');

      await cronService.processDueWeeklySchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not dispatch a schedule whose time has not come yet today', async () => {
      await saveWeekly('Weekly', today, '23:59');

      await cronService.processDueWeeklySchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips a schedule already dispatched earlier today', async () => {
      const schedule = await saveWeekly('Weekly', today, '00:00');
      await logRepo.save(
        logRepo.create({
          title: 'Weekly',
          body: 'Body',
          url: null,
          target: { type: NotificationTargetType.ALL },
          recipientCount: 1,
          source: NotificationSource.SCHEDULED_WEEKLY,
          scheduleId: schedule.id,
        }),
      );

      await cronService.processDueWeeklySchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('dispatches again if the last dispatch for this schedule was on a previous day', async () => {
      const schedule = await saveWeekly('Weekly', today, '00:00');
      const yesterdayLog = await logRepo.save(
        logRepo.create({
          title: 'Weekly',
          body: 'Body',
          url: null,
          target: { type: NotificationTargetType.ALL },
          recipientCount: 1,
          source: NotificationSource.SCHEDULED_WEEKLY,
          scheduleId: schedule.id,
        }),
      );
      await logRepo.update(yesterdayLog.id, { sentAt: new Date(Date.now() - 24 * 3_600_000) });

      await cronService.processDueWeeklySchedules();

      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    describe('active window (startDate/endDate)', () => {
      it('dispatches when today is within the window', async () => {
        await saveWeekly('Weekly', today, '00:00', { startDate: '2020-01-01', endDate: '2099-12-31' });

        await cronService.processDueWeeklySchedules();

        expect(sendMock).toHaveBeenCalledTimes(1);
      });

      it('skips when today is before startDate', async () => {
        await saveWeekly('Weekly', today, '00:00', { startDate: '2099-01-01' });

        await cronService.processDueWeeklySchedules();

        expect(sendMock).not.toHaveBeenCalled();
      });

      it('skips when today is after endDate', async () => {
        await saveWeekly('Weekly', today, '00:00', { endDate: '2020-01-01' });

        await cronService.processDueWeeklySchedules();

        expect(sendMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('BEFORE_EVENT', () => {
    it('dispatches for a matching event whose DAYS-offset fire instant has passed, and leaves the schedule active', async () => {
      const eventDate = addDaysToDateOnly(getLocalToday(), 3);
      const event = await eventRepo.save(makeEvent(EventType.ACTUACIO, eventDate));
      const schedule = await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '00:00' }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ triggeredEventId: event.id }));
      const row = await scheduleRepo.findOneBy({ id: schedule.id });
      expect(row?.isActive).toBe(true);
    });

    it('does not dispatch when the DAYS-offset fire time has not come yet today', async () => {
      const eventDate = addDaysToDateOnly(getLocalToday(), 3);
      await eventRepo.save(makeEvent(EventType.ACTUACIO, eventDate));
      await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '23:59' }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not dispatch for an event of a different eventType', async () => {
      const eventDate = addDaysToDateOnly(getLocalToday(), 3);
      await eventRepo.save(makeEvent(EventType.ASSAIG, eventDate));
      await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '00:00' }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not dispatch for an HOURS-offset schedule when the event has no startTime', async () => {
      await eventRepo.save(makeEvent(EventType.ACTUACIO, getLocalToday(), null));
      await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 1 }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('dispatches for an HOURS-offset schedule once the event start time minus the offset has passed', async () => {
      // Tomorrow at 00:30 minus a 24h offset is today at 00:30 — past for this test run, while the
      // event itself is still ahead.
      const event = await eventRepo.save(makeEvent(EventType.ACTUACIO, addDaysToDateOnly(getLocalToday(), 1), '00:30'));
      await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 24 }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ triggeredEventId: event.id }));
    });

    it('does not dispatch for an HOURS-offset schedule before the offset has elapsed', async () => {
      const tomorrow = addDaysToDateOnly(getLocalToday(), 1);
      await eventRepo.save(makeEvent(EventType.ACTUACIO, tomorrow, '12:00'));
      await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 1 }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not dispatch a reminder for an event that has already started', async () => {
      // Today at 00:30, so both the event start and the fire instant are behind us: the reminder
      // is late and must be dropped rather than sent after the event began.
      await eventRepo.save(makeEvent(EventType.ACTUACIO, getLocalToday(), '00:30'));
      await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 1 }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips an (schedule, event) pair already dispatched', async () => {
      const eventDate = addDaysToDateOnly(getLocalToday(), 3);
      const event = await eventRepo.save(makeEvent(EventType.ACTUACIO, eventDate));
      const schedule = await scheduleRepo.save(
        makeBeforeEvent('Before', { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '00:00' }),
      );
      await logRepo.save(
        logRepo.create({
          title: 'Before',
          body: 'Body',
          url: null,
          target: { type: NotificationTargetType.ALL },
          recipientCount: 1,
          source: NotificationSource.SCHEDULED_BEFORE_EVENT,
          scheduleId: schedule.id,
          triggeredEventId: event.id,
        }),
      );

      await cronService.processDueBeforeEventSchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    describe('active window (startDate/endDate)', () => {
      it('skips when today is before startDate', async () => {
        const eventDate = addDaysToDateOnly(getLocalToday(), 3);
        await eventRepo.save(makeEvent(EventType.ACTUACIO, eventDate));
        await scheduleRepo.save(
          makeBeforeEvent('Before', {
            eventType: EventType.ACTUACIO,
            offsetUnit: BeforeEventOffsetUnit.DAYS,
            offsetValue: 3,
            timeOfDay: '00:00',
            startDate: '2099-01-01',
          }),
        );

        await cronService.processDueBeforeEventSchedules();

        expect(sendMock).not.toHaveBeenCalled();
      });

      it('skips when today is after endDate', async () => {
        const eventDate = addDaysToDateOnly(getLocalToday(), 3);
        await eventRepo.save(makeEvent(EventType.ACTUACIO, eventDate));
        await scheduleRepo.save(
          makeBeforeEvent('Before', {
            eventType: EventType.ACTUACIO,
            offsetUnit: BeforeEventOffsetUnit.DAYS,
            offsetValue: 3,
            timeOfDay: '00:00',
            endDate: '2020-01-01',
          }),
        );

        await cronService.processDueBeforeEventSchedules();

        expect(sendMock).not.toHaveBeenCalled();
      });
    });
  });
});
