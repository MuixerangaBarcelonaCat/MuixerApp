import { AssignmentDetail, AvailablePerson, AvailablePersonsQuery, BulkImportPayload, BulkImportResult, CordonsResponse, CreateAdHocNodePayload, CreateAssignmentPayload, EventAssignmentSummary, FigureHistoryEntry, HistoryMeta, HistoryQuery, InstanceNodeItem, PersonAssignmentHistory, SegmentConflictsResponse, SwapAssignmentsPayload, TroncChangeImpact, UpdateAdHocNodePayload, UpdateInstanceCordonsPayload } from '@muixer/pinyes-render';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { buildHttpParams } from '../../../core/utils/http-params.util';

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

  assign(
    instanceId: string,
    payload: CreateAssignmentPayload,
  ): Observable<AssignmentDetail & { impact?: TroncChangeImpact }> {
    return this.post<AssignmentDetail & { impact?: TroncChangeImpact }>(
      `/figure-instances/${instanceId}/assignments`,
      payload,
    );
  }

  unassign(instanceId: string, assignmentId: string): Observable<{ impact?: TroncChangeImpact }> {
    return this.delete<{ impact?: TroncChangeImpact }>(
      `/figure-instances/${instanceId}/assignments/${assignmentId}`,
    );
  }

  swap(
    instanceId: string,
    payload: SwapAssignmentsPayload,
  ): Observable<{ a: AssignmentDetail; b: AssignmentDetail; impact?: TroncChangeImpact }> {
    return this.post<{ a: AssignmentDetail; b: AssignmentDetail; impact?: TroncChangeImpact }>(
      `/figure-instances/${instanceId}/assignments/swap`,
      payload,
    );
  }

  resetSnapshot(instanceId: string): Observable<{ removedAssignments: number; deletedAdHocCount: number }> {
    return this.post<{ removedAssignments: number; deletedAdHocCount: number }>(`/figure-instances/${instanceId}/reset`, {});
  }

  // ── Ad-hoc node CRUD ────────────────────────────────────────────────────

  createAdHocNode(instanceId: string, payload: CreateAdHocNodePayload): Observable<InstanceNodeItem> {
    return this.post<InstanceNodeItem>(`/figure-instances/${instanceId}/ad-hoc-nodes`, payload);
  }

  updateAdHocNode(instanceId: string, nodeId: string, payload: UpdateAdHocNodePayload): Observable<InstanceNodeItem> {
    return this.patch<InstanceNodeItem>(`/figure-instances/${instanceId}/ad-hoc-nodes/${nodeId}`, payload);
  }

  deleteAdHocNode(instanceId: string, nodeId: string): Observable<void> {
    return this.delete<void>(`/figure-instances/${instanceId}/ad-hoc-nodes/${nodeId}`);
  }

  bulkImport(instanceId: string, payload: BulkImportPayload): Observable<BulkImportResult> {
    return this.post<BulkImportResult>(`/figure-instances/${instanceId}/assignments/bulk`, payload);
  }

  updateCordons(instanceId: string, payload: UpdateInstanceCordonsPayload): Observable<CordonsResponse> {
    return this.patch<CordonsResponse>(`/figure-instances/${instanceId}/cordons`, payload);
  }

  getAvailablePersons(
    eventId: string,
    segmentId: string,
    query: AvailablePersonsQuery = {},
  ): Observable<{ data: AvailablePerson[] }> {
    const params = buildHttpParams(query);
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

  /** Canonical segment conflicts (D13). Empty in production until Phase 5 drops the constraints. */
  getSegmentConflicts(eventId: string, segmentId: string): Observable<SegmentConflictsResponse> {
    return this.get<SegmentConflictsResponse>(
      `/events/${eventId}/segments/${segmentId}/conflicts`,
    );
  }


  getLockStatus(eventId: string): Observable<LockStatus> {
    return this.get<LockStatus>(`/events/${eventId}/lock-status`);
  }

  getNextPerformance(eventId: string): Observable<{ id: string; title: string; date: string } | null> {
    return this.get<{ id: string; title: string; date: string } | null>(
      `/events/${eventId}/next-performance`,
    );
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
