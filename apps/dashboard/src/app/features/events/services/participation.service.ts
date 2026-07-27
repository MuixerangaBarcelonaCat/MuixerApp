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
  getByEvent(eventId: string): Observable<EventParticipation> {
    return this.get<EventParticipation>(`/events/${eventId}/participation`);
  }
}
