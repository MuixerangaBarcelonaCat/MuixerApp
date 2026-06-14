import { AttendanceStatus } from '../../enums/attendance-status.enum';
import { EventType } from '../../enums/event-type.enum';
import { FigureZone } from '../../enums/figure-zone.enum';
import { NodeShape } from '../../enums/node-shape.enum';
import { PaginatedMeta } from '../pagination.interface';

// ── Core assignment types ───────────────────────────────────────────────────

export interface AssignmentNodeDetail {
  id: string;
  label: string;
  zone: FigureZone;
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

export interface InstanceNodeItem {
  id: string;
  sourceNodeId: string | null;
  originNodeId: string | null;
  label: string;
  zone: FigureZone;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: NodeShape;
  sortOrder: number;
  ringLevel: number | null;
  renglaId: string | null;
  renglaPosition: number | null;
  isSnapshotted: boolean;
  isAdHoc: boolean;
  createdById: string | null;
}

export interface CordonsResponse {
  numberOfCordons: number | null;
  openCordons: string[] | null;
}

// ── Available persons ───────────────────────────────────────────────────────

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

// ── History ─────────────────────────────────────────────────────────────────

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  segmentName: string | null;
  instanceId: string;
  snapshotted: boolean;
  assignmentCount: number;
  totalNodes: number;
  assignments: {
    nodeId: string;
    nodeLabel: string;
    personId: string;
    personAlias: string;
  }[];
}

export type HistoryMeta = PaginatedMeta;

export interface PersonAssignmentEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  segmentName: string;
  instanceId: string;
  figureName: string;
  figureSlug: string;
  nodeLabel: string;
  positionType: string | null;
  zone: FigureZone;
  z: number;
}

export interface PersonAssignmentHistory {
  data: PersonAssignmentEntry[];
  meta: PaginatedMeta;
}

// ── Event summary ───────────────────────────────────────────────────────────

export interface EventAssignmentEntry {
  nodeLabel: string;
  positionType: string | null;
  zone: FigureZone;
  z: number;
  personAlias: string;
  personId: string;
}

export interface EventFigureSummary {
  instanceId: string;
  figureName: string;
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

// ── Bulk import ─────────────────────────────────────────────────────────────

export interface BulkImportConflict {
  nodeId: string;
  nodeLabel: string;
  personAlias: string;
  reason: string;
}

export interface BulkImportResult {
  created: AssignmentDetail[];
  conflicts: BulkImportConflict[];
  clonedAdHocNodes: number;
}
