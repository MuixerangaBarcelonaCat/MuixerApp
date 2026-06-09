export interface BaseNodeForValidation {
  sortOrder: number;
  x: number;
  y: number;
}

export interface BaseValidationResult {
  isValid: boolean;
  /**
   * Human-readable issues in Catalan. Empty when isValid = true.
   * Each entry names the specific pair that breaks the expected CCW order.
   */
  issues: string[];
}

/**
 * Validates that a set of BASE nodes follows the counter-clockwise (anti-horari)
 * convention starting from the top-left, as required for correct TRONC alignment.
 *
 * Convention (looking at the canvas from above, y increases downward):
 *   Base 1 = top-left
 *   Base 2 = bottom-left
 *   Base 3 = bottom-right
 *   Base 4 = top-right
 *   (continues CCW for more bases)
 *
 * Algorithm:
 *   1. Sort bases by sortOrder (ascending).
 *   2. Compute centroid (avg x, avg y).
 *   3. For each base, compute the screen-space atan2 angle from the centroid.
 *   4. Measure how far CCW (in screen space) each base is from Base 1:
 *      ccw_from_start = (theta_start - theta + 2π) mod 2π
 *      In screen coords (y down), CCW visual = decreasing atan2, so subtracting gives
 *      a value that increases as we go further CCW from the starting base.
 *   5. Check that ccw_from_start values are strictly increasing with sortOrder.
 *
 * Returns isValid: true for < 2 bases (ordering is undefined).
 */
export function validateBaseOrdering(
  bases: BaseNodeForValidation[],
): BaseValidationResult {
  if (bases.length < 2) {
    return { isValid: true, issues: [] };
  }

  const sorted = [...bases].sort((a, b) => a.sortOrder - b.sortOrder);

  const cx = sorted.reduce((sum, b) => sum + b.x, 0) / sorted.length;
  const cy = sorted.reduce((sum, b) => sum + b.y, 0) / sorted.length;

  const PI2 = 2 * Math.PI;
  const startTheta = Math.atan2(sorted[0].y - cy, sorted[0].x - cx);

  const ccwAngles = sorted.map((b) => {
    const theta = Math.atan2(b.y - cy, b.x - cx);
    return ((startTheta - theta) % PI2 + PI2) % PI2;
  });
  // ccwAngles[0] === 0 always (the starting base)

  const issues: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (ccwAngles[i] <= ccwAngles[i - 1]) {
      const baseNum = i + 1;
      const prevBaseNum = i;
      issues.push(
        `Base ${baseNum} no segueix l'ordre anti-horari esperat respecte Base ${prevBaseNum}`,
      );
    }
  }

  return { isValid: issues.length === 0, issues };
}
