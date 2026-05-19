export type AttendanceStatus = 'PENDENT' | 'ANIRE' | 'NO_VAIG' | 'ASSISTIT' | 'NO_PRESENTAT';
export type HeightMode = 'relative' | 'absolute';

export interface AssignmentNodeDetail {
  id: string;
  label: string;
  zone: string;
  z: number;
  positionType: string | null;
  sortOrder: number;
  ringLevel: number | null;
  originNodeId: string | null;
  sourceNodeId: string | null;
}

export interface AssignmentPersonDetail {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
}

export interface AssignmentDetail {
  id: string;
  figureInstanceId: string;
  compositionSlotId: string | null;
  node: AssignmentNodeDetail;
  person: AssignmentPersonDetail;
}

export interface AvailablePerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  attendanceStatus: AttendanceStatus;
  nextPerformanceStatus: AttendanceStatus | null;
  assignedInSegment: boolean;
  assignedInstanceId?: string;
  assignedNodeLabel?: string;
}

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  segmentName: string | null;
  instanceId: string;
  snapshotted: boolean;
  sourceVariantOrder: number | null;
  assignmentCount: number;
  totalNodes: number;
  assignments: {
    nodeId: string;
    nodeLabel: string;
    personId: string;
    personAlias: string;
  }[];
}

export interface BulkImportConflict {
  nodeId: string;
  nodeLabel: string;
  personAlias: string;
  reason: string;
}

export interface BulkImportResult {
  created: AssignmentDetail[];
  conflicts: BulkImportConflict[];
}

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

/** Tracks an optimistic UI operation that has been applied locally but not yet confirmed by the server */
export interface PendingOp {
  id: string;
  type: 'assign' | 'unassign';
  instanceId: string;
  nodeId: string;
  personId: string | null;
  /** Snapshot to revert to on failure */
  previousAssignments: AssignmentDetail[];
}

export interface InstanceNodeItem {
  id: string;
  label: string;
  zone: string;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  sortOrder: number;
  ringLevel: number | null;
  originNodeId: string | null;
  sourceNodeId: string | null;
  isSnapshotted: boolean;
}

export interface UpgradeResult {
  addedNodes: number;
  updatedNodes: number;
  totalNodes: number;
  newTemplateId: string;
  newTemplateName: string;
  newVariantOrder: number;
}

export interface SwapAssignmentsPayload {
  assignmentIdA: string;
  assignmentIdB: string;
}
