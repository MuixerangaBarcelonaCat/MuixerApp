import type { RoughSVG } from 'roughjs/bin/svg';
import type { Options } from 'roughjs/bin/core';
import { SilhouetteLayout, SilhouettePerson } from '../../utils/tronc-silhouette-layout.util';

/** mulberry32 — mirrors the layout util's PRNG so a person's own glyph jitter is stable too. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * roughjs's default sketchiness is tuned for normal-sized shapes — at a marker this small
 * (~5-7px radius) it explodes into noise unless the offset/roughness scale down with it.
 */
function roughOpts(seed: number, r: number, extra: Partial<Options>): Options {
  return {
    seed: seed >>> 0,
    roughness: 1.0,
    bowing: 0.8,
    maxRandomnessOffset: Math.max(0.5, Math.min(1.3, r * 0.18)),
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    strokeWidth: 1.4,
    preserveVertices: true,
    ...extra,
  };
}

/**
 * A little sketched muixeranger: head, curved torso, two braced legs, two arms. `r` is a
 * half-unit — every proportion derives from it, whether this is a base-floor person or the
 * top of the tronc; no floor is drawn heavier than another.
 *
 * `reach` controls the arms: `0` (default) is the tronc people's own outward, braced-apart
 * stance. `1`/`-1` is the pinya's stance instead — both arms raised and angled toward that
 * side (the tronc they're bracing), used for the people drawn flanking the base when a
 * figure has a pinya.
 */
export function buildPersonGlyphMarkup(
  rc: RoughSVG,
  x: number,
  y: number,
  r: number,
  seed: number,
  color: string,
  reach: 0 | 1 | -1 = 0,
): string {
  const rnd = mulberry32(seed);
  const lean = (rnd() - 0.5) * r * 0.5;
  const headR = r * 0.42;
  const headCy = y - r * 1.5;
  const shoulderY = y - r * 0.92;
  const hipY = y - r * 0.05;
  const footY = y + r * 0.7;

  let markup = '';
  markup += rc.circle(
    x + lean * 0.5,
    headCy,
    headR * 2,
    roughOpts(seed, r, { stroke: color, fill: color, fillStyle: 'solid', strokeWidth: 1.2 }),
  ).innerHTML;
  markup += rc.curve(
    [
      [x + lean * 0.5 - headR * 0.3, shoulderY],
      [x + lean * 0.8, (shoulderY + hipY) / 2],
      [x + lean, hipY],
    ],
    roughOpts(seed + 1, r, { stroke: color, strokeWidth: 1.6 }),
  ).innerHTML;
  markup += rc.line(
    x + lean,
    hipY,
    x + lean - r * 0.5,
    footY,
    roughOpts(seed + 2, r, { stroke: color, strokeWidth: 1.4 }),
  ).innerHTML;
  markup += rc.line(
    x + lean,
    hipY,
    x + lean + r * 0.5,
    footY,
    roughOpts(seed + 3, r, { stroke: color, strokeWidth: 1.4 }),
  ).innerHTML;

  if (reach === 0) {
    markup += rc.line(
      x + lean * 0.5 - headR * 0.7,
      shoulderY,
      x + lean * 0.5 - r * 0.85,
      shoulderY + r * 0.32,
      roughOpts(seed + 4, r, { stroke: color, strokeWidth: 1.3 }),
    ).innerHTML;
    markup += rc.line(
      x + lean * 0.5 + headR * 0.7,
      shoulderY,
      x + lean * 0.5 + r * 0.85,
      shoulderY + r * 0.32,
      roughOpts(seed + 5, r, { stroke: color, strokeWidth: 1.3 }),
    ).innerHTML;
  } else {
    // Pinya stance: both arms raised straight up, leaning only slightly toward `reach`'s side
    // (the tronc they're bracing) — mostly vertical, not braced outward.
    const raiseY = shoulderY - r * 1.6;
    markup += rc.line(
      x + lean * 0.5 - headR * 0.6,
      shoulderY,
      x + lean * 0.5 + reach * r * 0.9,
      raiseY + r * 0.15,
      roughOpts(seed + 4, r, { stroke: color, strokeWidth: 1.3 }),
    ).innerHTML;
    markup += rc.line(
      x + lean * 0.5 + headR * 0.6,
      shoulderY,
      x + lean * 0.5 + reach * r * 1.25,
      raiseY,
      roughOpts(seed + 5, r, { stroke: color, strokeWidth: 1.3 }),
    ).innerHTML;
  }

  return markup;
}

