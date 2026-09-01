import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PaginatedResponse } from '@muixer/shared';
import { environment } from '../../../../environments/environment';

export interface PersonSummaryResult {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
}

@Injectable({ providedIn: 'root' })
export class PersonLookupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/persons`;

  search(term: string): Observable<PersonSummaryResult[]> {
    const params = new HttpParams().set('search', term).set('limit', '10').set('isActive', 'true');
    return this.http
      .get<PaginatedResponse<PersonSummaryResult>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }
}
