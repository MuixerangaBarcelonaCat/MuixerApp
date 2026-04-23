import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Season, PaginatedResponse } from '../models/event.model';

@Injectable({
  providedIn: 'root',
})
export class SeasonService extends ApiService {
  getAll(): Observable<PaginatedResponse<Season>> {
    return this.get<PaginatedResponse<Season>>('/seasons');
  }
}
