import { Test, TestingModule } from '@nestjs/testing';
import { JwtPayload, NotificationLinkType, NotificationScheduleType, NotificationTargetType, UserRole } from '@muixer/shared';
import { NotificationScheduleController } from './notification-schedule.controller';
import { NotificationScheduleService } from './notification-schedule.service';
import { CreateNotificationScheduleDto } from './dto/create-notification-schedule.dto';
import { UpdateNotificationScheduleDto } from './dto/update-notification-schedule.dto';

const CURRENT_USER: JwtPayload = { sub: 'user-1', email: 'admin@example.com', role: UserRole.ADMIN };

const mockScheduleService = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), cancel: jest.fn() };

describe('NotificationScheduleController', () => {
  let controller: NotificationScheduleController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationScheduleController],
      providers: [{ provide: NotificationScheduleService, useValue: mockScheduleService }],
    }).compile();

    controller = module.get(NotificationScheduleController);
  });

  describe('create', () => {
    it('delegates to the service with the current user id', async () => {
      const dto: CreateNotificationScheduleDto = Object.assign(new CreateNotificationScheduleDto(), {
        title: 'Assaig',
        body: 'Dijous a les 20h',
        linkTo: NotificationLinkType.HOME,
        target: { type: NotificationTargetType.ALL },
        scheduleType: NotificationScheduleType.ONE_OFF,
        oneOff: { scheduledFor: '2026-06-01T18:00:00.000Z' },
      });
      mockScheduleService.create.mockResolvedValue({ id: 'schedule-1' });

      const result = await controller.create(dto, CURRENT_USER);

      expect(mockScheduleService.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual({ id: 'schedule-1' });
    });
  });

  describe('findAll', () => {
    it('delegates to the service with the query filter', async () => {
      const response = { data: [], meta: { total: 0, page: 1, limit: 25 } };
      mockScheduleService.findAll.mockResolvedValue(response);

      const result = await controller.findAll({ page: 1, limit: 25 });

      expect(mockScheduleService.findAll).toHaveBeenCalledWith({ page: 1, limit: 25 });
      expect(result).toBe(response);
    });
  });

  describe('findOne', () => {
    it('delegates to the service', async () => {
      mockScheduleService.findOne.mockResolvedValue({ id: 'schedule-1' });

      const result = await controller.findOne('schedule-1');

      expect(mockScheduleService.findOne).toHaveBeenCalledWith('schedule-1');
      expect(result).toEqual({ id: 'schedule-1' });
    });
  });

  describe('update', () => {
    it('delegates to the service', async () => {
      const dto = Object.assign(new UpdateNotificationScheduleDto(), { title: 'New title' });
      mockScheduleService.update.mockResolvedValue({ id: 'schedule-1', title: 'New title' });

      const result = await controller.update('schedule-1', dto);

      expect(mockScheduleService.update).toHaveBeenCalledWith('schedule-1', dto);
      expect(result).toEqual({ id: 'schedule-1', title: 'New title' });
    });
  });

  describe('cancel', () => {
    it('delegates to the service', async () => {
      await controller.cancel('schedule-1');
      expect(mockScheduleService.cancel).toHaveBeenCalledWith('schedule-1');
    });
  });
});
