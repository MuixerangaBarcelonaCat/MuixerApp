import { AttendanceStatus } from '../../enums/attendance-status.enum';
import { AssignmentArea } from '../../enums/assignment-area.enum';
import { FigureZone } from '../../enums/figure-zone.enum';
import { SegmentConflictKind } from '../../enums/segment-conflict.enum';
import { TagCategory } from '../../enums/tag-category.enum';

/**
 * Person-centric participation overview of a whole event: for each person, what they
 * do in each segment. Feeds the "Participació" tab of the event page, which the
 * technical team uses to prepare a rehearsal.
 *
 * Complements `EventAssignmentSummary`, which covers the same ground figure-first
 * (and only carries person identity for TRONC/BASE nodes).
 */

/** One column of the matrix. */
export interface EventParticipationSegment {
  id: string;
  name: string | null;
  sortOrder: number;
  /** Figure names of the segment — feeds the column-header tooltip. */
  figureNames: string[];
  /**
   * Publish-to-app flag, returned as plain data: hidden segments ARE included,
   * because the technical team plans the rehearsal before publishing it.
   */
  isPublished: boolean;
  figureCount: number;
  /**
   * Assignments only exist on snapshotted instances, so `figureCount >
   * snapshottedFigureCount` explains empty cells without being a warning.
   */
  snapshottedFigureCount: number;
}

/**
 * A single placement of a person on a node.
 *
 * A person may hold SEVERAL placements in the same segment: the uniqueness of
 * person-per-segment is being dropped so technics can keep transient duplicates
 * while planning. Consumers must treat placements as a list, never as one value.
 */
export interface EventParticipationPlacement {
  assignmentId: string;
  instanceId: string;
  /** Already resolved server-side: `instance.label ?? template.name ?? 'Sense plantilla'`. */
  figureName: string;
  nodeId: string;
  nodeLabel: string;
  zone: FigureZone;
  /** Physical area derived from `zone` via `areaForZone` (BASE→TRONC, D10). */
  area: AssignmentArea;
  positionType: string | null;
  z: number;
  /** Cordon number. */
  renglaPosition: number | null;
}

export interface EventParticipationPersonPosition {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  positionTypes: string[];
  category: TagCategory;
}

/** One row of the matrix. */
export interface EventParticipationPerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  /** false = soft-deleted. Such a person may still hold placements, and is kept so
   *  an occupied node never shows up as free. */
  isActive: boolean;
  notes: string | null;
  notesEmoji: string | null;
  /** Plain data, never a warning. PENDENT when the person has no attendance row. */
  attendanceStatus: AttendanceStatus;
  positions: EventParticipationPersonPosition[];
  /**
   * Keyed by segment id; a missing key means the person does nothing in that segment.
   * Ordered by (zone, z, nodeLabel) so the rendering is deterministic.
   */
  placements: Record<string, EventParticipationPlacement[]>;
  /** Segments with at least one placement. */
  assignedSegmentCount: number;
  /** Total placements across the event. */
  placementCount: number;
  /**
   * Placements on TRONC/BASE nodes across the event (BASE→TRONC, D10). Feeds the
   * event-wide tronc-load metrics (Fase 6). In production (no duplicates yet) it is
   * simply the person's tronc occupancy — never a warning.
   */
  troncPlacementCount: number;
  /**
   * Segments where this person holds MORE than one placement — a *conflict*: the
   * person would have to be in two places at once. Computed server-side so the
   * semantics are defined once, and surfaced as an explicit warning in the UI.
   *
   * Placements in *different* segments are legal and are NOT conflicts.
   */
  conflictSegmentIds: string[];
}

export interface EventParticipationMeta {
  distinctPersons: number;
  /** Persons with at least one placement anywhere in the event. */
  personsWithPlacement: number;
  /** Total placements — diverges from `personsWithPlacement` once duplicates exist. */
  totalPlacements: number;
  /** Persons with at least one conflict. Feeds the header warning counter. */
  conflictedPersons: number;
  /**
   * Event-wide count of (person, segment) conflicts by kind, classified exactly like
   * the canonical `getSegmentConflicts` (D13). In production every value is `0` while
   * the uniqueness constraints still forbid duplicates — additive, never a warning.
   */
  conflictsByKind: Record<SegmentConflictKind, number>;
  /** Total placements on TRONC/BASE nodes across the event (BASE→TRONC, D10). */
  troncPlacements: number;
}

/**
 * Single composite resource, deliberately not the `{ data, meta }` paginated
 * envelope: the matrix needs every row at once to render complete columns.
 */
export interface EventParticipationOverview {
  event: { id: string; title: string; date: string };
  segments: EventParticipationSegment[];
  persons: EventParticipationPerson[];
  meta: EventParticipationMeta;
}
