export interface Point {
  x: number;
  y: number;
}

/** Euclidean distance between two points (used for pinch-zoom finger spread). */
export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Midpoint between two points (used as the pinch-zoom focal point). */
export function touchMidpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Clamps a stage scale to the given [min, max] range. */
export function clampScale(scale: number, min: number, max: number): number {
  return Math.min(Math.max(scale, min), max);
}

/**
 * Computes the new stage position so that `focalPoint` (in stage/screen coordinates)
 * stays fixed over the same world-space point when the scale changes from
 * `oldScale` to `newScale`. Same math as Konva's wheel-zoom recipe, generalized to
 * an arbitrary focal point (pinch midpoint or pointer position).
 */
export function zoomAroundPoint(
  stagePos: Point,
  oldScale: number,
  newScale: number,
  focalPoint: Point,
): Point {
  const worldPoint = {
    x: (focalPoint.x - stagePos.x) / oldScale,
    y: (focalPoint.y - stagePos.y) / oldScale,
  };
  return {
    x: focalPoint.x - worldPoint.x * newScale,
    y: focalPoint.y - worldPoint.y * newScale,
  };
}

/**
 * Extracts a client-space point from either a MouseEvent or a TouchEvent, so
 * pointer-tracking logic (e.g. the rotation handle) can treat both uniformly.
 * For TouchEvent, prefers `touches` (start/move) and falls back to
 * `changedTouches` (end). Returns null when no touch point is available.
 */
export function getEventClientPoint(event: MouseEvent | TouchEvent): Point | null {
  if ('touches' in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

/**
 * Computes the rotation angle (degrees) of `pointer` around `center`, using the
 * same convention as the existing mouse-only rotation handle: 0deg points up,
 * increasing clockwise. Optionally snaps to the nearest 15deg increment.
 */
export function computeRotationAngleDeg(
  pointer: Point,
  center: Point,
  snapToGrid: boolean,
  snapIncrementDeg = 15,
): number {
  const angleDeg = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;
  return snapToGrid ? Math.round(angleDeg / snapIncrementDeg) * snapIncrementDeg : angleDeg;
}
