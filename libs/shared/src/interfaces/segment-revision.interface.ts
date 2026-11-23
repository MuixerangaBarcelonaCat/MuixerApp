/** Staff view: what changed since the last poll decides what to refetch. */
export interface SegmentRevision {
  /** Nodes and assignments of the segment's figures (`assignment-state`). */
  state: number;
  /** Figures added/removed/moved/edited, or the segment itself. */
  structure: number;
  /** Any attendance write of the event. */
  attendance: number;
}
