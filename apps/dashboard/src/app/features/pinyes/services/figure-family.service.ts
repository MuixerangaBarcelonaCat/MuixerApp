import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  CreateFigureFamilyPayload,
  FigureFamilyDetail,
  FigureFamilyFilterParams,
  PaginatedFigureFamilies,
  UpdateFigureFamilyPayload,
} from '../models/figure-family.model';

@Injectable({
  providedIn: 'root',
})
export class FigureFamilyService extends ApiService {
  getAll(filters: FigureFamilyFilterParams = {}): Observable<PaginatedFigureFamilies> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedFigureFamilies>('/figure-families', { params });
  }

  getOne(id: string): Observable<FigureFamilyDetail> {
    return this.get<FigureFamilyDetail>(`/figure-families/${id}`);
  }

  create(payload: CreateFigureFamilyPayload): Observable<FigureFamilyDetail> {
    return this.post<FigureFamilyDetail>('/figure-families', payload);
  }

  update(id: string, payload: UpdateFigureFamilyPayload): Observable<FigureFamilyDetail> {
    return this.put<FigureFamilyDetail>(`/figure-families/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/figure-families/${id}`);
  }
}
