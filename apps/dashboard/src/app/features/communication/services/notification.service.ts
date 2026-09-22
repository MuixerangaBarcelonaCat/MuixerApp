import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DeviceSummary,
  NotificationLogEntry,
  NotificationSource,
  NotificationTargetType,
  AttendanceStatus,
  PaginatedResponse,
} from '@muixer/shared';
import { ApiService } from '../../../core/services/api.service';

export interface SendNotificationPayload {
  title: string;
  body: string;
  url?: string;
  target: {
    type: NotificationTargetType;
    eventId?: string;
    attendanceFilter?: AttendanceStatus;
    personIds?: string[];
  };
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
