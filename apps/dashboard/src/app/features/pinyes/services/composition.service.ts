import { SegmentDetail } from '@muixer/pinyes-render';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  CompositionDetail,
  CompositionFilterParams,
  CreateCompositionPayload,
  PaginatedCompositions,
  UpdateCompositionPayload,
} from '../models/composition.model';

@Injectable({
  providedIn: 'root',
})
export class CompositionService extends ApiService {
  getAll(filters: CompositionFilterParams = {}): Observable<PaginatedCompositions> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedCompositions>('/compositions', { params });
  }

  getOne(id: string): Observable<CompositionDetail> {
    return this.get<CompositionDetail>(`/compositions/${id}`);
  }

  create(payload: CreateCompositionPayload): Observable<CompositionDetail> {
    return this.post<CompositionDetail>('/compositions', payload);
  }

  update(id: string, payload: UpdateCompositionPayload): Observable<CompositionDetail> {
    return this.put<CompositionDetail>(`/compositions/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/compositions/${id}`);
  }

  duplicate(id: string): Observable<CompositionDetail> {
    return this.post<CompositionDetail>(`/compositions/${id}/duplicate`, {});
  }

  applyToSegment(eventId: string, segmentId: string, compositionId: string): Observable<SegmentDetail> {
    return this.post<SegmentDetail>(
      `/events/${eventId}/segments/${segmentId}/apply-composition`,
      { compositionId },
    );
  }
}
