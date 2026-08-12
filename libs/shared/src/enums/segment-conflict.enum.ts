/**
 * Kind of a >1-placement conflict for one person within a single segment.
 *
 * The declaration order IS the display order in lists/banners
 * (TRONC_TRONC first, then TRONC_PINYA, then PINYA_PINYA). There is no severity:
 * all three are painted and announced identically — the kind only drives the
 * ordering and the one-tap suggestion (§4.1).
 */
export enum SegmentConflictKind {
  TRONC_TRONC = 'TRONC_TRONC',
  TRONC_PINYA = 'TRONC_PINYA',
  PINYA_PINYA = 'PINYA_PINYA',
}
