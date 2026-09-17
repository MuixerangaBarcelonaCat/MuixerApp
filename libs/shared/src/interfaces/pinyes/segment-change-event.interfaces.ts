import { SegmentChangeSource } from '../../enums/segment-change-source.enum';

/**
 * Live invalidation signal pushed over SSE when figure data changes: "something
 * changed in this event, here are the affected segments". Deliberately carries
 * no node/assignment/person data — receivers refetch what they already have
 * open instead of patching, which keeps the imperative Konva canvas consistent.
 */
export interface FigureDataChangedEvent {
  eventId: string;
  /** Affected segments. Empty means event-wide (attendance, for instance). */
  segmentIds: string[];
  source: SegmentChangeSource;
  /**
   * The tab that caused the change, so it can skip telling itself somebody else
   * edited something. Null when unknown, or when one message coalesces changes
   * from several tabs and is therefore not attributable to one of them.
   */
  originClientId: string | null;
  occurredAt: string;
}
