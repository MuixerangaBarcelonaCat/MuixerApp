import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, NotificationSource, NotificationTargetType, UserRole } from '@muixer/shared';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import { PushSubscriptionService } from './push-subscription.service';
import { NotificationLogService } from './notification-log.service';
import { SendNotificationDto } from './dto/send-notification.dto';

const CURRENT_USER: JwtPayload = { sub: 'user-1', email: 'admin@example.com', role: UserRole.ADMIN };

const mockNotificationService = { send: jest.fn() };
const mockSubscriptionService = { getSummary: jest.fn() };
const mockLogService = { findAll: jest.fn() };
const mockConfig = { get: jest.fn() };

describe('PushNotificationController', () => {
  let controller: PushNotificationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushNotificationController],
      providers: [
        { provide: PushNotificationService, useValue: mockNotificationService },
        { provide: PushSubscriptionService, useValue: mockSubscriptionService },
        { provide: NotificationLogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get(PushNotificationController);
  });

  describe('send', () => {
    it('delegates to the service with the current user id', async () => {
      mockNotificationService.send.mockResolvedValue({ accepted: true });
      const dto: SendNotificationDto = Object.assign(new SendNotificationDto(), {
        title: 'Assaig',
        body: 'Dijous a les 20h',
        target: { type: NotificationTargetType.ALL },
      });

      const result = await controller.send(dto, CURRENT_USER);

      expect(mockNotificationService.send).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual({ accepted: true });
    });
  });

  describe('getHistory', () => {
    it('delegates to NotificationLogService.findAll with the query filter', async () => {
      const response = { data: [], meta: { total: 0, page: 1, limit: 25 } };
      mockLogService.findAll.mockResolvedValue(response);

      const result = await controller.getHistory({ source: NotificationSource.MANUAL, page: 1, limit: 25 });

      expect(mockLogService.findAll).toHaveBeenCalledWith({ source: NotificationSource.MANUAL, page: 1, limit: 25 });
      expect(result).toBe(response);
    });
  });
});
