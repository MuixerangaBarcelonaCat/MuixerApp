import { NotificationPayload, PushSubscriptionKeys } from '@muixer/shared';

export interface PushSubscriptionData {
  id: string;
  userId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface PushResult {
  success: boolean;
  statusCode?: number;
  gone?: boolean;
}

export interface PushProvider {
  send(subscription: PushSubscriptionData, payload: NotificationPayload): Promise<PushResult>;
}

/** DI token — PushSenderService depends on this interface, never on a concrete provider or vendor SDK. */
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
