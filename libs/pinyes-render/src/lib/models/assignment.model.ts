export type {
  EventAssignmentSummary,
  EventFigureSummary,
  EventSegmentSummary,
  FigureAreaCount,
} from '@muixer/shared';

import { FigureZone, ImportScope, TagCategory } from '@muixer/shared';

export type AttendanceStatus = 'PENDENT' | 'ANIRE' | 'NO_VAIG' | 'ASSISTIT';
export type HeightMode = 'relative' | 'absolute';

/** Adults confirmed for the event (pre- or post-attendance). */
export function isConfirmedAttendance(status: AttendanceStatus): boolean {
  return status === 'ANIRE' || status === 'ASSISTIT';
}

export interface AssignmentNodeDetail {
  id: string;
  label: string;
  zone: string;
  z: number;
  positionType: string | null;
  sortOrder: number;
  climbIndicator: string | null;
  ringLevel: number | null;
  originNodeId: string | null;
  sourceNodeId: string | null;
  renglaPosition?: number | null;
}

export interface AssignmentPersonDetail {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  notes: string | null;
  notesEmoji: string | null;
}

export interface AssignmentDetail {
  id: string;
  figureInstanceId: string;
  node: AssignmentNodeDetail;
  person: AssignmentPersonDetail;
}

export interface AvailablePersonPosition {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  category: TagCategory;
  positionTypes: string[];
}

/** Minimal person data needed to render the hover card shown across person-panel, tronc-view and figure-canvas. */
export interface PersonHoverInfo {
  alias: string;
  attendanceStatus: AttendanceStatus | null;
  isXicalla: boolean;
  shoulderHeight: number | null;
  notes: string | null;
  notesEmoji: string | null;
  positions: AvailablePersonPosition[];
}

/**
 * Conflict/area types, declared locally (mirroring `@muixer/shared`) following the same
 * convention as the rest of this file — the dashboard keeps its own string-union models so it
 * stays cast-free when interoperating with `PersonHoverInfo`/`AttendanceStatus`.
 * BASE maps to TRONC for conflict/dotació purposes (D10).
 */
export type AssignmentArea = 'TRONC' | 'PINYA' | 'DIRECTION';

/** Ordered TRONC_TRONC → TRONC_PINYA → PINYA_PINYA. No severity: all three render identically. */
export type SegmentConflictKind = 'TRONC_TRONC' | 'TRONC_PINYA' | 'PINYA_PINYA';

/** One of a person's >1 placements within a conflicted segment. */
export interface ConflictPlacement {
  assignmentId: string;
  figureInstanceId: string;
  figureName: string;
  nodeId: string;
  nodeLabel: string | null;
  zone: string;
  area: AssignmentArea;
  z: number | null;
  renglaPosition: number | null;
  cordon: number | null;
}

/** A single person holding >1 placement within one segment. `placements` is ordered tronc-first. */
export interface SegmentConflict {
  personId: string;
  personAlias: string;
  placements: ConflictPlacement[];
  kind: SegmentConflictKind;
  suggestedRemovalAssignmentIds: string[];
}

/** Dotació/conflict counters for a whole segment (over every assignment, not just conflicted ones). */
export interface SegmentPeopleCounters {
  assignmentCount: number;
  distinctPersonCount: number;
  tronc: { distinctPersonCount: number };
  pinya: { distinctPersonCount: number };
  conflictPersonCount: number;
  conflictsByKind: Record<SegmentConflictKind, number>;
}

/** Derived impact of writing to a TRONC/BASE node (D11). Returned by assign/swap; consumed from Phase 4. */
export interface TroncChangeImpact {
  newConflicts: SegmentConflict[];
  freedPinyaNodeIds: string[];
}

/** Response of `GET events/:eventId/segments/:segmentId/conflicts` (Phase 1). */
export interface SegmentConflictsResponse {
  data: SegmentConflict[];
  meta: SegmentPeopleCounters;
}

export interface AvailablePerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  notes: string | null;
  notesEmoji: string | null;
  attendanceStatus: AttendanceStatus;
  nextPerformanceStatus: AttendanceStatus | null;
  /** All of this person's placements in the segment, ordered tronc-first (Phase 1). */
  assignedPlacements: ConflictPlacement[];
  assignedInTronc: boolean;
  assignedInPinya: boolean;
  conflictInSegment: boolean;
  positions: AvailablePersonPosition[];
}

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: string;
  segmentId: string;
  segmentName: string | null;
  /** Figure name shown under the event title: the instance label, or the mode-derived name
   *  («Peu de …», «Remat de …», «… net») when the mode isn't COMPLETA; null for a plain default. */
  figureName: string | null;
  instanceId: string;
  snapshotted: boolean;
  assignmentCount: number;
  totalNodes: number;
  assignments: {
    nodeId: string;
    nodeLabel: string;
    zone: FigureZone;
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
  clonedAdHocNodes: number;
  conflictsByKind: Record<SegmentConflictKind, number>;
}

export interface CreateAssignmentPayload {
  nodeId: string;
  personId: string;
}

export interface BulkImportPayload {
  sourceInstanceId: string;
  scope?: ImportScope;
}

export interface AvailablePersonsQuery {
  search?: string;
  height?: number;
  isXicalla?: boolean;
  excludeAssigned?: boolean;
  positionId?: string;
}

/** Tracks an optimistic UI operation that has been applied locally but not yet confirmed by the server */
export interface PendingOp {
  id: string;
  type: 'assign' | 'unassign' | 'create-adhoc' | 'delete-adhoc' | 'update-adhoc';
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
  climbIndicator: string | null;
  ringLevel: number | null;
  originNodeId: string | null;
  renglaId: string | null;
  renglaPosition: number | null;
  sourceNodeId: string | null;
  isSnapshotted: boolean;
  isAdHoc: boolean;
  createdById: string | null;
}

export interface CreateAdHocNodePayload {
  zone: string;
  positionType?: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  shape?: string;
  color?: string;
}

export interface UpdateAdHocNodePayload {
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  color?: string | null;
  shape?: string;
}

export interface UpdateInstanceCordonsPayload {
  numberOfCordons?: number | null;
  cordonsObertsEnabled?: boolean;
}

export interface CordonsResponse {
  numberOfCordons: number | null;
  cordonsObertsEnabled: boolean;
  /** How many assignments were unassigned by this change (nodes that fell outside the new cordon count). */
  removedAssignments: number;
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
  nodeLabel: string;
  positionType: string | null;
  zone: string;
  z: number;
  renglaPosition: number | null;
}

export interface PersonAssignmentHistory {
  data: PersonAssignmentEntry[];
  meta: HistoryMeta;
}

