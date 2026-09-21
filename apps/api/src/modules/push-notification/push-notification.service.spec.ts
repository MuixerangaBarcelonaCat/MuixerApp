import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PushNotificationService } from './push-notification.service';
import { PushSenderService } from './push-sender.service';
import { PushSubscriptionService } from './push-subscription.service';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { NotificationTargetType } from '@muixer/shared';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushRequestedEvent } from './events/push-requested.event';

const makeDto = (targetType: NotificationTargetType = NotificationTargetType.ALL, overrides = {}): SendNotificationDto => {
  const dto = new SendNotificationDto();
  dto.title = 'Test title';
  dto.body = 'Test body';
  dto.target = { type: targetType, ...overrides };
  return dto;
};

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let subscriptionService: jest.Mocked<PushSubscriptionService>;
  let senderService: jest.Mocked<PushSenderService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: getRepositoryToken(Attendance),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: PushSubscriptionService,
          useValue: {
            findActiveByUserIds: jest.fn(),
            markUsedMany: jest.fn(),
            deactivateMany: jest.fn(),
            findUserIdsWithActiveSubscriptions: jest.fn(),
          },
        },
        {
          provide: PushSenderService,
          useValue: { send: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PushNotificationService);
    eventEmitter = module.get(EventEmitter2);
    subscriptionService = module.get(PushSubscriptionService);
    senderService = module.get(PushSenderService);
  });

  describe('send (ALL target)', () => {
    it('emits push.requested event and returns accepted', async () => {
      const result = await service.send(makeDto(NotificationTargetType.ALL));
      expect(eventEmitter.emit).toHaveBeenCalledWith('push.requested', expect.any(PushRequestedEvent));
      expect(result.accepted).toBe(true);
    });

    it('returns warning when no users found', async () => {
      const userRepo = { find: jest.fn().mockResolvedValue([]) };
      // Rebuild with empty userRepo
      const module = await Test.createTestingModule({
        providers: [
          PushNotificationService,
          { provide: getRepositoryToken(Attendance), useValue: { createQueryBuilder: jest.fn() } },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: PushSubscriptionService, useValue: subscriptionService },
          { provide: PushSenderService, useValue: senderService },
          { provide: EventEmitter2, useValue: eventEmitter },
        ],
      }).compile();
      const svcEmpty = module.get(PushNotificationService);
      const result = await svcEmpty.send(makeDto(NotificationTargetType.ALL));
      expect(result.warning).toBeDefined();
    });
  });

  describe('handlePushRequested', () => {
    it('marks subscription as used on success', async () => {
      const subs = [{ id: 'sub-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: { p256dh: 'a', auth: 'b' } }];
      subscriptionService.findActiveByUserIds.mockResolvedValue(subs as never);
      senderService.send.mockResolvedValue({ success: true, statusCode: 201 });

      await service.handlePushRequested(new PushRequestedEvent(['u1'], { title: 'T', body: 'B' }));

      expect(subscriptionService.markUsedMany).toHaveBeenCalledWith(['sub-1']);
    });

    it('deactivates subscription on 410 Gone', async () => {
      const subs = [{ id: 'sub-gone', endpoint: 'https://fcm.googleapis.com/push/2', keys: { p256dh: 'a', auth: 'b' } }];
      subscriptionService.findActiveByUserIds.mockResolvedValue(subs as never);
      senderService.send.mockResolvedValue({ success: false, statusCode: 410, gone: true });

      await service.handlePushRequested(new PushRequestedEvent(['u1'], { title: 'T', body: 'B' }));

      expect(subscriptionService.deactivateMany).toHaveBeenCalledWith(['sub-gone']);
    });

    it('writes the bookkeeping of a whole fan-out as one call per outcome, not one per device', async () => {
      const subs = Array.from({ length: 50 }, (_, i) => ({
        id: `sub-${i}`,
        endpoint: `https://fcm.googleapis.com/push/${i}`,
        keys: { p256dh: 'a', auth: 'b' },
      }));
      subscriptionService.findActiveByUserIds.mockResolvedValue(subs as never);
      senderService.send.mockImplementation((sub: { id: string }) =>
        Promise.resolve(
          sub.id === 'sub-7' ? { success: false, statusCode: 410, gone: true } : { success: true, statusCode: 201 },
        ),
      );

      await service.handlePushRequested(new PushRequestedEvent(['u1'], { title: 'T', body: 'B' }));

      expect(subscriptionService.markUsedMany).toHaveBeenCalledTimes(1);
      expect(subscriptionService.deactivateMany).toHaveBeenCalledTimes(1);
      expect(subscriptionService.markUsedMany.mock.calls[0][0]).toHaveLength(49);
      expect(subscriptionService.deactivateMany).toHaveBeenCalledWith(['sub-7']);
    });
  });
});
