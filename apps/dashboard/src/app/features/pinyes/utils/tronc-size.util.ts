// Constants matching TroncViewComponent's CSS grid:
// 1 grid unit = 2 half-units × 40px, plus a 40px label column.
export const TRONC_HALF_UNIT_PX = 40;
export const TRONC_LABEL_COL_PX = 60;
// Floor row height = 3rem (48px), header = 2rem (32px).
export const TRONC_FLOOR_ROW_PX = 32;
export const TRONC_HEADER_PX = 40;
export const TRONC_GAP_PX = 16;
// Extra height reserved for the figure name header shown in projection mode panels.

/**
 * Computes the natural (unscaled) pixel dimensions of a TroncViewComponent panel
 * given the number of grid columns and rows.
 *
 * @param gridCols - Number of full-unit columns (each = 2 half-unit CSS columns).
 * @param gridRows - Number of floor rows (each = 3rem / 48px).
 */
export function computeTroncNaturalSize(
  gridCols: number,
  gridRows: number,
): { naturalW: number; naturalH: number } {
  const effectiveCols = Math.max(gridCols, 1);
  const effectiveRows = Math.max(gridRows, 1);
  return {
    naturalW: effectiveCols * 2 * TRONC_HALF_UNIT_PX + TRONC_LABEL_COL_PX,
    naturalH: effectiveRows * TRONC_FLOOR_ROW_PX + TRONC_HEADER_PX,
  };
}
