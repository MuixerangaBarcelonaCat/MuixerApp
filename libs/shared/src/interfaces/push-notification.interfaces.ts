import { AttendanceStatus } from '../enums/attendance-status.enum';
import { NotificationTargetType } from '../enums/notification-target-type.enum';
import { NotificationSource } from '../enums/notification-source.enum';
import { NotificationScheduleType } from '../enums/notification-schedule-type.enum';
import { NotificationLinkType } from '../enums/notification-link-type.enum';
import { EventReferenceKind } from '../enums/event-reference-kind.enum';

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export interface NotificationTarget {
  type: NotificationTargetType;
  eventId?: string;
  attendanceFilter?: AttendanceStatus;
  personIds?: string[];
}

export interface PushSubscriptionStatus {
  isSubscribed: boolean;
  deviceCount: number;
}

export interface DeviceSummary {
  person: { id: string; firstName: string; lastName: string };
  activeDevices: number;
  lastPushAt: string | null;
}

export interface NotificationLogEntry {
  id: string;
  title: string;
  body: string;
  url: string | null;
  target: NotificationTarget;
  recipientCount: number;
  source: NotificationSource;
  scheduleId: string | null;
  triggeredEventId: string | null;
  triggeredByUserId: string | null;
  sentAt: string;
}

export interface EventReference {
  kind: EventReferenceKind;
  eventId?: string;
}

/** Only `scheduledFor` exists today; `WEEKLY`/`BEFORE_EVENT` will add their own shapes when built. */
export interface OneOffScheduleConfig {
  scheduledFor: string;
}

export type NotificationScheduleRuleConfig = OneOffScheduleConfig;

export interface NotificationScheduleEntry {
  id: string;
  title: string;
  body: string;
  linkedEvent: EventReference | null;
  linkTo: NotificationLinkType;
  url: string | null;
  target: NotificationTarget;
  scheduleType: NotificationScheduleType;
  ruleConfig: NotificationScheduleRuleConfig;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
