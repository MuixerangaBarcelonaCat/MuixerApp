import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  CreateInstancePayload,
  InstanceDetail,
  UpdateInstancePayload,
} from '../models/segment.model';

@Injectable({
  providedIn: 'root',
})
export class FigureInstanceService extends ApiService {
  create(eventId: string, segmentId: string, payload: CreateInstancePayload): Observable<InstanceDetail> {
    return this.post<InstanceDetail>(
      `/events/${eventId}/segments/${segmentId}/instances`,
      payload,
    );
  }

  update(
    eventId: string,
    segmentId: string,
    instanceId: string,
    payload: UpdateInstancePayload,
  ): Observable<InstanceDetail> {
    return this.put<InstanceDetail>(
      `/events/${eventId}/segments/${segmentId}/instances/${instanceId}`,
      payload,
    );
  }

  remove(eventId: string, segmentId: string, instanceId: string): Observable<void> {
    return this.delete<void>(
      `/events/${eventId}/segments/${segmentId}/instances/${instanceId}`,
    );
  }

  reorder(eventId: string, segmentId: string, instanceIds: string[]): Observable<void> {
    return this.patch<void>(
      `/events/${eventId}/segments/${segmentId}/instances/reorder`,
      { instanceIds },
    );
  }
}
