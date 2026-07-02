import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { SegmentDistributionData, InstanceDistributionPayload } from '../models/distribution.model';

@Injectable({
  providedIn: 'root',
})
export class SegmentDistributionService extends ApiService {
  getDistribution(eventId: string, segmentId: string): Observable<SegmentDistributionData> {
    return this.get<SegmentDistributionData>(
      `/events/${eventId}/segments/${segmentId}/distribution`,
    );
  }

  saveDistribution(
    eventId: string,
    segmentId: string,
    items: InstanceDistributionPayload[],
  ): Observable<void> {
    return this.put<void>(
      `/events/${eventId}/segments/${segmentId}/distribution`,
      { items },
    );
  }

  clearDistribution(eventId: string, segmentId: string): Observable<void> {
    return this.delete<void>(
      `/events/${eventId}/segments/${segmentId}/distribution`,
    );
  }
}
