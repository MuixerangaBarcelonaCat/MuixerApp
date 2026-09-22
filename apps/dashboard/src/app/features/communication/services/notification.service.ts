import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DeviceSummary,
  EventReferenceKind,
  NotificationLinkType,
  NotificationLogEntry,
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
  linkedEvent?: EventReferenceValue;
  linkTo: NotificationLinkType;
  url?: string;
  target: NotificationTargetValue;
}

export interface NotificationHistoryFilter {
  source?: NotificationSource;
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
}
