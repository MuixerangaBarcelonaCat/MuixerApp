export enum SegmentMoveConflictResolution {
  KEEP_TARGET = 'KEEP_TARGET',
  KEEP_MOVED = 'KEEP_MOVED',
  /**
   * New default from Fase 5 on (D3): keep the placements on both sides of the move,
   * turning cross-segment overlaps into (legal) conflicts instead of forcing a
   * destructive resolution. Declared now but not yet consumed — the move flow keeps
   * the forced KEEP_TARGET/KEEP_MOVED behaviour until Fase 5.
   */
  KEEP_BOTH = 'KEEP_BOTH',
}
