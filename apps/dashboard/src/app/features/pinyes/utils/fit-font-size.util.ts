/**
 * Finds the largest font size (from maxFont down to minFont in 0.5 steps) for
 * which the text fits within the given box.
 *
 * @param measure - called with each candidate fontSize; returns the actual
 *   content width and height at that size (must account for wrapping/newlines).
 */
export function fitFontSize(
  maxFont: number,
  minFont: number,
  maxW: number,
  maxH: number,
  wrap: 'none' | 'word',
  measure: (fontSize: number) => { width: number; height: number },
): number {
  for (let fs = maxFont; fs >= minFont; fs -= 0.5) {
    const { width, height } = measure(fs);
    const fitsWidth = wrap === 'word' || width <= maxW;
    if (fitsWidth && height <= maxH) return fs;
  }
  return minFont;
}
