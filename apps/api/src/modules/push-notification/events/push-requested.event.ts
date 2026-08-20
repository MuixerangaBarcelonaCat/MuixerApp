import { NotificationPayload } from '@muixer/shared';

export class PushRequestedEvent {
  constructor(
    public readonly userIds: string[],
    public readonly payload: NotificationPayload,
  ) {}
}
