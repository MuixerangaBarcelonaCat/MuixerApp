import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
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
      repo.findOneBy.mockResolvedValue({ id: 'schedule-1', isActive: true });

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
    it('marks the schedule inactive and dispatches through PushNotificationService with the given source', async () => {
      const schedule = {
        id: 'schedule-2',
        title: 'Actuació',
        body: 'Diumenge',
        linkedEvent: null,
        linkTo: NotificationLinkType.HOME,
        url: null,
        target: { type: NotificationTargetType.ALL },
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
  });
});
