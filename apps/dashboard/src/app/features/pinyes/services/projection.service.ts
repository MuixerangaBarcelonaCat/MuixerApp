import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ProjectionSegmentData, InstanceLayoutUpdate } from '../models/projection.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectionService extends ApiService {
  getProjection(eventId: string, segmentId: string): Observable<ProjectionSegmentData> {
    return this.get<ProjectionSegmentData>(`/events/${eventId}/segments/${segmentId}/projection`);
  }

  updateProjectionLayout(
    eventId: string,
    segmentId: string,
    layouts: InstanceLayoutUpdate[],
  ): Observable<void> {
    return this.put<void>(
      `/events/${eventId}/segments/${segmentId}/instances/projection-layout`,
      { layouts },
    );
  }
}
