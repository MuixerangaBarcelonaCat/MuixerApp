import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BeforeEventOffsetUnit,
  DeviceSummary,
  EventReferenceKind,
  EventType,
  NotificationLinkType,
  NotificationLogEntry,
  NotificationScheduleEntry,
  NotificationScheduleType,
  NotificationSource,
  NotificationTargetType,
  AttendanceStatus,
  PaginatedResponse,
} from '@muixer/shared';
import { ApiService } from '../../../core/services/api.service';

export interface EventReferenceValue {
  kind: EventReferenceKind;
  eventId?: string;
}

/** Who receives the notification — independent of the linked event and the link. */
export interface NotificationTargetValue {
  type: NotificationTargetType;
  attendanceFilter?: AttendanceStatus;
  personIds?: string[];
}

/** Where the notification opens to — independent of who receives it. */
export interface NotificationLinkValue {
  type: NotificationLinkType;
  url?: string;
}

export interface SendNotificationPayload {
  title: string;
  body: string;
  /** `null` on an edit clears a previously linked event; `undefined` in a PATCH body would be
   *  dropped by JSON serialisation and read as "leave it as it is". */
  linkedEvent?: EventReferenceValue | null;
  linkTo: NotificationLinkType;
  url?: string | null;
  target: NotificationTargetValue;
}

export interface NotificationHistoryFilter {
  source?: NotificationSource;
  page?: number;
  limit?: number;
}

export interface NotificationSchedulePayload extends SendNotificationPayload {
  scheduleType: NotificationScheduleType;
  oneOff?: { scheduledFor: string };
  weekly?: { dayOfWeek: number; timeOfDay: string; startDate?: string; endDate?: string };
  beforeEvent?: {
    eventType: EventType;
    offsetUnit: BeforeEventOffsetUnit;
    offsetValue: number;
    timeOfDay?: string;
    startDate?: string;
    endDate?: string;
  };
}

export interface NotificationScheduleFilter {
  isActive?: boolean;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService extends ApiService {
  send(payload: SendNotificationPayload): Observable<{ accepted: boolean; warning?: string }> {
    return this.post<{ accepted: boolean; warning?: string }>('/notifications/send', payload);
  }

  getDeviceSummary(): Observable<DeviceSummary[]> {
    return this.get<DeviceSummary[]>('/push-subscriptions/summary');
  }

  getHistory(filter: NotificationHistoryFilter): Observable<PaginatedResponse<NotificationLogEntry>> {
    const params: Record<string, string | number> = {};
    if (filter.source) params['source'] = filter.source;
    if (filter.page) params['page'] = filter.page;
    if (filter.limit) params['limit'] = filter.limit;

    return this.get<PaginatedResponse<NotificationLogEntry>>('/notifications/history', { params });
  }

  createSchedule(payload: NotificationSchedulePayload): Observable<NotificationScheduleEntry> {
    return this.post<NotificationScheduleEntry>('/notifications/schedules', payload);
  }

  getSchedules(filter: NotificationScheduleFilter): Observable<PaginatedResponse<NotificationScheduleEntry>> {
    const params: Record<string, string | number | boolean> = {};
    if (filter.isActive !== undefined) params['isActive'] = filter.isActive;
    if (filter.page) params['page'] = filter.page;
    if (filter.limit) params['limit'] = filter.limit;

    return this.get<PaginatedResponse<NotificationScheduleEntry>>('/notifications/schedules', { params });
  }

  cancelSchedule(id: string): Observable<void> {
    return this.delete<void>(`/notifications/schedules/${id}`);
  }

  getSchedule(id: string): Observable<NotificationScheduleEntry> {
    return this.get<NotificationScheduleEntry>(`/notifications/schedules/${id}`);
  }

  updateSchedule(id: string, payload: Partial<NotificationSchedulePayload>): Observable<NotificationScheduleEntry> {
    return this.patch<NotificationScheduleEntry>(`/notifications/schedules/${id}`, payload);
  }
}
