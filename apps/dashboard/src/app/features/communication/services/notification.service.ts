import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DeviceSummary, NotificationTargetType, AttendanceStatus } from '@muixer/shared';
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

@Injectable({ providedIn: 'root' })
export class NotificationService extends ApiService {
  send(payload: SendNotificationPayload): Observable<{ accepted: boolean; warning?: string }> {
    return this.post<{ accepted: boolean; warning?: string }>('/notifications/send', payload);
  }

  getDeviceSummary(): Observable<DeviceSummary[]> {
    return this.get<DeviceSummary[]>('/push-subscriptions/summary');
  }
}
