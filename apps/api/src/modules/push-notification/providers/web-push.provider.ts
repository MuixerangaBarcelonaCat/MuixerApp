import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { NotificationPayload } from '@muixer/shared';
import { PushProvider, PushResult, PushSubscriptionData } from '../push-provider.interface';

@Injectable()
export class WebPushProvider implements PushProvider {
  private readonly logger = new Logger(WebPushProvider.name);

  constructor(config: ConfigService) {
    webPush.setVapidDetails(
      config.getOrThrow<string>('VAPID_SUBJECT'),
      config.getOrThrow<string>('VAPID_PUBLIC_KEY'),
      config.getOrThrow<string>('VAPID_PRIVATE_KEY'),
    );
  }

  async send(subscription: PushSubscriptionData, payload: NotificationPayload): Promise<PushResult> {
    try {
      const response = await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify(payload),
        { TTL: 86400 },
      );
      return { success: true, statusCode: response.statusCode };
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      const statusCode = error.statusCode ?? 0;
      this.logger.warn(`Push delivery failed (${statusCode}): ${error.message} — endpoint=${subscription.endpoint.slice(0, 60)}...`);
      return { success: false, statusCode, gone: statusCode === 410 || statusCode === 404 };
    }
  }
}
