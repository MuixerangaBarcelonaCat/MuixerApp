import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Season, PaginatedResponse } from '../models/event.model';

export interface CreateSeasonPayload {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export type UpdateSeasonPayload = Partial<CreateSeasonPayload>;

@Injectable({
  providedIn: 'root',
})
export class SeasonService extends ApiService {
  getAll(): Observable<PaginatedResponse<Season>> {
    return this.get<PaginatedResponse<Season>>('/seasons');
  }

  getCurrent(): Observable<Season> {
    return this.get<Season>('/seasons/current');
  }

  create(payload: CreateSeasonPayload): Observable<Season> {
    return this.post<Season>('/seasons', payload);
  }

  update(id: string, payload: UpdateSeasonPayload): Observable<Season> {
    return this.patch<Season>(`/seasons/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/seasons/${id}`);
  }
}
