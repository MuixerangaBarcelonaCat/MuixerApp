import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DelegateType } from '@muixer/shared';

export interface PersonDelegateItem {
  id: string;
  delegateType: DelegateType;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    isActive: boolean;
    inviteExpiresAt: string | null;
    person: { id: string; alias: string; phone: string | null } | null;
  };
  person: {
    id: string;
    alias: string;
  };
}

/** The delegate is named by account (`userId`) or by person (`responsiblePersonId`), never both. */
export type CreateDelegatePayload = (
  | { userId: string; responsiblePersonId?: never }
  | { responsiblePersonId: string; userId?: never }
) & {
  delegateType: DelegateType;
  isPrimary?: boolean;
};

export interface UpdateDelegatePayload {
  delegateType?: DelegateType;
  isActive?: boolean;
  isPrimary?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PersonDelegateService extends ApiService {
  getByPerson(personId: string): Observable<PersonDelegateItem[]> {
    return this.get<PersonDelegateItem[]>(`/persons/${personId}/delegates`);
  }

  createDelegate(
    personId: string,
    payload: CreateDelegatePayload,
  ): Observable<PersonDelegateItem> {
    return this.post<PersonDelegateItem>(
      `/persons/${personId}/delegates`,
      payload,
    );
  }

  updateDelegate(
    personId: string,
    delegateId: string,
    payload: UpdateDelegatePayload,
  ): Observable<PersonDelegateItem> {
    return this.patch<PersonDelegateItem>(
      `/persons/${personId}/delegates/${delegateId}`,
      payload,
    );
  }

  removeDelegate(
    personId: string,
    delegateId: string,
  ): Observable<void> {
    return this.delete<void>(
      `/persons/${personId}/delegates/${delegateId}`,
    );
  }
}
