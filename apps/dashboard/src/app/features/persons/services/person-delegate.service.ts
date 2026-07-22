import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DelegateType } from '@muixer/shared';

export interface PersonDelegateItem {
  id: string;
  delegateType: DelegateType;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
  person: {
    id: string;
    alias: string;
  };
}

export interface CreateDelegatePayload {
  userId: string;
  delegateType: DelegateType;
}

export interface UpdateDelegatePayload {
  delegateType?: DelegateType;
  isActive?: boolean;
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
