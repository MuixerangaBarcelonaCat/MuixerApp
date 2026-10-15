import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  AttendanceItem,
  AttendanceFilterParams,
  SetAttendancePayload,
  AttendanceCrudResponse,
} from '../models/attendance.model';
import { PaginatedResponse } from '../models/event.model';

/** Servei de comunicació amb l'API d'assistència. Cada operació retorna l'assistència actualitzada i el summary recalculat. */
@Injectable({
  providedIn: 'root',
})
export class AttendanceService extends ApiService {
  /** Carrega la llista paginada d'assistències per a un event concret, amb filtres opcionals per estat i cerca de persona. */
  getByEvent(
    eventId: string,
    filters: AttendanceFilterParams = {},
  ): Observable<PaginatedResponse<AttendanceItem>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<AttendanceItem>>(`/events/${eventId}/attendance`, { params });
  }

  /**
   * Estableix l'assistència d'una persona a l'event (amb registre o sense: no tindre'n equival a
   * PENDENT). Retorna l'assistència i el summary recalculat.
   */
  set(eventId: string, personId: string, payload: SetAttendancePayload): Observable<AttendanceCrudResponse> {
    return this.put<AttendanceCrudResponse>(`/events/${eventId}/attendance/${personId}`, payload);
  }
}
