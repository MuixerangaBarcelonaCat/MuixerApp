import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  PositionWithCount,
  CreatePositionDto,
  UpdatePositionDto,
} from '../models/position.model';

@Injectable({ providedIn: 'root' })
export class PositionService extends ApiService {
  getAll(): Observable<PositionWithCount[]> {
    return this.get<PositionWithCount[]>('/positions');
  }

  getOne(id: string): Observable<PositionWithCount> {
    return this.get<PositionWithCount>(`/positions/${id}`);
  }

  create(dto: CreatePositionDto): Observable<PositionWithCount> {
    return this.post<PositionWithCount>('/positions', dto);
  }

  update(id: string, dto: UpdatePositionDto): Observable<PositionWithCount> {
    return this.patch<PositionWithCount>(`/positions/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.delete<void>(`/positions/${id}`);
  }
}
