/** Dot radius on screen, in CSS pixels, as on the preview's bullet-journal paper. */
const DOT_RADIUS = 1.1;
/** Closest two dots may sit on screen before the grid thins out. */
const MIN_SCREEN_GAP = 12;

/**
 * The canvas's dot grid ("bullet journal" paper) over the visible world rect `view`: a dot on every
 * crossing of a grid `spacing` apart, in world units. Zoomed out, the step doubles until dots sit at
 * least `MIN_SCREEN_GAP` apart on screen, so the paper never turns grey. Dots keep one size on
 * screen at any zoom (`radius` is in world units).
 */
export function dotGrid(
  view: { left: number; top: number; right: number; bottom: number },
  spacing: number,
  scale: number,
): { step: number; xs: number[]; ys: number[]; radius: number } {
  let step = spacing;
  while (step * scale < MIN_SCREEN_GAP) step *= 2;
  return { step, xs: crossings(view.left, view.right, step), ys: crossings(view.top, view.bottom, step), radius: DOT_RADIUS / scale };
}

/** Multiples of `step` from at or before `from` to at or past `to`. */
function crossings(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let v = Math.floor(from / step) * step; v < to + step; v += step) values.push(v);
  return values;
}
