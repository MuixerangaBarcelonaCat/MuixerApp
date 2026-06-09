import type { AssignmentDetail } from '@muixer/shared';

export { AttendanceStatus } from '@muixer/shared';

export type {
  PaginatedMeta as HistoryMeta,
  AssignmentNodeDetail,
  AssignmentPersonDetail,
  AssignmentDetail,
  AvailablePersonPosition,
  AvailablePerson,
  InstanceNodeItem,
  CordonsResponse,
  FigureHistoryEntry,
  BulkImportConflict,
  BulkImportResult,
  PersonAssignmentEntry,
  PersonAssignmentHistory,
  EventAssignmentEntry,
  EventFigureSummary,
  EventSegmentSummary,
  EventAssignmentSummary,
} from '@muixer/shared';

export type HeightMode = 'relative' | 'absolute';

export interface CreateAssignmentPayload {
  nodeId: string;
  personId: string;
  compositionSlotId?: string;
}

export interface BulkImportPayload {
  sourceInstanceId: string;
  sourceCompositionSlotId?: string;
}

export interface AvailablePersonsQuery {
  search?: string;
  height?: number;
  isXicalla?: boolean;
  excludeAssigned?: boolean;
}

export interface PendingOp {
  id: string;
  type: 'assign' | 'unassign';
  instanceId: string;
  nodeId: string;
  personId: string | null;
  previousAssignments: AssignmentDetail[];
}

export interface UpdateInstanceCordonsPayload {
  numberOfCordons?: number | null;
  openCordons?: string[] | null;
}

export interface SwapAssignmentsPayload {
  assignmentIdA: string;
  assignmentIdB: string;
}

export interface HistoryQuery {
  page?: number;
  limit?: number;
  seasonId?: string;
}
