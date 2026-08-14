import { ProjectionSegmentData } from '@muixer/pinyes-render';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectionService extends ApiService {
  getProjection(eventId: string, segmentId: string): Observable<ProjectionSegmentData> {
    return this.get<ProjectionSegmentData>(`/events/${eventId}/segments/${segmentId}/projection`);
  }
}
