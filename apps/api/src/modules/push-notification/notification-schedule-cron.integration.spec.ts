import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { NotificationLinkType, NotificationScheduleType, NotificationTargetType } from '@muixer/shared';
import { NotificationScheduleCronService } from './notification-schedule-cron.service';
import { NotificationScheduleService } from './notification-schedule.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the ONE_OFF due-schedule sweep. The mocked-repository unit test
 * (notification-schedule-cron.service.spec.ts) stubs `createQueryBuilder` entirely, so it can't
 * catch a raw-SQL mistake in the jsonb `->>'scheduledFor'` expression — which is exactly what
 * happened: an unquoted `s.ruleConfig` reached Postgres as `s.ruleconfig` and errored on every
 * tick, silently leaving every pending schedule stuck at "Pendent" forever.
 */
describe('NotificationScheduleCronService (integration)', () => {
  let db: IntegrationDb;
  let cronService: NotificationScheduleCronService;
  let scheduleRepo: Repository<NotificationSchedule>;
  let sendMock: jest.Mock;

  const makeSchedule = (title: string, scheduledFor: string, isActive = true) =>
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

  beforeAll(async () => {
    db = await setupIntegrationDb();
    sendMock = jest.fn().mockResolvedValue({ accepted: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationScheduleCronService,
        NotificationScheduleService,
        ...realRepositoryProviders(db.dataSource, [NotificationSchedule]),
        { provide: PushNotificationService, useValue: { send: sendMock } },
      ],
    }).compile();

    cronService = module.get(NotificationScheduleCronService);
    scheduleRepo = db.dataSource.getRepository(NotificationSchedule);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
    sendMock.mockClear();
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  it('dispatches a due ONE_OFF schedule and marks it inactive', async () => {
    const due = await scheduleRepo.save(makeSchedule('Due', new Date(Date.now() - 60_000).toISOString()));

    await cronService.processDueOneOffSchedules();

    expect(sendMock).toHaveBeenCalledTimes(1);
    const row = await scheduleRepo.findOneBy({ id: due.id });
    expect(row?.isActive).toBe(false);
  });

  it('leaves a schedule dated in the future untouched', async () => {
    const future = await scheduleRepo.save(makeSchedule('Future', new Date(Date.now() + 3_600_000).toISOString()));

    await cronService.processDueOneOffSchedules();

    expect(sendMock).not.toHaveBeenCalled();
    const row = await scheduleRepo.findOneBy({ id: future.id });
    expect(row?.isActive).toBe(true);
  });

  it('ignores an already-inactive schedule even if its time has passed', async () => {
    await scheduleRepo.save(makeSchedule('Already fired', new Date(Date.now() - 60_000).toISOString(), false));

    await cronService.processDueOneOffSchedules();

    expect(sendMock).not.toHaveBeenCalled();
  });
});
