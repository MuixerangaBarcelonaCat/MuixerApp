/**
 * What kind of mutation produced a live segment-change notification.
 *
 * Clients treat every source identically today (refetch the segment they have
 * open); the value exists so a banner can eventually say *what* changed.
 */
export enum SegmentChangeSource {
  ASSIGNMENT = 'ASSIGNMENT',
  AD_HOC_NODE = 'AD_HOC_NODE',
  CORDONS = 'CORDONS',
  INSTANCE = 'INSTANCE',
  SEGMENT_UPDATE = 'SEGMENT_UPDATE',
  ATTENDANCE = 'ATTENDANCE',
}
