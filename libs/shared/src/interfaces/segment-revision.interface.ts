/** Staff view: what changed since the last poll decides what to refetch. */
export interface SegmentRevision {
  /** Nodes and assignments of the segment's figures (`assignment-state`). */
  state: number;
  /** Figures added/removed/moved/edited, or the segment itself. */
  structure: number;
  /** Any attendance write of the event. */
  attendance: number;
}

/** A technician counts as editing a segment for this long after their last mutation in it. */
export const PRESENCE_EDITING_WINDOW_MS = 30_000;

export interface SegmentEditor {
  userId: string;
  alias: string;
}

/** Staff revision response: the revision plus who else is editing the segment right now. */
export interface StaffSegmentRevision extends SegmentRevision {
  editors: SegmentEditor[];
}
