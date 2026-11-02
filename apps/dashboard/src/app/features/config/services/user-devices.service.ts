import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PaginatedResponse, UserDevicesSummary, UserPushDevice, UserSession } from '@muixer/shared';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';

export interface UserDevicesSummaryParams {
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class UserDevicesService extends ApiService {
  summary(params: UserDevicesSummaryParams): Observable<PaginatedResponse<UserDevicesSummary>> {
    return this.get<PaginatedResponse<UserDevicesSummary>>('/users/devices-summary', { params: buildHttpParams(params) });
  }

  sessions(userId: string): Observable<UserSession[]> {
    return this.get<UserSession[]>(`/users/${userId}/sessions`);
  }

  revokeSession(userId: string, family: string): Observable<void> {
    return this.delete<void>(`/users/${userId}/sessions/${family}`);
  }

  revokeAll(userId: string): Observable<void> {
    return this.delete<void>(`/users/${userId}/sessions`);
  }

  devices(userId: string): Observable<UserPushDevice[]> {
    return this.get<UserPushDevice[]>(`/users/${userId}/push-subscriptions`);
  }

  removeDevice(userId: string, subId: string): Observable<void> {
    return this.delete<void>(`/users/${userId}/push-subscriptions/${subId}`);
  }

  testDevice(userId: string, subId: string): Observable<{ success: boolean; gone: boolean }> {
    return this.post<{ success: boolean; gone: boolean }>(`/users/${userId}/push-subscriptions/${subId}/test`, {});
  }
}
