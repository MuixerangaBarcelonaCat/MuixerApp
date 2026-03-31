import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  Person,
  Position,
  PaginatedResponse,
  PersonFilterParams,
} from '../models/person.model';

@Injectable({
  providedIn: 'root',
})
export class PersonService extends ApiService {
  getAll(filters: PersonFilterParams = {}): Observable<PaginatedResponse<Person>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<Person>>('/persons', { params });
  }

  getOne(id: string): Observable<Person> {
    return this.get<Person>(`/persons/${id}`);
  }

  getPositions(): Observable<Position[]> {
    return this.get<Position[]>('/positions');
  }
}
