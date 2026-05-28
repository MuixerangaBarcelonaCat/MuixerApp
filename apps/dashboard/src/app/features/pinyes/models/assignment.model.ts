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

export interface AvailablePersonPosition {
  id: string;
  name: string;
  slug: string;
  color: string | null;
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
  positions: AvailablePersonPosition[];
}

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: string;
  familyName: string | null;
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
  renglaId: string | null;
  renglaPosition: number | null;
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

export interface UpdateInstanceCordonsPayload {
  numberOfCordons?: number | null;
  openCordons?: string[] | null;
}

export interface CordonsResponse {
  numberOfCordons: number | null;
  openCordons: string[] | null;
}

export interface SwapAssignmentsPayload {
  assignmentIdA: string;
  assignmentIdB: string;
}

// ─── F3 History interfaces ────────────────────────────────────────────────

export interface HistoryQuery {
  page?: number;
  limit?: number;
  seasonId?: string;
}

export interface HistoryMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PersonAssignmentEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: string;
  segmentName: string;
  instanceId: string;
  figureName: string;
  figureSlug: string;
  familyName: string | null;
  nodeLabel: string;
  positionType: string | null;
  zone: string;
  z: number;
}

export interface PersonAssignmentHistory {
  data: PersonAssignmentEntry[];
  meta: HistoryMeta;
}

export interface EventAssignmentEntry {
  nodeLabel: string;
  positionType: string | null;
  zone: string;
  z: number;
  personAlias: string;
  personId: string;
}

export interface EventFigureSummary {
  instanceId: string;
  figureName: string;
  familyName: string | null;
  snapshotted: boolean;
  totalNodes: number;
  assignedNodes: number;
  assignments: EventAssignmentEntry[];
}

export interface EventSegmentSummary {
  segmentId: string;
  segmentName: string;
  sortOrder: number;
  figures: EventFigureSummary[];
}

export interface EventAssignmentSummary {
  segments: EventSegmentSummary[];
}
