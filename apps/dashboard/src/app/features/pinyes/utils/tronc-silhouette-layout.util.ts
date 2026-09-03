/**
 * Pure, seeded layout for the template-preview drawing (`TemplatePreviewDrawingComponent`):
 * places one "person" mark per tronc/base floor from a template's `troncProfile`
 * (`FigureTemplateListItem.troncProfile` — people per floor, bottom-to-top, index 0 = bases).
 * Pinya is never represented. Every floor gets the same jitter/size treatment — bases are
 * not visually emphasized (per direction: "they are as important as anything else").
 *
 * Deterministic: the same profile + seed always produce the same positions, so a card's
 * drawing doesn't reshuffle on every re-render. Seed a call from something stable per figure
 * (its name, or name+profile) via `hashSeed`.
 */

const UNIT = 14;
const ROW_HEIGHT = 16;
const PADDING = 8;
const JITTER_RATIO = 0.22;
const GROUP_GAP = 14;
const MAX_GROUP_FIGURES = 3;
/** Scale per figure count so 1 figure draws full-size and 3 shrink enough to sit side by side. */
const GROUP_SCALE_BY_COUNT: Record<number, number> = { 1: 1, 2: 0.88, 3: 0.78 };

export interface SilhouettePerson {
  x: number;
  y: number;
  r: number;
  /** Index into the source profile — 0 = bases. */
  floor: number;
}

export interface SilhouetteLayout {
  width: number;
  height: number;
  people: SilhouettePerson[];
}

/** FNV-1a string hash — small, fast, good enough spread for a visual seed (not cryptographic). */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG, seeded by a plain 32-bit int. */
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

export function layoutTroncSilhouette(
  profile: number[],
  seed: number,
  scale = 1,
): SilhouetteLayout {
  const rnd = mulberry32(seed);
  const u = UNIT * scale;
  const rh = ROW_HEIGHT * scale;
  const pad = PADDING * scale;
  const rows = profile.length;
  const maxN = Math.max(...profile, 1);
  const width = maxN * u + pad * 2;
  const height = rows * rh + pad * 2;
  const baseY = height - pad;

  const people: SilhouettePerson[] = [];
  for (let floor = 0; floor < rows; floor++) {
    const n = profile[floor];
    const rowWidth = n * u;
    const x0 = width / 2 - rowWidth / 2;
    const yCenter = baseY - (floor + 0.5) * rh;
    for (let k = 0; k < n; k++) {
      const jx = (rnd() - 0.5) * u * JITTER_RATIO;
      const jy = (rnd() - 0.5) * rh * JITTER_RATIO;
      const r = u * 0.4 * (0.9 + rnd() * 0.22);
      people.push({ x: x0 + u * (k + 0.5) + jx, y: yCenter + jy, r, floor });
    }
  }

  return { width, height, people };
}

/** Deterministic 32-bit combine — a per-figure seed derived from a shared base + its position. */
function combineSeed(base: number, index: number): number {
  return (base ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
}

/**
 * Lays out several figures' tronc silhouettes side by side, baseline-aligned — the drawing for
 * a composition card (`CompositionListItem.figureProfiles`). A single figure's card
 * (`FigureTemplateListItem.troncProfile`) is the n=1 case of the same function: pass `[profile]`.
 *
 * When there are more than 3 figures, only the 3 tallest are drawn, tallest centered and
 * flanked by the next two — a composition can have many entries, more than a small card can
 * show individually.
 */
export function layoutTroncGroup(profiles: number[][], seed: number): SilhouetteLayout {
  const ranked = profiles
    .map((profile, index) => ({
      profile,
      index,
      floors: profile.length,
      total: profile.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.floors - a.floors || b.total - a.total)
    .slice(0, MAX_GROUP_FIGURES);

  const ordered: typeof ranked = [];
  ranked.forEach((entry, i) => {
    if (i === 0) {
      ordered.splice(Math.floor(ordered.length / 2), 0, entry);
    } else if (i % 2 === 1) {
      ordered.push(entry);
    } else {
      ordered.unshift(entry);
    }
  });

  const scale = GROUP_SCALE_BY_COUNT[ordered.length] ?? GROUP_SCALE_BY_COUNT[MAX_GROUP_FIGURES];
  const gap = GROUP_GAP * scale;

  // A lone figure draws with the seed as given — nothing else to disambiguate it from, and
  // this keeps a single-figure drawing an exact n=1 case of this function, not a lookalike.
  const figures = ordered.map((entry) =>
    layoutTroncSilhouette(
      entry.profile,
      ordered.length === 1 ? seed : combineSeed(seed, entry.index),
      scale,
    ),
  );

  const height = Math.max(0, ...figures.map((f) => f.height));
  const people: SilhouettePerson[] = [];
  let x = 0;
  figures.forEach((figure) => {
    const yOffset = height - figure.height;
    figure.people.forEach((p) => people.push({ ...p, x: p.x + x, y: p.y + yOffset }));
    x += figure.width + gap;
  });
  const width = Math.max(0, x - gap);

  return { width, height, people };
}

/**
 * Where a "ground" line under the drawing should sit — just past the feet of the base-floor
 * (floor 0) people, the row the pinya (the bracing crowd, drawn separately) would stand beside.
 */
export function computeGroundY(layout: SilhouetteLayout): number {
  const baseFloor = layout.people.filter((p) => p.floor === 0);
  if (baseFloor.length === 0) return layout.height;
  return Math.max(...baseFloor.map((p) => p.y + p.r)) + 4;
}
