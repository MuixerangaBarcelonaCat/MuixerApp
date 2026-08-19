import { Injectable, Logger } from '@nestjs/common';
import { NotificationPayload } from '@muixer/shared';
import { PushProvider, PushResult, PushSubscriptionData } from '../push-provider.interface';

/**
 * Dev-safe default: logs the push payload to console instead of sending, so
 * the app never needs real VAPID credentials to run locally.
 */
@Injectable()
export class ConsolePushProvider implements PushProvider {
  private readonly logger = new Logger(ConsolePushProvider.name);

  async send(subscription: PushSubscriptionData, payload: NotificationPayload): Promise<PushResult> {
    this.logger.log(
      `[PUSH:console] endpoint=${subscription.endpoint.slice(0, 60)}... title="${payload.title}" body="${payload.body}"`,
    );
    return { success: true, statusCode: 201 };
  }
}
