import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BeforeEventOffsetUnit,
  EventType,
  NotificationLinkType,
  NotificationScheduleType,
  NotificationSource,
  NotificationTargetType,
} from '@muixer/shared';
import { NotificationScheduleService } from './notification-schedule.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { CreateNotificationScheduleDto } from './dto/create-notification-schedule.dto';
import { UpdateNotificationScheduleDto } from './dto/update-notification-schedule.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

const FIXED_NOW = new Date('2026-01-01T12:00:00.000Z');

const makeCreateDto = (overrides: Partial<CreateNotificationScheduleDto> = {}): CreateNotificationScheduleDto =>
  Object.assign(new CreateNotificationScheduleDto(), {
    title: 'Assaig',
    body: 'Dijous a les 20h',
    linkTo: NotificationLinkType.HOME,
    target: { type: NotificationTargetType.ALL },
    scheduleType: NotificationScheduleType.ONE_OFF,
    oneOff: { scheduledFor: '2026-06-01T18:00:00.000Z' },
    ...overrides,
  });

describe('NotificationScheduleService', () => {
  let service: NotificationScheduleService;
  let repo: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock; findOneBy: jest.Mock; update: jest.Mock };
  let notificationService: jest.Mocked<Pick<PushNotificationService, 'send'>>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);

    repo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'schedule-1', ...data })),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    notificationService = { send: jest.fn().mockResolvedValue({ accepted: true }) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationScheduleService,
        { provide: getRepositoryToken(NotificationSchedule), useValue: repo },
        { provide: PushNotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get(NotificationScheduleService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('persists a schedule with isActive true and the given ruleConfig', async () => {
      const result = await service.create(makeCreateDto(), 'user-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Assaig',
          isActive: true,
          scheduleType: NotificationScheduleType.ONE_OFF,
          ruleConfig: { scheduledFor: '2026-06-01T18:00:00.000Z' },
          createdByUserId: 'user-1',
        }),
      );
      expect(result.id).toBe('schedule-1');
    });

    it('rejects a scheduledFor in the past', async () => {
      await expect(
        service.create(makeCreateDto({ oneOff: { scheduledFor: '2020-01-01T00:00:00.000Z' } }), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('persists a WEEKLY schedule with its dayOfWeek/timeOfDay ruleConfig', async () => {
      await service.create(
        makeCreateDto({ scheduleType: NotificationScheduleType.WEEKLY, oneOff: undefined, weekly: { dayOfWeek: 1, timeOfDay: '18:00' } }),
        'user-1',
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.WEEKLY,
          ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
        }),
      );
    });

    it('persists startDate/endDate when given on a WEEKLY schedule', async () => {
      await service.create(
        makeCreateDto({
          scheduleType: NotificationScheduleType.WEEKLY,
          oneOff: undefined,
          weekly: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
        }),
        'user-1',
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
        }),
      );
    });

    it('omits startDate/endDate from ruleConfig when not given', async () => {
      await service.create(
        makeCreateDto({ scheduleType: NotificationScheduleType.WEEKLY, oneOff: undefined, weekly: { dayOfWeek: 1, timeOfDay: '18:00' } }),
        'user-1',
      );

      const savedArg = repo.save.mock.calls[0][0];
      expect(savedArg.ruleConfig).toEqual({ dayOfWeek: 1, timeOfDay: '18:00' });
    });

    it('rejects a WEEKLY schedule whose endDate is before its startDate', async () => {
      await expect(
        service.create(
          makeCreateDto({
            scheduleType: NotificationScheduleType.WEEKLY,
            oneOff: undefined,
            weekly: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-12-31', endDate: '2026-06-01' },
          }),
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('accepts a WEEKLY schedule whose endDate equals its startDate', async () => {
      await service.create(
        makeCreateDto({
          scheduleType: NotificationScheduleType.WEEKLY,
          oneOff: undefined,
          weekly: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-06-01' },
        }),
        'user-1',
      );

      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects a WEEKLY schedule without a weekly config', async () => {
      await expect(
        service.create(makeCreateDto({ scheduleType: NotificationScheduleType.WEEKLY, oneOff: undefined }), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('persists a BEFORE_EVENT/DAYS schedule with its eventType/offset/timeOfDay ruleConfig', async () => {
      await service.create(
        makeCreateDto({
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          oneOff: undefined,
          beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
        }),
        'user-1',
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          ruleConfig: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
        }),
      );
    });

    it('persists a BEFORE_EVENT/HOURS schedule without a timeOfDay in its ruleConfig', async () => {
      await service.create(
        makeCreateDto({
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          oneOff: undefined,
          beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 3 },
        }),
        'user-1',
      );

      const savedArg = repo.save.mock.calls[0][0];
      expect(savedArg.ruleConfig).toEqual({ eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 3 });
    });

    it('persists startDate/endDate when given on a BEFORE_EVENT schedule', async () => {
      await service.create(
        makeCreateDto({
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          oneOff: undefined,
          beforeEvent: {
            eventType: EventType.ACTUACIO,
            offsetUnit: BeforeEventOffsetUnit.DAYS,
            offsetValue: 3,
            timeOfDay: '09:00',
            startDate: '2026-06-01',
            endDate: '2026-12-31',
          },
        }),
        'user-1',
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleConfig: {
            eventType: EventType.ACTUACIO,
            offsetUnit: BeforeEventOffsetUnit.DAYS,
            offsetValue: 3,
            timeOfDay: '09:00',
            startDate: '2026-06-01',
            endDate: '2026-12-31',
          },
        }),
      );
    });

    it('rejects a BEFORE_EVENT schedule whose endDate is before its startDate', async () => {
      await expect(
        service.create(
          makeCreateDto({
            scheduleType: NotificationScheduleType.BEFORE_EVENT,
            oneOff: undefined,
            beforeEvent: {
              eventType: EventType.ACTUACIO,
              offsetUnit: BeforeEventOffsetUnit.DAYS,
              offsetValue: 3,
              timeOfDay: '09:00',
              startDate: '2026-12-31',
              endDate: '2026-06-01',
            },
          }),
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a BEFORE_EVENT schedule without a beforeEvent config', async () => {
      await expect(
        service.create(
          makeCreateDto({ scheduleType: NotificationScheduleType.BEFORE_EVENT, oneOff: undefined }),
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('paginates and returns the meta envelope', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 's1' }], 1]);

      const result = await service.findAll({ page: 1, limit: 25 });

      expect(result).toEqual({ data: [{ id: 's1' }], meta: { total: 1, page: 1, limit: 25 } });
    });

    it('filters by isActive when provided', async () => {
      await service.findAll({ isActive: true, page: 1, limit: 25 });

      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    });
  });

  describe('findOne', () => {
    it('returns the schedule when found', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', title: 'Assaig' });

      const result = await service.findOne('schedule-1');

      expect(result).toEqual({ id: 'schedule-1', title: 'Assaig' });
    });

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges the given fields into a pending schedule and saves it', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true, title: 'Old title' });

      await service.update('schedule-1', Object.assign(new UpdateNotificationScheduleDto(), { title: 'New title' }));

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'schedule-1', title: 'New title' }));
    });

    it('updates the ruleConfig when a new oneOff is given', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.ONE_OFF,
        ruleConfig: { scheduledFor: '2026-06-01T18:00:00.000Z' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), { oneOff: { scheduledFor: '2026-07-01T18:00:00.000Z' } }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ruleConfig: { scheduledFor: '2026-07-01T18:00:00.000Z' } }),
      );
    });

    it('rejects a new scheduledFor in the past', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true, scheduleType: NotificationScheduleType.ONE_OFF });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), { oneOff: { scheduledFor: '2020-01-01T00:00:00.000Z' } }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.update('missing', new UpdateNotificationScheduleDto())).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the schedule is no longer active', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: false });

      await expect(service.update('schedule-1', new UpdateNotificationScheduleDto())).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('updates the ruleConfig when a new weekly config is given', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), { weekly: { dayOfWeek: 2, timeOfDay: '09:00' } }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ruleConfig: { dayOfWeek: 2, timeOfDay: '09:00' } }),
      );
    });

    it('updates startDate/endDate when given on a WEEKLY schedule', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), {
          weekly: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
        }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-06-01', endDate: '2026-12-31' },
        }),
      );
    });

    it('rejects updating a WEEKLY schedule with an endDate before its startDate', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), {
            weekly: { dayOfWeek: 1, timeOfDay: '18:00', startDate: '2026-12-31', endDate: '2026-06-01' },
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a weekly config for a ONE_OFF schedule', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true, scheduleType: NotificationScheduleType.ONE_OFF });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), { weekly: { dayOfWeek: 2, timeOfDay: '09:00' } }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a oneOff config for a WEEKLY schedule', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true, scheduleType: NotificationScheduleType.WEEKLY });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), { oneOff: { scheduledFor: '2026-07-01T18:00:00.000Z' } }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('updates the ruleConfig when a new beforeEvent config is given', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.BEFORE_EVENT,
        ruleConfig: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), {
          beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 2 },
        }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleConfig: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.HOURS, offsetValue: 2 },
        }),
      );
    });

    it('rejects updating a BEFORE_EVENT schedule with an endDate before its startDate', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.BEFORE_EVENT,
        ruleConfig: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
      });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), {
            beforeEvent: {
              eventType: EventType.ACTUACIO,
              offsetUnit: BeforeEventOffsetUnit.DAYS,
              offsetValue: 3,
              timeOfDay: '09:00',
              startDate: '2026-12-31',
              endDate: '2026-06-01',
            },
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a beforeEvent config for a WEEKLY schedule', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true, scheduleType: NotificationScheduleType.WEEKLY });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), {
            beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows switching a WEEKLY schedule to BEFORE_EVENT when scheduleType and beforeEvent are both given', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), {
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          beforeEvent: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
        }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.BEFORE_EVENT,
          ruleConfig: { eventType: EventType.ACTUACIO, offsetUnit: BeforeEventOffsetUnit.DAYS, offsetValue: 3, timeOfDay: '09:00' },
        }),
      );
    });

    it('rejects switching to BEFORE_EVENT without also giving beforeEvent', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), { scheduleType: NotificationScheduleType.BEFORE_EVENT }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows switching a WEEKLY schedule to ONE_OFF when scheduleType and oneOff are both given', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), {
          scheduleType: NotificationScheduleType.ONE_OFF,
          oneOff: { scheduledFor: '2026-07-01T18:00:00.000Z' },
        }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.ONE_OFF,
          ruleConfig: { scheduledFor: '2026-07-01T18:00:00.000Z' },
        }),
      );
    });

    it('allows switching a ONE_OFF schedule to WEEKLY when scheduleType and weekly are both given', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.ONE_OFF,
        ruleConfig: { scheduledFor: '2026-06-01T18:00:00.000Z' },
      });

      await service.update(
        'schedule-1',
        Object.assign(new UpdateNotificationScheduleDto(), {
          scheduleType: NotificationScheduleType.WEEKLY,
          weekly: { dayOfWeek: 3, timeOfDay: '09:00' },
        }),
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.WEEKLY,
          ruleConfig: { dayOfWeek: 3, timeOfDay: '09:00' },
        }),
      );
    });

    it('rejects switching to ONE_OFF without also giving oneOff', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.WEEKLY,
        ruleConfig: { dayOfWeek: 1, timeOfDay: '18:00' },
      });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), { scheduleType: NotificationScheduleType.ONE_OFF }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects switching to WEEKLY without also giving weekly', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 'schedule-1',
        isActive: true,
        scheduleType: NotificationScheduleType.ONE_OFF,
        ruleConfig: { scheduledFor: '2026-06-01T18:00:00.000Z' },
      });

      await expect(
        service.update(
          'schedule-1',
          Object.assign(new UpdateNotificationScheduleDto(), { scheduleType: NotificationScheduleType.WEEKLY }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('sets isActive to false for a pending schedule', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true });

      await service.cancel('schedule-1');

      expect(repo.update).toHaveBeenCalledWith('schedule-1', { isActive: false });
    });

    it('throws NotFoundException for an unknown id', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.cancel('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when already inactive', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: false });

      await expect(service.cancel('schedule-1')).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('sendNow', () => {
    it('creates a ONE_OFF schedule scheduled for the current moment and dispatches it synchronously with source MANUAL', async () => {
      const dto = Object.assign(new SendNotificationDto(), {
        title: 'Assaig',
        body: 'Dijous a les 20h',
        linkTo: NotificationLinkType.HOME,
        target: { type: NotificationTargetType.ALL },
      });

      const result = await service.sendNow(dto, 'user-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleType: NotificationScheduleType.ONE_OFF,
          ruleConfig: { scheduledFor: FIXED_NOW.toISOString() },
          createdByUserId: 'user-1',
        }),
      );
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Assaig', body: 'Dijous a les 20h' }),
        expect.objectContaining({ source: NotificationSource.MANUAL, scheduleId: 'schedule-1', triggeredByUserId: 'user-1' }),
      );
      expect(repo.update).toHaveBeenCalledWith('schedule-1', { isActive: false });
      expect(result).toEqual({ accepted: true });
    });
  });

  describe('processSchedule', () => {
    it('marks a ONE_OFF schedule inactive and dispatches through PushNotificationService with the given source', async () => {
      const schedule = {
        id: 'schedule-2',
        title: 'Actuació',
        body: 'Diumenge',
        linkedEvent: null,
        linkTo: NotificationLinkType.HOME,
        url: null,
        target: { type: NotificationTargetType.ALL },
        scheduleType: NotificationScheduleType.ONE_OFF,
        createdByUserId: 'user-2',
      } as NotificationSchedule;

      const result = await service.processSchedule(schedule, NotificationSource.SCHEDULED_ONE_OFF);

      expect(repo.update).toHaveBeenCalledWith('schedule-2', { isActive: false });
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Actuació', body: 'Diumenge' }),
        { source: NotificationSource.SCHEDULED_ONE_OFF, scheduleId: 'schedule-2', triggeredByUserId: 'user-2' },
      );
      expect(result).toEqual({ accepted: true });
    });

    it('leaves a WEEKLY schedule active — it recurs, so it must not be deactivated after firing', async () => {
      const schedule = {
        id: 'schedule-3',
        title: 'Recordatori setmanal',
        body: 'Cada dilluns',
        linkedEvent: null,
        linkTo: NotificationLinkType.HOME,
        url: null,
        target: { type: NotificationTargetType.ALL },
        scheduleType: NotificationScheduleType.WEEKLY,
        createdByUserId: 'user-2',
      } as NotificationSchedule;

      await service.processSchedule(schedule, NotificationSource.SCHEDULED_WEEKLY);

      expect(repo.update).not.toHaveBeenCalled();
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Recordatori setmanal' }),
        { source: NotificationSource.SCHEDULED_WEEKLY, scheduleId: 'schedule-3', triggeredByUserId: 'user-2' },
      );
    });

    it('leaves a BEFORE_EVENT schedule active and passes the triggering event id through to send()', async () => {
      const schedule = {
        id: 'schedule-4',
        title: 'Abans de l’actuació',
        body: 'Diumenge',
        linkedEvent: { kind: 'TRIGGERING_EVENT' },
        linkTo: NotificationLinkType.HOME,
        url: null,
        target: { type: NotificationTargetType.ALL },
        scheduleType: NotificationScheduleType.BEFORE_EVENT,
        createdByUserId: 'user-2',
      } as NotificationSchedule;

      await service.processSchedule(schedule, NotificationSource.SCHEDULED_BEFORE_EVENT, 'evt-1');

      expect(repo.update).not.toHaveBeenCalled();
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Abans de l’actuació' }),
        {
          source: NotificationSource.SCHEDULED_BEFORE_EVENT,
          scheduleId: 'schedule-4',
          triggeredByUserId: 'user-2',
          triggeredEventId: 'evt-1',
        },
      );
    });
  });
});
