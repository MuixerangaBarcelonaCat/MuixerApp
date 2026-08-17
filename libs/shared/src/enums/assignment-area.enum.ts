/**
 * Physical area an assignment lives in, derived from the node's {@link FigureZone}
 * via `areaForZone()`. Used for conflict classification and per-area dotació.
 *
 * NB (D10): BASE maps to TRONC here. The completeness/occupancy counters that group
 * PINYA + BASE are a separate concern and are intentionally left untouched (§5.3).
 */
export enum AssignmentArea {
  TRONC = 'TRONC',
  PINYA = 'PINYA',
  DIRECTION = 'DIRECTION',
}
