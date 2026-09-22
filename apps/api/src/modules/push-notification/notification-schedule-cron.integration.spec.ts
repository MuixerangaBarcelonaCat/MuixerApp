import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { NotificationLinkType, NotificationScheduleType, NotificationSource, NotificationTargetType } from '@muixer/shared';
import { NotificationScheduleCronService } from './notification-schedule-cron.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { getLocalDayOfWeek } from '../../common/utils/date.util';
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

  beforeAll(async () => {
    db = await setupIntegrationDb();
    sendMock = jest.fn().mockResolvedValue({ accepted: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationScheduleCronService,
        NotificationScheduleService,
        ...realRepositoryProviders(db.dataSource, [NotificationSchedule, NotificationLog]),
        { provide: PushNotificationService, useValue: { send: sendMock } },
      ],
    }).compile();

    cronService = module.get(NotificationScheduleCronService);
    scheduleRepo = db.dataSource.getRepository(NotificationSchedule);
    logRepo = db.dataSource.getRepository(NotificationLog);
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
      const due = await scheduleRepo.save(makeWeekly('Weekly', today, '00:00'));

      await cronService.processDueWeeklySchedules();

      expect(sendMock).toHaveBeenCalledTimes(1);
      const row = await scheduleRepo.findOneBy({ id: due.id });
      expect(row?.isActive).toBe(true);
    });

    it('does not dispatch a schedule for a different day of week', async () => {
      await scheduleRepo.save(makeWeekly('Weekly', otherDay, '00:00'));

      await cronService.processDueWeeklySchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not dispatch a schedule whose time has not come yet today', async () => {
      await scheduleRepo.save(makeWeekly('Weekly', today, '23:59'));

      await cronService.processDueWeeklySchedules();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('skips a schedule already dispatched earlier today', async () => {
      const schedule = await scheduleRepo.save(makeWeekly('Weekly', today, '00:00'));
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
      const schedule = await scheduleRepo.save(makeWeekly('Weekly', today, '00:00'));
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
        await scheduleRepo.save(makeWeekly('Weekly', today, '00:00', { startDate: '2020-01-01', endDate: '2099-12-31' }));

        await cronService.processDueWeeklySchedules();

        expect(sendMock).toHaveBeenCalledTimes(1);
      });

      it('skips when today is before startDate', async () => {
        await scheduleRepo.save(makeWeekly('Weekly', today, '00:00', { startDate: '2099-01-01' }));

        await cronService.processDueWeeklySchedules();

        expect(sendMock).not.toHaveBeenCalled();
      });

      it('skips when today is after endDate', async () => {
        await scheduleRepo.save(makeWeekly('Weekly', today, '00:00', { endDate: '2020-01-01' }));

        await cronService.processDueWeeklySchedules();

        expect(sendMock).not.toHaveBeenCalled();
      });
    });
  });
});
