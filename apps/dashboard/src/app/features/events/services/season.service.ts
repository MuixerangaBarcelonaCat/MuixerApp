import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Season, PaginatedResponse } from '../models/event.model';

/** Servei de comunicació amb l'API de temporades. Usat principalment pels filtres de la llista d'events. */
@Injectable({
  providedIn: 'root',
})
export class SeasonService extends ApiService {
  /** Carrega totes les temporades disponibles ordenades per data d'inici DESC. */
  getAll(): Observable<PaginatedResponse<Season>> {
    return this.get<PaginatedResponse<Season>>('/seasons');
  }
}
