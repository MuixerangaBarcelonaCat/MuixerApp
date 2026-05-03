import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  Person,
  Position,
  PaginatedResponse,
  PersonFilterParams,
  UpdatePersonDto
} from '../models/person.model';

/** Servei de comunicació amb l'API de persones. Estén ApiService per heretar els mètodes HTTP amb baseUrl. */
@Injectable({
  providedIn: 'root',
})
export class PersonService extends ApiService {
  /** Carrega la llista paginada de persones aplicant els filtres indicats. */
  getAll(
    filters: PersonFilterParams = {},
  ): Observable<PaginatedResponse<Person>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<Person>>('/persons', { params });
  }

  /** Carrega el detall complet d'una persona per ID, incloent posicions i mentor. */
  getOne(id: string): Observable<Person> {
    return this.get<Person>(`/persons/${id}`);
  }

  /** Carrega totes les posicions muixerangueres disponibles (per als filtres i formularis). */
  getPositions(): Observable<Position[]> {
    return this.get<Position[]>('/positions');
  }

  /** Crea una persona provisional amb l'àlies indicat. El backend afegeix automàticament el prefix `~`. */
  createProvisional(alias: string): Observable<Person> {
    return this.post<Person>('/persons/provisional', { alias });
  }

  /** Actualitza parcialment una persona. Usat per edicions de detall i per a les transicions provisional↔regular. */
  update(id: string, payload: Partial<UpdatePersonDto>): Observable<Person> {
    return this.patch<Person>(`/persons/${id}`, payload);
  }

  /** Crea un usuari per una persona i li envia un email d'invitació. */
  sendInvitation(personId: string, email: string): Observable<Person> {
    return this.post<Person>(`/users/create-with-invite`, { personId, email });
  }
}
