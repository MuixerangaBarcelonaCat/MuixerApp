import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  CreateFigureTemplatePayload,
  FigureTemplateDetail,
  FigureTemplateFilterParams,
  PaginatedFigureTemplates,
  UpdateFigureTemplatePayload,
} from '../models/figure-template.model';

@Injectable({
  providedIn: 'root',
})
export class FigureTemplateService extends ApiService {
  getAll(filters: FigureTemplateFilterParams = {}): Observable<PaginatedFigureTemplates> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedFigureTemplates>('/figure-templates', { params });
  }

  getOne(id: string): Observable<FigureTemplateDetail> {
    return this.get<FigureTemplateDetail>(`/figure-templates/${id}`);
  }

  create(payload: CreateFigureTemplatePayload): Observable<FigureTemplateDetail> {
    return this.post<FigureTemplateDetail>('/figure-templates', payload);
  }

  update(id: string, payload: UpdateFigureTemplatePayload): Observable<FigureTemplateDetail> {
    return this.put<FigureTemplateDetail>(`/figure-templates/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/figure-templates/${id}`);
  }

  duplicate(id: string): Observable<FigureTemplateDetail> {
    return this.post<FigureTemplateDetail>(`/figure-templates/${id}/duplicate`, {});
  }
}
