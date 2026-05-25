import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  ReferenceElementItem,
  CreateReferenceElementPayload,
  UpdateReferenceElementPayload,
  BatchElementUpdate,
} from '../models/reference-element.model';

@Injectable({
  providedIn: 'root',
})
export class ReferenceElementService extends ApiService {
  getByEvent(eventId: string): Observable<{ data: ReferenceElementItem[] }> {
    return this.get<{ data: ReferenceElementItem[] }>(`/events/${eventId}/reference-elements`);
  }

  create(eventId: string, payload: CreateReferenceElementPayload): Observable<ReferenceElementItem> {
    return this.post<ReferenceElementItem>(`/events/${eventId}/reference-elements`, payload);
  }

  update(
    eventId: string,
    id: string,
    payload: UpdateReferenceElementPayload,
  ): Observable<ReferenceElementItem> {
    return this.put<ReferenceElementItem>(`/events/${eventId}/reference-elements/${id}`, payload);
  }

  batchUpdate(eventId: string, elements: BatchElementUpdate[]): Observable<void> {
    return this.put<void>(`/events/${eventId}/reference-elements/batch`, { elements });
  }

  toggleVisibility(
    eventId: string,
    id: string,
    segmentId: string,
    hidden: boolean,
  ): Observable<ReferenceElementItem> {
    return this.put<ReferenceElementItem>(
      `/events/${eventId}/reference-elements/${id}/visibility`,
      { segmentId, hidden },
    );
  }

  remove(eventId: string, id: string): Observable<void> {
    return this.delete<void>(`/events/${eventId}/reference-elements/${id}`);
  }
}
