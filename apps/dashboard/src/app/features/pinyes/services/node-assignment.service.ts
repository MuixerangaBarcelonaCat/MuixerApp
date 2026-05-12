import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  AssignmentDetail,
  AvailablePerson,
  AvailablePersonsQuery,
  BulkImportPayload,
  BulkImportResult,
  CreateAssignmentPayload,
  FigureHistoryEntry,
} from '../models/assignment.model';

@Injectable({
  providedIn: 'root',
})
export class NodeAssignmentService extends ApiService {
  getByInstance(instanceId: string): Observable<{ data: AssignmentDetail[] }> {
    return this.get<{ data: AssignmentDetail[] }>(`/figure-instances/${instanceId}/assignments`);
  }

  assign(instanceId: string, payload: CreateAssignmentPayload): Observable<AssignmentDetail> {
    return this.post<AssignmentDetail>(`/figure-instances/${instanceId}/assignments`, payload);
  }

  unassign(instanceId: string, assignmentId: string): Observable<void> {
    return this.delete<void>(`/figure-instances/${instanceId}/assignments/${assignmentId}`);
  }

  bulkImport(instanceId: string, payload: BulkImportPayload): Observable<BulkImportResult> {
    return this.post<BulkImportResult>(`/figure-instances/${instanceId}/assignments/bulk`, payload);
  }

  getAvailablePersons(
    eventId: string,
    segmentId: string,
    query: AvailablePersonsQuery = {},
  ): Observable<{ data: AvailablePerson[] }> {
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .reduce<Record<string, string>>((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {});
    return this.get<{ data: AvailablePerson[] }>(
      `/events/${eventId}/segments/${segmentId}/available-persons`,
      { params },
    );
  }

  getHistory(figureTemplateId: string): Observable<{ data: FigureHistoryEntry[] }> {
    return this.get<{ data: FigureHistoryEntry[] }>(`/figure-templates/${figureTemplateId}/history`);
  }

  getNextPerformance(eventId: string): Observable<{ id: string; title: string; date: string } | null> {
    return this.get<{ id: string; title: string; date: string } | null>(
      `/events/${eventId}/next-performance`,
    );
  }
}
