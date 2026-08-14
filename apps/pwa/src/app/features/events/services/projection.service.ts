import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProjectionSegmentData } from '@muixer/pinyes-render';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProjectionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/events`;

  getProjection(eventId: string, segmentId: string): Observable<ProjectionSegmentData> {
    return this.http.get<ProjectionSegmentData>(
      `${this.baseUrl}/${eventId}/segments/${segmentId}/projection`,
    );
  }
}
