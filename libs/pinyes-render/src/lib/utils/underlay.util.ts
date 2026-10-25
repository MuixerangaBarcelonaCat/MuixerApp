/**
 * The projection's gesture underlay: while a pan/pinch moves the drawn canvas (see
 * `FigureCanvasComponent.deferGestureRedraw`), the edges it reveals would be bare paper. A softer
 * bitmap of the whole segment, drawn once whenever the drawing changes, sits under the canvas to
 * fill them: it serves every view, so back-to-back flicks never outrun it.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The underlay's longest side, in device pixels. With the segment about 4–5 screens wide (after
 * Troba'm) that leaves ≈1.5–1.7 device px per CSS px on a phone (the canvas: 2); 18 MB for a wide
 * segment, 37 MB at most (a square one). Never past 4096: iOS's canvas area limit.
 */
export const UNDERLAY_MAX_SIDE = 3072;

/** The bounds of `rects`, skipping empty ones; null when none has an area. */
export function unionRect(rects: Rect[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.width === 0 && r.height === 0) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Where to draw the underlay and how sharp: everything drawn (`content`, screen px at the
 * committed transform), snapped outward to whole pixels, at the ratio that puts its longest side
 * at `maxSide` device pixels — never the screen's ratio, since one copy has to serve every zoom.
 */
export function underlayPlan(content: Rect, maxSide: number): { rect: Rect; pixelRatio: number } | null {
  const left = Math.floor(content.x);
  const top = Math.floor(content.y);
  const right = Math.ceil(content.x + content.width);
  const bottom = Math.ceil(content.y + content.height);
  if (right <= left || bottom <= top) return null;

  const rect = { x: left, y: top, width: right - left, height: bottom - top };
  return { rect, pixelRatio: maxSide / Math.max(rect.width, rect.height) };
}

/**
 * Runs `cb` when the main thread is idle (or after `timeout` ms at the latest, so a busy phone still
 * gets it); returns a canceller. Safari has no `requestIdleCallback`: there it is a short timeout.
 */
export function whenIdle(cb: () => void, timeout = 500): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(() => cb(), { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 100);
  return () => clearTimeout(id);
}
