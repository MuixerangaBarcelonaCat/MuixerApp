import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationPayload } from '@muixer/shared';
import { PUSH_PROVIDER, PushProvider, PushResult, PushSubscriptionData } from './push-provider.interface';

/**
 * Public API used by other services. Depends only on the PushProvider interface —
 * never on a concrete provider or vendor SDK — so swapping (VAPID, FCM, etc.)
 * never touches call sites.
 *
 * Never throws: push delivery must not crash the primary operation (fire-and-forget).
 */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(@Inject(PUSH_PROVIDER) private readonly provider: PushProvider) {}

  async send(subscription: PushSubscriptionData, payload: NotificationPayload): Promise<PushResult> {
    try {
      return await this.provider.send(subscription, payload);
    } catch (err) {
      this.logger.error(`Unexpected error sending push to ${subscription.endpoint.slice(0, 60)}...`, err instanceof Error ? err.stack : err);
      return { success: false };
    }
  }
}
