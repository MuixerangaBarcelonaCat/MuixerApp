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

export interface ProvisionalPerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
}

@Injectable({ providedIn: 'root' })
export class RollCallService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;
  private readonly personsUrl = `${environment.apiUrl}/persons`;

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
    payload: { status: AttendanceStatus; force?: boolean },
  ): Observable<AttendanceCrudResponse> {
    return this.http.put<AttendanceCrudResponse>(
      `${this.baseUrl}/${eventId}/attendance/${attendanceId}`,
      payload,
    );
  }

  createAttendance(
    eventId: string,
    payload: { personId: string; status: AttendanceStatus },
  ): Observable<AttendanceCrudResponse> {
    return this.http.post<AttendanceCrudResponse>(`${this.baseUrl}/${eventId}/attendance`, payload);
  }

  createProvisionalPerson(alias: string): Observable<ProvisionalPerson> {
    return this.http.post<ProvisionalPerson>(`${this.personsUrl}/provisional`, { alias });
  }
}
