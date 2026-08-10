import { AssignmentArea } from '../../enums/assignment-area.enum';
import { FigureZone } from '../../enums/figure-zone.enum';
import { SegmentConflictKind } from '../../enums/segment-conflict.enum';

/**
 * One of a person's >1 placements within a conflicted segment.
 */
export interface ConflictPlacement {
  assignmentId: string;
  figureInstanceId: string;
  figureName: string;
  nodeId: string;
  nodeLabel: string | null;
  zone: FigureZone;
  area: AssignmentArea;
  z: number | null;
  renglaPosition: number | null;
  cordon: number | null;
}

/**
 * A single person holding >1 placement within one segment.
 *
 * `placements` is ordered tronc-first (see `areaForZone` rank). `suggestedRemovalAssignmentIds`
 * is empty for a pure TRONC_TRONC conflict — see `getSegmentConflicts` for the per-kind rule.
 */
export interface SegmentConflict {
  personId: string;
  personAlias: string;
  placements: ConflictPlacement[];
  kind: SegmentConflictKind;
  suggestedRemovalAssignmentIds: string[];
}

/**
 * Dotació/conflict counters for a whole segment, computed over every assignment in it
 * (not just the conflicted ones).
 */
export interface SegmentPeopleCounters {
  assignmentCount: number;
  distinctPersonCount: number;
  tronc: { distinctPersonCount: number };
  pinya: { distinctPersonCount: number };
  conflictPersonCount: number;
  conflictsByKind: Record<SegmentConflictKind, number>;
}

export interface SegmentConflictsResponse {
  data: SegmentConflict[];
  meta: SegmentPeopleCounters;
}
