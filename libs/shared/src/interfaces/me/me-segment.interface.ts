import { SegmentTitleInstance } from '../../utils/segment-title.util';

/** One of the caller's own assignments in the segment — raw pieces, see `formatOwnPositionSummary`. */
export interface MeSegmentPlacement {
  nodeLabel: string;
  cordon: number | null;
  figureName: string | null;
  figureMode: string;
}

export interface MeSegment {
  id: string;
  name: string | null;
  sortOrder: number;
  instances: SegmentTitleInstance[];
  /** The caller's own placements in this segment. Normally 0 or 1; invariant 4 permits more. */
  myPlacements: MeSegmentPlacement[];
}
