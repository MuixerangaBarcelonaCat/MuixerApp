import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AttendanceStatus, PaginatedResponse } from '@muixer/shared';
import { environment } from '../../../../environments/environment';

export interface AttendanceItem {
  id: string;
  status: AttendanceStatus;
  person: {
    id: string;
    alias: string;
    name: string;
    firstSurname: string;
  };
}

export interface AttendanceCrudResponse {
  attendance: { id: string; status: AttendanceStatus };
  summary: unknown;
}

@Injectable({ providedIn: 'root' })
export class RollCallService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;

  getAttendance(eventId: string, search?: string): Observable<PaginatedResponse<AttendanceItem>> {
    let params = new HttpParams().set('limit', '100');
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<AttendanceItem>>(
      `${this.baseUrl}/${eventId}/attendance`,
      { params },
    );
  }

  updateAttendance(
    eventId: string,
    attendanceId: string,
    payload: { status: AttendanceStatus },
  ): Observable<AttendanceCrudResponse> {
    return this.http.put<AttendanceCrudResponse>(
      `${this.baseUrl}/${eventId}/attendance/${attendanceId}`,
      payload,
    );
  }
}
