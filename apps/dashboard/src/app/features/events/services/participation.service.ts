import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { EventParticipation } from '../models/participation.model';

/**
 * Person-centric participation overview of an event, for the "Participació" tab.
 *
 * Deliberately parameterless: the endpoint returns the whole event population in one
 * shot because the matrix needs every row to render complete per-segment columns, and
 * all filtering/sorting/pagination happens client-side.
 */
@Injectable({
  providedIn: 'root',
})
export class ParticipationService extends ApiService {
  /** `includeNextPerformance` also brings in whoever is coming only to the next performance (quadre de troncs). */
  getByEvent(eventId: string, options: { includeNextPerformance?: boolean } = {}): Observable<EventParticipation> {
    return this.get<EventParticipation>(
      `/events/${eventId}/participation`,
      options.includeNextPerformance ? { params: { includeNextPerformance: true } } : undefined,
    );
  }
}
