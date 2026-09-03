import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PaginatedResponse,
  MeEvent,
  MeEventDetail,
  MeSegment,
  MeSeason,
  AttendanceResponse,
  AttendanceStatus,
  EventType,
} from '@muixer/shared';
import { environment } from '../../../../environments/environment';

export interface MeEventFilters {
  type?: EventType;
  timeFilter?: 'upcoming' | 'past' | 'all';
  seasonId?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/events`;

  findAll(filters?: MeEventFilters): Observable<PaginatedResponse<MeEvent>> {
    let params = new HttpParams();
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.timeFilter) params = params.set('timeFilter', filters.timeFilter);
    if (filters?.seasonId) params = params.set('seasonId', filters.seasonId);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<PaginatedResponse<MeEvent>>(this.baseUrl, { params });
  }

  findSeasons(): Observable<MeSeason[]> {
    return this.http.get<MeSeason[]>(`${environment.apiUrl}/me/seasons`);
  }

  findOne(id: string): Observable<MeEventDetail> {
    return this.http.get<MeEventDetail>(`${this.baseUrl}/${id}`);
  }

  findSegments(eventId: string): Observable<MeSegment[]> {
    return this.http.get<MeSegment[]>(`${this.baseUrl}/${eventId}/segments`);
  }

  updateAttendance(
    eventId: string,
    status: AttendanceStatus,
    personId?: string,
  ): Observable<AttendanceResponse> {
    return this.http.put<AttendanceResponse>(
      `${this.baseUrl}/${eventId}/attendance`,
      personId ? { status, personId } : { status },
    );
  }
}
