import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  AttendanceItem,
  AttendanceFilterParams,
  CreateAttendancePayload,
  UpdateAttendancePayload,
  AttendanceCrudResponse,
  AttendanceDeleteResponse,
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

  /** Crea un registre d'assistència. Retorna el nou registre i el summary actualitzat. Falla si ja existeix (409). */
  create(eventId: string, payload: CreateAttendancePayload): Observable<AttendanceCrudResponse> {
    return this.post<AttendanceCrudResponse>(`/events/${eventId}/attendance`, payload);
  }

  /** Actualitza l'estat i/o les notes d'un registre. Retorna el registre modificat i el summary recalculat. */
  update(
    eventId: string,
    attendanceId: string,
    payload: UpdateAttendancePayload,
  ): Observable<AttendanceCrudResponse> {
    return this.put<AttendanceCrudResponse>(`/events/${eventId}/attendance/${attendanceId}`, payload);
  }

  /** Elimina un registre d'assistència. Retorna el summary actualitzat de l'event. */
  remove(eventId: string, attendanceId: string): Observable<AttendanceDeleteResponse> {
    return this.delete<AttendanceDeleteResponse>(`/events/${eventId}/attendance/${attendanceId}`);
  }
}
