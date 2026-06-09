import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import {
  CompositionTemplateDetail,
  CompositionTemplateFilterParams,
  CreateCompositionTemplatePayload,
  PaginatedCompositionTemplates,
  UpdateCompositionTemplatePayload,
} from '../models/composition.model';

@Injectable({
  providedIn: 'root',
})
export class CompositionTemplateService extends ApiService {
  getAll(
    filters: CompositionTemplateFilterParams = {},
  ): Observable<PaginatedCompositionTemplates> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedCompositionTemplates>('/composition-templates', { params });
  }

  getOne(id: string): Observable<CompositionTemplateDetail> {
    return this.get<CompositionTemplateDetail>(`/composition-templates/${id}`);
  }

  create(payload: CreateCompositionTemplatePayload): Observable<CompositionTemplateDetail> {
    return this.post<CompositionTemplateDetail>('/composition-templates', payload);
  }

  update(
    id: string,
    payload: UpdateCompositionTemplatePayload,
  ): Observable<CompositionTemplateDetail> {
    return this.put<CompositionTemplateDetail>(`/composition-templates/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/composition-templates/${id}`);
  }

  duplicate(id: string): Observable<CompositionTemplateDetail> {
    return this.post<CompositionTemplateDetail>(
      `/composition-templates/${id}/duplicate`,
      {},
    );
  }
}
