import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  EventListItem,
  EventDetail,
  EventFilterParams,
  CreateEventPayload,
  UpdateEventPayload,
  PaginatedResponse,
} from '../models/event.model';

/** Servei de comunicació amb l'API d'events. Estén ApiService per heretar els mètodes HTTP amb baseUrl. */
@Injectable({
  providedIn: 'root',
})
export class EventService extends ApiService {
  /** Carrega la llista paginada d'events aplicant els filtres (temporada, tipus, data, text, timeFilter). */
  getAll(filters: EventFilterParams = {}): Observable<PaginatedResponse<EventListItem>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<EventListItem>>('/events', { params });
  }

  /** Carrega el detall complet d'un event per ID. */
  getOne(id: string): Observable<EventDetail> {
    return this.get<EventDetail>(`/events/${id}`);
  }

  /** Crea un nou event. */
  create(payload: CreateEventPayload): Observable<EventDetail> {
    return this.post<EventDetail>('/events', payload);
  }

  /** Actualitza un event complet via PUT. Usat des del formulari d'edició. */
  updateFull(id: string, payload: UpdateEventPayload): Observable<EventDetail> {
    return this.put<EventDetail>(`/events/${id}`, payload);
  }

  /** Elimina un event. El backend rebutja la petició si l'event té assistències (409 Conflict). */
  remove(id: string): Observable<void> {
    return this.delete<void>(`/events/${id}`);
  }

  /** Inicia la sincronització d'events des del legacy APPsistència (via POST, no SSE). */
  syncFromLegacy(): Observable<void> {
    return this.post<void>('/sync/events', {});
  }
}
