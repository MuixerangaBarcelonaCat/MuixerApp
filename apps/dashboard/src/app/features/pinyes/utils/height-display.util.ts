export const HEIGHT_BASELINE = 140;

/**
 * Formats a shoulder height value for display.
 * Returns '-' when the height is null, 0, or equals the baseline.
 *
 * @param height Raw shoulder height in cm (absolute)
 * @param mode   'relative' → show +/- diff from 140cm baseline; 'absolute' → show raw cm value
 */
export function formatShoulderHeight(
  height: number | null | undefined,
  mode: 'relative' | 'absolute',
): string {
  if (height === null || height === undefined || height === 0 || height === HEIGHT_BASELINE) {
    return '-';
  }
  if (mode === 'relative') {
    const diff = height - HEIGHT_BASELINE;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  }
  return `${height} cm`;
}

/**
 * Compact height label without unit suffix (used in Konva canvas badges and TroncView cells).
 * Returns empty string for absent/baseline heights.
 */
export function formatShoulderHeightCompact(
  height: number | null | undefined,
  mode: 'relative' | 'absolute',
): string {
  if (height === null || height === undefined || height === 0) return '';
  if (mode === 'absolute') return `${height}`;
  const diff = height - HEIGHT_BASELINE;
  return diff >= 0 ? `+${diff}` : `${diff}`;
}
