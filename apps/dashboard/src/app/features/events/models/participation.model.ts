import { AssignmentArea, AttendanceStatus, AvailablePersonPosition } from '@muixer/pinyes-render';

/**
 * Mirrors the `GET /events/:eventId/participation` contract.
 *
 * Declared locally (rather than importing the `@muixer/shared` interfaces) following the
 * same convention as `AvailablePerson`, so the dashboard keeps using the pinyes-local
 * `AttendanceStatus` string union and stays cast-free when interoperating with
 * `PersonHoverInfo`.
 */

/** One column of the matrix. */
export interface ParticipationSegment {
  id: string;
  name: string | null;
  sortOrder: number;
  /** Feeds the column-header tooltip. */
  figureNames: string[];
  /** Hidden segments are included; the flag is data, not a filter. */
  isPublished: boolean;
  figureCount: number;
  /** `figureCount > snapshottedFigureCount` explains empty cells without being a warning. */
  snapshottedFigureCount: number;
}

/**
 * A single placement of a person on a node.
 *
 * Plural by contract: a person may hold several placements in one segment. Never read
 * `[0]` as if it were the only one.
 */
export interface ParticipationPlacement {
  assignmentId: string;
  instanceId: string;
  figureName: string;
  nodeId: string;
  nodeLabel: string;
  zone: string;
  /** Physical area derived from `zone` server-side (BASE→TRONC, D10). */
  area: AssignmentArea;
  positionType: string | null;
  z: number;
  /** Cordon number. */
  renglaPosition: number | null;
}

/** Mirrors `SegmentConflictKind` (`@muixer/shared`) — declared locally per this file's convention. */
export type ParticipationConflictKind = 'TRONC_TRONC' | 'TRONC_PINYA' | 'PINYA_PINYA';

/** One row of the matrix. */
export interface ParticipationPerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  /** false = soft-deleted, but may still hold placements. */
  isActive: boolean;
  notes: string | null;
  notesEmoji: string | null;
  /** Plain data, never rendered as a warning. */
  attendanceStatus: AttendanceStatus;
  positions: AvailablePersonPosition[];
  /** Keyed by segment id; a missing key means nothing to do in that segment. */
  placements: Record<string, ParticipationPlacement[]>;
  assignedSegmentCount: number;
  placementCount: number;
  /** Placements on TRONC/BASE nodes across the event (BASE→TRONC, D10). */
  troncPlacementCount: number;
  /**
   * Segments where the person holds more than one placement — they would have to be in
   * two places at once. This IS surfaced as a warning, unlike having nothing to do.
   */
  conflictSegmentIds: string[];
}

export interface ParticipationMeta {
  distinctPersons: number;
  personsWithPlacement: number;
  totalPlacements: number;
  conflictedPersons: number;
  conflictsByKind: Record<ParticipationConflictKind, number>;
  /** Total placements on TRONC/BASE nodes across the event (BASE→TRONC, D10). */
  troncPlacements: number;
}

export interface EventParticipation {
  event: { id: string; title: string; date: string };
  segments: ParticipationSegment[];
  persons: ParticipationPerson[];
  meta: ParticipationMeta;
}
