import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  EventListItem,
  EventDetail,
  EventFilterParams,
  CreateEventPayload,
  UpdateEventPayload,
  PaginatedResponse,
} from '../models/event.model';

@Injectable({
  providedIn: 'root',
})
export class EventService extends ApiService {
  getAll(filters: EventFilterParams = {}): Observable<PaginatedResponse<EventListItem>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<EventListItem>>('/events', { params });
  }

  getOne(id: string): Observable<EventDetail> {
    return this.get<EventDetail>(`/events/${id}`);
  }

  create(payload: CreateEventPayload): Observable<EventDetail> {
    return this.post<EventDetail>('/events', payload);
  }

  updateFull(id: string, payload: UpdateEventPayload): Observable<EventDetail> {
    return this.put<EventDetail>(`/events/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/events/${id}`);
  }

  syncFromLegacy(): Observable<void> {
    return this.post<void>('/sync/events', {});
  }
}
