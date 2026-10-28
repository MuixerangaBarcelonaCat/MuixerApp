import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { InviteLinkResponse, ShirtCandidate } from '@muixer/shared';
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

  /** Persones pendents de camisa, ja ordenades: primer qui hi té dret, després de més a menys a prop. */
  getShirtCandidates(): Observable<ShirtCandidate[]> {
    return this.get<ShirtCandidate[]>('/persons/shirt-candidates');
  }

  /** Carrega totes les posicions muixerangueres disponibles (per als filtres i formularis). */
  getPositions(): Observable<Position[]> {
    return this.get<Position[]>('/tags');
  }

  /** Crea una persona provisional amb l'àlies indicat. El backend afegeix automàticament el prefix `~`. */
  createProvisional(alias: string): Observable<Person> {
    return this.post<Person>('/persons/provisional', { alias });
  }

  /** Actualitza parcialment una persona. Usat per edicions de detall i per a les transicions provisional↔regular. */
  update(id: string, payload: Partial<UpdatePersonDto>): Observable<Person> {
    return this.patch<Person>(`/persons/${id}`, payload);
  }

  /** Crea (o regenera) l'enllaç d'invitació d'una persona sense compte actiu. */
  createInviteLink(personId: string): Observable<InviteLinkResponse> {
    return this.post<InviteLinkResponse>('/users/invite-link', { personId });
  }
}
