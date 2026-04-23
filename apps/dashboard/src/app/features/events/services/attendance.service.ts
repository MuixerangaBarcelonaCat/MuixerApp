import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  AttendanceItem,
  AttendanceFilterParams,
  CreateAttendancePayload,
  UpdateAttendancePayload,
  AttendanceCrudResponse,
  AttendanceDeleteResponse,
} from '../models/attendance.model';
import { PaginatedResponse } from '../models/event.model';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService extends ApiService {
  getByEvent(
    eventId: string,
    filters: AttendanceFilterParams = {},
  ): Observable<PaginatedResponse<AttendanceItem>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<AttendanceItem>>(`/events/${eventId}/attendance`, { params });
  }

  create(eventId: string, payload: CreateAttendancePayload): Observable<AttendanceCrudResponse> {
    return this.post<AttendanceCrudResponse>(`/events/${eventId}/attendance`, payload);
  }

  update(
    eventId: string,
    attendanceId: string,
    payload: UpdateAttendancePayload,
  ): Observable<AttendanceCrudResponse> {
    return this.put<AttendanceCrudResponse>(`/events/${eventId}/attendance/${attendanceId}`, payload);
  }

  remove(eventId: string, attendanceId: string): Observable<AttendanceDeleteResponse> {
    return this.delete<AttendanceDeleteResponse>(`/events/${eventId}/attendance/${attendanceId}`);
  }
}
