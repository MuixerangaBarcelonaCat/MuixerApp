import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  UserDto,
  PaginatedResponse,
  UserFilterParams,
} from '../models/user.model';
import { UserRole } from '@muixer/shared';

/** Servei de comunicació amb l'API d'usuaris. */
@Injectable({
  providedIn: 'root',
})
export class UserService extends ApiService {
  /** Carrega la llista paginada d'usuaris aplicant els filtres indicats. */
  getAll(
    filters: UserFilterParams = {},
  ): Observable<PaginatedResponse<UserDto>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<UserDto>>('/users', { params });
  }

  /** Assigna un rol a un usuari. */
  grantRole(userId: string, role: UserRole): Observable<UserDto> {
    return this.patch<UserDto>(`/users/${userId}/role`, { role });
  }
}
