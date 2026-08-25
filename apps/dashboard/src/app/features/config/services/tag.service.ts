import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  TagWithCount,
  CreateTagDto,
  UpdateTagDto,
} from '../models/tag.model';

@Injectable({ providedIn: 'root' })
export class TagService extends ApiService {
  getAll(): Observable<TagWithCount[]> {
    return this.get<TagWithCount[]>('/tags');
  }

  getOne(id: string): Observable<TagWithCount> {
    return this.get<TagWithCount>(`/tags/${id}`);
  }

  create(dto: CreateTagDto): Observable<TagWithCount> {
    return this.post<TagWithCount>('/tags', dto);
  }

  update(id: string, dto: UpdateTagDto): Observable<TagWithCount> {
    return this.patch<TagWithCount>(`/tags/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/tags/${id}`);
  }

  assignPersons(tagId: string, personIds: string[]): Observable<void> {
    return this.post<void>(`/tags/${tagId}/persons`, { personIds });
  }

  unassignPerson(tagId: string, personId: string): Observable<void> {
    return this.delete<void>(`/tags/${tagId}/persons/${personId}`);
  }
}
