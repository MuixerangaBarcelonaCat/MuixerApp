import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';
import { AttendanceItem, AttendanceFilterParams } from '../models/attendance.model';
import { PaginatedResponse } from '../models/event.model';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService extends ApiService {
  getByEvent(
    eventId: string,
    filters: AttendanceFilterParams = {},
  ): Observable<PaginatedResponse<AttendanceItem>> {
    const params = buildHttpParams(filters);
    return this.get<PaginatedResponse<AttendanceItem>>(`/events/${eventId}/attendance`, { params });
  }
}
