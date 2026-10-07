import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Season, PaginatedResponse } from '../models/event.model';

export interface CreateSeasonPayload {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export type UpdateSeasonPayload = {
  [K in keyof CreateSeasonPayload]?: CreateSeasonPayload[K] | null;
};

export interface SeasonMutationOptions {
  /** Go ahead even if some events end up in no season (the user has confirmed). */
  allowUncovered?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SeasonService extends ApiService {
  getAll(): Observable<PaginatedResponse<Season>> {
    return this.get<PaginatedResponse<Season>>('/seasons');
  }

  getCurrent(): Observable<Season> {
    return this.get<Season>('/seasons/current');
  }

  create(payload: CreateSeasonPayload): Observable<Season> {
    return this.post<Season>('/seasons', payload);
  }

  /** Events whose date falls in no season («Sense temporada»). */
  getUncoveredEventCount(): Observable<{ count: number }> {
    return this.get<{ count: number }>('/seasons/uncovered-events');
  }

  /**
   * Without `allowUncovered`, the API answers 409 with `code: SEASON_LEAVES_EVENTS_UNCOVERED` when the
   * change would leave events in no season; resend with it once the user confirms.
   */
  update(id: string, payload: UpdateSeasonPayload, options: SeasonMutationOptions = {}): Observable<Season> {
    return this.patch<Season>(`/seasons/${id}`, payload, { params: mutationParams(options) });
  }

  remove(id: string, options: SeasonMutationOptions = {}): Observable<void> {
    return this.delete<void>(`/seasons/${id}`, { params: mutationParams(options) });
  }
}

function mutationParams(options: SeasonMutationOptions): Record<string, string> {
  return options.allowUncovered ? { allowUncovered: 'true' } : {};
}
