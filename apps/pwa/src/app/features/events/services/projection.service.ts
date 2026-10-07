import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { ProjectionSegmentData } from '@muixer/pinyes-render';
import { environment } from '../../../../environments/environment';

/** On a bad connection (a packed square) the request would otherwise spin until the browser gives up. */
export const PROJECTION_TIMEOUT_MS = 20_000;

@Injectable({ providedIn: 'root' })
export class ProjectionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/events`;

  getProjection(eventId: string, segmentId: string): Observable<ProjectionSegmentData> {
    return this.http
      .get<ProjectionSegmentData>(`${this.baseUrl}/${eventId}/segments/${segmentId}/projection`)
      .pipe(timeout(PROJECTION_TIMEOUT_MS));
  }
}
