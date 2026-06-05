import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  UserDto,
  PaginatedResponse,
  UserFilterParams,
  CreateUserPayload,
  UpdateUserPayload,
} from '../models/user.model';
import { UserRole } from '@muixer/shared';

@Injectable({
  providedIn: 'root',
})
export class UserService extends ApiService {
  getAll(
    filters: UserFilterParams = {},
  ): Observable<PaginatedResponse<UserDto>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<UserDto>>('/users', { params });
  }

  create(payload: CreateUserPayload): Observable<UserDto> {
    return this.post<UserDto>('/users', payload);
  }

  update(userId: string, payload: UpdateUserPayload): Observable<UserDto> {
    return this.patch<UserDto>(`/users/${userId}`, payload);
  }

  deactivate(userId: string): Observable<void> {
    return this.patch<void>(`/users/${userId}/deactivate`, {});
  }

  grantRole(userId: string, role: UserRole): Observable<UserDto> {
    return this.patch<UserDto>(`/users/${userId}/role`, { role });
  }
}
