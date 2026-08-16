import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DelegateType, ManagedPerson, PersonProfileSummary, UserProfile } from '@muixer/shared';
import { environment } from '../../../../environments/environment';

/** Mirrors the API's PersonDelegateResponseDto nested shape — not the unused shared PersonDelegateDto. */
export interface ProfileDelegate {
  id: string;
  delegateType: DelegateType;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
  user: { id: string; email: string; person: { id: string; alias: string } | null };
  person: { id: string; alias: string };
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/me`;

  /** Jo mateix + les persones que gestiono com a delegat principal (selector de perfil). */
  listSwitchablePersons(): Observable<ManagedPerson[]> {
    return this.http.get<ManagedPerson[]>(`${this.baseUrl}/persons`, {
      params: { primaryOnly: true },
    });
  }

  getPersonSummary(personId: string): Observable<PersonProfileSummary> {
    return this.http.get<PersonProfileSummary>(`${this.baseUrl}/persons/${personId}`);
  }

  listDelegates(personId: string): Observable<ProfileDelegate[]> {
    return this.http.get<ProfileDelegate[]>(`${this.baseUrl}/persons/${personId}/delegates`);
  }

  addDelegate(
    personId: string,
    payload: { alias: string; delegateType: DelegateType },
  ): Observable<ProfileDelegate> {
    return this.http.post<ProfileDelegate>(`${this.baseUrl}/persons/${personId}/delegates`, payload);
  }

  removeDelegate(personId: string, delegateId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/persons/${personId}/delegates/${delegateId}`);
  }

  changePassword(payload: { currentPassword: string; newPassword: string }): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/change-password`, payload, {
      withCredentials: true,
    });
  }

  changeEmail(payload: { newEmail: string; currentPassword: string }): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${environment.apiUrl}/auth/change-email`, payload, {
      withCredentials: true,
    });
  }
}
