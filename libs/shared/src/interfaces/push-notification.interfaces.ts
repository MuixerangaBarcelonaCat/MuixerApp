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

export interface OneOffScheduleConfig {
  scheduledFor: string;
}

/** `dayOfWeek`: 0 (Sunday) .. 6 (Saturday), matching JS `Date.getDay()`. `timeOfDay`: `HH:mm`, both evaluated in Europe/Madrid.
 *  `startDate`/`endDate` (`YYYY-MM-DD`, inclusive, Europe/Madrid): optional active window — outside
 *  it, the schedule is skipped even though `isActive` stays true (it's still a live recurring rule). */
export interface WeeklyScheduleConfig {
  dayOfWeek: number;
  timeOfDay: string;
  startDate?: string;
  endDate?: string;
}

/** `BEFORE_EVENT` will add its own shape when built. */
export type NotificationScheduleRuleConfig = OneOffScheduleConfig | WeeklyScheduleConfig;

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
