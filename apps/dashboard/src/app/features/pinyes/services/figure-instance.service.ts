import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CreateInstancePayload, InstanceRef } from '../models/segment.model';

@Injectable({
  providedIn: 'root',
})
export class FigureInstanceService extends ApiService {
  create(eventId: string, segmentId: string, payload: CreateInstancePayload): Observable<InstanceRef> {
    return this.post<InstanceRef>(
      `/events/${eventId}/segments/${segmentId}/instances`,
      payload,
    );
  }

  remove(eventId: string, segmentId: string, instanceId: string): Observable<void> {
    return this.delete<void>(
      `/events/${eventId}/segments/${segmentId}/instances/${instanceId}`,
    );
  }

}
