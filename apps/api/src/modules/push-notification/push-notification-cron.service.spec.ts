import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PushNotificationCronService } from './push-notification-cron.service';
import { PushSubscriptionService } from './push-subscription.service';
import { News } from '../news/news.entity';

const makeNews = (overrides = {}): News =>
  ({
    id: 'news-1',
    title: 'Assaig divendres',
    body: 'Us esperem a les 21h',
    sendPush: true,
    pushSentAt: null,
    publishedAt: new Date('2026-08-01'),
    ...overrides,
  }) as News;

describe('PushNotificationCronService', () => {
  let service: PushNotificationCronService;
  let newsRepo: { find: jest.Mock; update: jest.Mock };
  let subscriptionService: jest.Mocked<Pick<PushSubscriptionService, 'findAllActiveSubscriptions' | 'cleanupStale'>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    newsRepo = { find: jest.fn(), update: jest.fn() };
    subscriptionService = {
      findAllActiveSubscriptions: jest.fn(),
      cleanupStale: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;

    const module = await Test.createTestingModule({
      providers: [
        PushNotificationCronService,
        { provide: getRepositoryToken(News), useValue: newsRepo },
        { provide: PushSubscriptionService, useValue: subscriptionService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(PushNotificationCronService);
  });

  describe('processScheduledNews', () => {
    it('does nothing when no pending news', async () => {
      newsRepo.find.mockResolvedValue([]);
      await service.processScheduledNews();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('sets pushSentAt before emitting to prevent double dispatch', async () => {
      const news = makeNews();
      newsRepo.find.mockResolvedValue([news]);
      newsRepo.update.mockResolvedValue({ affected: 1 });
      subscriptionService.findAllActiveSubscriptions.mockResolvedValue([
        { id: 'sub-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: { p256dh: 'a', auth: 'b' }, userId: 'u1' } as never,
      ]);

      await service.processScheduledNews();

      expect(newsRepo.update).toHaveBeenCalledWith(news.id, { pushSentAt: expect.any(Date) });
      expect(eventEmitter.emit).toHaveBeenCalledWith('push.requested', expect.anything());
    });

    it('skips emit when no active subscriptions', async () => {
      newsRepo.find.mockResolvedValue([makeNews()]);
      newsRepo.update.mockResolvedValue({ affected: 1 });
      subscriptionService.findAllActiveSubscriptions.mockResolvedValue([]);

      await service.processScheduledNews();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('cleanupStaleSubscriptions', () => {
    it('calls cleanupStale on the subscription service', async () => {
      subscriptionService.cleanupStale.mockResolvedValue({ inactive: 5, neverUsed: 2 });
      await service.cleanupStaleSubscriptions();
      expect(subscriptionService.cleanupStale).toHaveBeenCalled();
    });
  });
});