/** Draws every person in a layout, each with its own seed derived from `seedBase` + its index. */
export function buildSilhouetteMarkup(
  rc: RoughSVG,
  layout: SilhouetteLayout,
  seedBase: number,
  color: string,
): string {
  return layout.people
    .map((p: SilhouettePerson, idx: number) =>
      buildPersonGlyphMarkup(rc, p.x, p.y, p.r * 1.35, (seedBase * 31 + idx * 97) >>> 0, color),
    )
    .join('');
}

export interface PinyaMarkup {
  markup: string;
  /** Horizontal extent including the pinya people — 0/layout.width unchanged when there's none. */
  minX: number;
  maxX: number;
}

const PINYA_PER_SIDE = 2;
/** Arbitrary fixed offset so the pinya's own jitter never happens to match a tronc person's. */
const PINYA_SEED_SALT = 0x50494e59;

/**
 * The pinya — the crowd bracing the tower at ground level, drawn (not merely implied) beside
 * the base row, each person reaching in and up toward the tronc rather than braced outward.
 * Secondary-colored, so it reads as a distinct group from the tronc/base people.
 */
export function buildPinyaMarkup(
  rc: RoughSVG,
  layout: SilhouetteLayout,
  seedBase: number,
  color: string,
): PinyaMarkup {
  const baseFloor = layout.people.filter((p) => p.floor === 0);
  if (baseFloor.length === 0) {
    return { markup: '', minX: 0, maxX: layout.width };
  }

  const avgR = baseFloor.reduce((sum, p) => sum + p.r, 0) / baseFloor.length;
  const avgY = baseFloor.reduce((sum, p) => sum + p.y, 0) / baseFloor.length;
  // Distance from the base's own edge to the nearest pinya person, kept separate from the gap
  // between consecutive pinya people on the same side — tightening one shouldn't touch the other.
  const edgeGap = avgR * 0.35;
  const peopleGap = avgR * 1.4;
  const rnd = mulberry32(seedBase ^ PINYA_SEED_SALT);

  let markup = '';
  let minX = 0;
  let maxX = layout.width;

  for (let i = 0; i < PINYA_PER_SIDE; i++) {
    const x = -(edgeGap + i * peopleGap) + (rnd() - 0.5) * avgR * 0.3;
    const y = avgY + (rnd() - 0.5) * avgR * 0.4;
    markup += buildPersonGlyphMarkup(rc, x, y, avgR, (seedBase * 17 + i * 131) >>> 0, color, 1);
    minX = Math.min(minX, x - avgR);
  }
  for (let i = 0; i < PINYA_PER_SIDE; i++) {
    const x = layout.width + edgeGap + i * peopleGap + (rnd() - 0.5) * avgR * 0.3;
    const y = avgY + (rnd() - 0.5) * avgR * 0.4;
    markup += buildPersonGlyphMarkup(rc, x, y, avgR, (seedBase * 19 + i * 151) >>> 0, color, -1);
    maxX = Math.max(maxX, x + avgR);
  }

  return { markup, minX, maxX };
}

/** A single hand-drawn ground line, same sketch quality as the people standing on it. */
export function buildGroundLineMarkup(
  rc: RoughSVG,
  x1: number,
  x2: number,
  y: number,
  seed: number,
  color: string,
): string {
  return rc.line(x1, y, x2, y, roughOpts(seed, 6, { stroke: color, strokeWidth: 1.6 })).innerHTML;
}
