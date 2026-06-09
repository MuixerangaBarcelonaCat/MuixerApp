import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  AssignmentDetail,
  AvailablePerson,
  AvailablePersonsQuery,
  BulkImportPayload,
  BulkImportResult,
  CordonsResponse,
  CreateAssignmentPayload,
  EventAssignmentSummary,
  FigureHistoryEntry,
  HistoryMeta,
  HistoryQuery,
  InstanceNodeItem,
  PersonAssignmentHistory,
  SwapAssignmentsPayload,
  UpdateInstanceCordonsPayload,
} from '../models/assignment.model';

@Injectable({
  providedIn: 'root',
})
export class NodeAssignmentService extends ApiService {
  getInstanceNodes(instanceId: string): Observable<{ data: InstanceNodeItem[] }> {
    return this.get<{ data: InstanceNodeItem[] }>(`/figure-instances/${instanceId}/nodes`);
  }

  getByInstance(instanceId: string): Observable<{ data: AssignmentDetail[] }> {
    return this.get<{ data: AssignmentDetail[] }>(`/figure-instances/${instanceId}/assignments`);
  }

  assign(instanceId: string, payload: CreateAssignmentPayload): Observable<AssignmentDetail> {
    return this.post<AssignmentDetail>(`/figure-instances/${instanceId}/assignments`, payload);
  }

  unassign(instanceId: string, assignmentId: string): Observable<void> {
    return this.delete<void>(`/figure-instances/${instanceId}/assignments/${assignmentId}`);
  }

  swap(
    instanceId: string,
    payload: SwapAssignmentsPayload,
  ): Observable<{ a: AssignmentDetail; b: AssignmentDetail }> {
    return this.post<{ a: AssignmentDetail; b: AssignmentDetail }>(
      `/figure-instances/${instanceId}/assignments/swap`,
      payload,
    );
  }

  updateCordons(instanceId: string, payload: UpdateInstanceCordonsPayload): Observable<CordonsResponse> {
    return this.patch<CordonsResponse>(`/figure-instances/${instanceId}/cordons`, payload);
  }

  resetSnapshot(instanceId: string): Observable<{ removedAssignments: number }> {
    return this.post<{ removedAssignments: number }>(`/figure-instances/${instanceId}/reset`, {});
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

  getHistory(
    figureTemplateId: string,
    query: HistoryQuery = {},
  ): Observable<{ data: FigureHistoryEntry[]; meta: HistoryMeta }> {
    const params = this.buildQueryParams(query);
    return this.get<{ data: FigureHistoryEntry[]; meta: HistoryMeta }>(
      `/figure-templates/${figureTemplateId}/history`,
      { params },
    );
  }

  getPersonHistory(personId: string, query: HistoryQuery = {}): Observable<PersonAssignmentHistory> {
    const params = this.buildQueryParams(query);
    return this.get<PersonAssignmentHistory>(`/persons/${personId}/assignment-history`, { params });
  }

  getEventAssignmentSummary(eventId: string): Observable<EventAssignmentSummary> {
    return this.get<EventAssignmentSummary>(`/events/${eventId}/assignment-summary`);
  }

  getLockStatus(eventId: string): Observable<LockStatus> {
    return this.get<LockStatus>(`/events/${eventId}/lock-status`);
  }

  private buildQueryParams(query: HistoryQuery): Record<string, string> {
    return Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .reduce<Record<string, string>>((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {});
  }
}

export interface LockStatus {
  locked: boolean;
  lockDate: string | null;
  lockDays: number;
}
