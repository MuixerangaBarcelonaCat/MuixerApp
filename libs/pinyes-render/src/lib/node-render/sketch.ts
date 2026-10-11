import { RoughGenerator } from 'roughjs/bin/generator';
import type { Drawable, Options } from 'roughjs/bin/core';
import { NodeFill } from './appearance';
import { NodeOutline } from './outline';

/**
 * The hand-drawn pen of the figure canvas and the tronc panel: rough.js shapes turned into plain
 * path data, so the Konva painter and the SVG painter draw exactly the same strokes. Every shape is
 * seeded (from the node's id), so a node's wobble never changes between renders.
 */

/** mulberry32: a small deterministic PRNG, seeded by a plain 32-bit int. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash: small, fast, good enough spread for a visual seed (not cryptographic). */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * rough.js options: one pen stroke, a light wobble. The preview (Pinya Canvas Options) had
 * roughness 0.9; nodes packed edge to edge looked crammed, so it is 0.6 (a standard node's
 * outline strays at most ~1.5 units past its edge, inside `NODE_SKETCH_INSET`). rough.js's default offset is tuned for normal-sized shapes; at a small
 * mark it explodes into noise, so it scales down with `size` (about the shape's half-height).
 */
export function roughOpts(
  seed: number,
  size: number,
  extra: Partial<Options> = {},
): Options {
  return {
    // rough.js takes a zero seed as "random every time".
    seed: ((seed >>> 0) % 2147483646) + 1,
    roughness: 0.6,
    bowing: 0.6,
    maxRandomnessOffset: Math.max(0.5, Math.min(2, size * 0.18)),
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    ...extra,
  };
}

/**
 * How far the pen may stray on a shape whose smaller side is `size`: 5% of it, so a node wobbles in
 * proportion to its size, never below 0.4 (a tiny mark still looks drawn by hand) and never past 2
 * (a standard 40-tall node; a bigger one wobbles no more).
 */
export function sketchWobble(size: number): number {
  return Math.min(2, Math.max(0.4, size * 0.05));
}

/** One path of a sketch: a fill (a solid wash, or hatching drawn as pen lines) or the pen outline. */
export interface SketchPath {
  role: 'fill' | 'outline';
  d: string;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  dash: number[] | null;
}

/** Pending hatching, as previewed: lines 6 apart, 1 thick, at −41°. */
const HATCH = { hachureGap: 6, fillWeight: 1, hachureAngle: -41 };

const generator = new RoughGenerator();
/** Sketches by everything that shapes them; a node redrawn unchanged reuses its paths. */
const cache = new Map<string, SketchPath[]>();
const CACHE_LIMIT = 4000;

function cached(key: string, build: () => SketchPath[]): SketchPath[] {
  const hit = cache.get(key);
  if (hit) return hit;
  const paths = build();
  if (cache.size >= CACHE_LIMIT)
    cache.delete(cache.keys().next().value as string);
  cache.set(key, paths);
  return paths;
}

/** rough.js op sets as paths: `path` is the pen outline, `fillPath` a solid wash, `fillSketch` hatching. */
function toSketch(drawable: Drawable, dash: number[] | null): SketchPath[] {
  const o = drawable.options;
  return drawable.sets.map((set) => {
    const d = generator.opsToPath(set);
    switch (set.type) {
      case 'path':
        return {
          role: 'outline',
          d,
          fill: null,
          stroke: o.stroke,
          strokeWidth: o.strokeWidth,
          dash,
        };
      case 'fillPath':
        return {
          role: 'fill',
          d,
          fill: o.fill ?? null,
          stroke: null,
          strokeWidth: 0,
          dash: null,
        };
      case 'fillSketch':
        return {
          role: 'fill',
          d,
          fill: null,
          stroke: o.fill ?? null,
          strokeWidth: o.fillWeight,
          dash: null,
        };
    }
  });
}

function fillOptions(fill: NodeFill): Partial<Options> {
  switch (fill.style) {
    case 'solid':
      return { fill: fill.color, fillStyle: 'solid' };
    case 'hatch':
      return { fill: fill.color, fillStyle: 'hachure', ...HATCH };
    case 'none':
      return {};
  }
}

/** A node's outline, sketched, with its fill under it; centred on (0, 0). */
export function sketchShape(
  outline: NodeOutline,
  style: {
    fill: NodeFill;
    stroke: string;
    strokeWidth: number;
    dash: number[] | null;
  },
  seed: number,
): SketchPath[] {
  const key = `shape|${JSON.stringify(outline)}|${JSON.stringify(style)}|${seed}`;
  return cached(key, () => {
    const size =
      outline.kind === 'ellipse'
        ? 2 * Math.min(outline.radiusX, outline.radiusY)
        : smallerSide(outline);
    const opts = roughOpts(seed, size, {
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      maxRandomnessOffset: sketchWobble(size),
      ...fillOptions(style.fill),
    });
    return toSketch(drawOutline(outline, opts), style.dash);
  });
}

function smallerSide(
  outline: Exclude<NodeOutline, { kind: 'ellipse' }>,
): number {
  if (outline.kind === 'rect') return Math.min(outline.width, outline.height);
  const ys = outline.points.filter((_, i) => i % 2 === 1);
  const xs = outline.points.filter((_, i) => i % 2 === 0);
  return Math.min(
    Math.max(...ys) - Math.min(...ys),
    Math.max(...xs) - Math.min(...xs),
  );
}

function drawOutline(outline: NodeOutline, opts: Options): Drawable {
  switch (outline.kind) {
    case 'rect':
      return generator.rectangle(
        -outline.width / 2,
        -outline.height / 2,
        outline.width,
        outline.height,
        opts,
      );
    case 'ellipse':
      return generator.ellipse(
        0,
        0,
        outline.radiusX * 2,
        outline.radiusY * 2,
        opts,
      );
    case 'polygon': {
      const points: [number, number][] = [];
      for (let i = 0; i < outline.points.length; i += 2)
        points.push([outline.points[i], outline.points[i + 1]]);
      return generator.polygon(points, opts);
    }
  }
}

/** The conflict loop: a looser pen that rings the node twice, as a hand circling a mistake would. */
export function sketchLoop(
  radiusX: number,
  radiusY: number,
  color: string,
  width: number,
  seed: number,
): SketchPath[] {
  return cached(`loop|${radiusX}|${radiusY}|${color}|${width}|${seed}`, () =>
    toSketch(
      generator.ellipse(
        0,
        0,
        radiusX * 2,
        radiusY * 2,
        roughOpts(seed, radiusY, {
          stroke: color,
          strokeWidth: width,
          roughness: 1.3,
          disableMultiStroke: false,
          maxRandomnessOffset: sketchWobble(2 * Math.min(radiusX, radiusY)),
        }),
      ),
      null,
    ),
  );
}

/** A sketched, filled circle: the observation sticker. */
export function sketchDisc(
  disc: {
    x: number;
    y: number;
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  },
  seed: number,
): SketchPath[] {
  return cached(`disc|${JSON.stringify(disc)}|${seed}`, () =>
    toSketch(
      generator.circle(
        disc.x,
        disc.y,
        disc.radius * 2,
        roughOpts(seed, disc.radius, {
          fill: disc.fill,
          fillStyle: 'solid',
          stroke: disc.stroke,
          strokeWidth: disc.strokeWidth,
          maxRandomnessOffset: sketchWobble(disc.radius * 2),
        }),
      ),
      null,
    ),
  );
}
