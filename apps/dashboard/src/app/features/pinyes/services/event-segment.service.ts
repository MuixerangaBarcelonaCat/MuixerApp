import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  CreateSegmentPayload,
  SegmentDetail,
  UpdateSegmentPayload,
} from '../models/segment.model';

@Injectable({
  providedIn: 'root',
})
export class EventSegmentService extends ApiService {
  getByEvent(eventId: string): Observable<{ data: SegmentDetail[] }> {
    return this.get<{ data: SegmentDetail[] }>(`/events/${eventId}/segments`);
  }

  create(eventId: string, payload: CreateSegmentPayload): Observable<SegmentDetail> {
    return this.post<SegmentDetail>(`/events/${eventId}/segments`, payload);
  }

  update(eventId: string, segmentId: string, payload: UpdateSegmentPayload): Observable<SegmentDetail> {
    return this.put<SegmentDetail>(`/events/${eventId}/segments/${segmentId}`, payload);
  }

  remove(eventId: string, segmentId: string): Observable<void> {
    return this.delete<void>(`/events/${eventId}/segments/${segmentId}`);
  }

  reorder(eventId: string, segmentIds: string[]): Observable<void> {
    return this.patch<void>(`/events/${eventId}/segments/reorder`, { segmentIds });
  }
}
