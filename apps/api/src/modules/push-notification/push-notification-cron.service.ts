import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { News } from '../news/news.entity';
import { PushSubscriptionService } from './push-subscription.service';
import { PushRequestedEvent } from './events/push-requested.event';

@Injectable()
export class PushNotificationCronService {
  private readonly logger = new Logger(PushNotificationCronService.name);

  constructor(
    @InjectRepository(News)
    private readonly newsRepo: Repository<News>,
    private readonly subscriptionService: PushSubscriptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Every minute: find news scheduled for push that hasn't been dispatched yet. */
  @Cron('*/1 * * * *')
  async processScheduledNews(): Promise<void> {
    const pendingNews = await this.newsRepo.find({
      where: {
        sendPush: true,
        pushSentAt: IsNull(),
        publishedAt: LessThanOrEqual(new Date()),
      },
    });

    if (pendingNews.length === 0) return;

    this.logger.log(`Processing push for ${pendingNews.length} news item(s)`);

    for (const item of pendingNews) {
      // Mark sent before emitting to prevent double-dispatch on slow runs.
      await this.newsRepo.update(item.id, { pushSentAt: new Date() });

      const userIds = await this.subscriptionService.findUserIdsWithActiveSubscriptions();
      if (userIds.length === 0) continue;

      this.eventEmitter.emit(
        'push.requested',
        new PushRequestedEvent(userIds, {
          title: item.title,
          body: item.body.slice(0, 200),
          icon: '/icons/icon-192.png',
          url: '/home',
        }),
      );
    }
  }

  /** Daily at 03:00: purge stale subscriptions to keep the table clean. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupStaleSubscriptions(): Promise<void> {
    const { inactive, neverUsed } = await this.subscriptionService.cleanupStale();
    if (inactive > 0 || neverUsed > 0) {
      this.logger.log(`Subscription cleanup: ${inactive} inactive, ${neverUsed} never-used removed`);
    }
  }
}
