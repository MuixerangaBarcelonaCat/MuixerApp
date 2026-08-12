import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DependentRegistrationRequest, PendingDependent } from '@muixer/shared';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DependentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me/pending-dependents`;

  /** Xicalla provisionals on l'usuari autenticat és el delegat principal. */
  getPending(): Observable<PendingDependent[]> {
    return this.http.get<PendingDependent[]>(this.baseUrl);
  }

  /** Completa les dades d'un dependent concret i el promou de provisional. */
  completePending(payload: DependentRegistrationRequest): Observable<void> {
    return this.http.post<void>(this.baseUrl, payload);
  }
}
