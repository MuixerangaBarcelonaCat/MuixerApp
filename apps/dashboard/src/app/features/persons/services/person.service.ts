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


@Injectable({
  providedIn: 'root',
})
export class PersonService extends ApiService {
  getAll(
    filters: PersonFilterParams = {},
  ): Observable<PaginatedResponse<Person>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<Person>>('/persons', { params });
  }

  getOne(id: string): Observable<Person> {
    return this.get<Person>(`/persons/${id}`);
  }

  getPositions(): Observable<Position[]> {
    return this.get<Position[]>('/positions');
  }

  createProvisional(alias: string): Observable<Person> {
    return this.post<Person>('/persons/provisional', { alias });
  }

  update(id: string, payload: Partial<UpdatePersonDto>): Observable<Person> {
    return this.patch<Person>(`/persons/${id}`, payload);
  }

  deletePerson(id: string): Observable<void> {
    return this.delete(`/persons/${id}`);
  }

  sendInvitation(personId: string, email: string): Observable<Person> {
    return this.post<Person>(`/users/create-with-invite`, { personId, email });
  }
}
