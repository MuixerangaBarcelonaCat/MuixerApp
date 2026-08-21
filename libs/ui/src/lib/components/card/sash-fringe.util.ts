export interface FringeThread {
  d: string;
  strokeWidth: number;
  opacity: number;
}

/** Deterministic PRNG (LCG) — same seed always produces the same weave, no external dependency. */
function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * The sash's fringe (flecos) — wavy horizontal threads emerging from the band's cut right edge,
 * approved after comparing straight/wavy/splayed variants. Deterministic per seed so the weave is
 * stable across re-renders instead of reshuffling every change detection.
 */
export function generateFringeThreads(height: number, maxLength: number, seed = 20260817): FringeThread[] {
  const rnd = pseudoRandom(seed);
  const threads: FringeThread[] = [];

  for (let y = 1.4; y < height; y += 2.2) {
    const length = maxLength * (0.55 + rnd() * 0.45);
    const amplitude = 1.2 + rnd() * 1.8;
    const strokeWidth = 0.9 + rnd() * 0.7;
    const opacity = 0.55 + rnd() * 0.45;
    const drift = (rnd() - 0.5) * 3.2;
    const end = y + drift;

    const d = `M0 ${y.toFixed(1)} C ${(length * 0.3).toFixed(1)} ${(y - amplitude).toFixed(1)}, ${(length * 0.62).toFixed(1)} ${((y + end) / 2 + amplitude).toFixed(1)}, ${length.toFixed(1)} ${end.toFixed(1)}`;

    threads.push({ d, strokeWidth, opacity });
  }

  return threads;
}
