import { AttendanceStatus } from '../enums/attendance-status.enum';
import { NotificationTargetType } from '../enums/notification-target-type.enum';
import { NotificationSource } from '../enums/notification-source.enum';

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
