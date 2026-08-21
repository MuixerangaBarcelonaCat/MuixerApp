import { generateFringeThreads } from './sash-fringe.util';

describe('generateFringeThreads', () => {
  it('is deterministic — the same seed produces the same threads', () => {
    const a = generateFringeThreads(30, 34, 20260817);
    const b = generateFringeThreads(30, 34, 20260817);
    expect(a).toEqual(b);
  });

  it('produces different threads for a different seed', () => {
    const a = generateFringeThreads(30, 34, 1);
    const b = generateFringeThreads(30, 34, 2);
    expect(a).not.toEqual(b);
  });

  it('produces roughly one thread per 2.2px of height', () => {
    const threads = generateFringeThreads(30, 34);
    expect(threads.length).toBeGreaterThanOrEqual(12);
    expect(threads.length).toBeLessThanOrEqual(14);
  });

  it('scales thread count with height', () => {
    const short = generateFringeThreads(16, 34);
    const tall = generateFringeThreads(38, 34);
    expect(tall.length).toBeGreaterThan(short.length);
  });

  it('starts every path at x=0, the cut edge of the band', () => {
    const threads = generateFringeThreads(30, 34);
    for (const t of threads) {
      expect(t.d.startsWith('M0 ')).toBe(true);
    }
  });

  it('keeps stroke widths and opacity within a sane, always-visible range', () => {
    const threads = generateFringeThreads(30, 34);
    for (const t of threads) {
      expect(t.strokeWidth).toBeGreaterThanOrEqual(0.9);
      expect(t.strokeWidth).toBeLessThanOrEqual(1.6);
      expect(t.opacity).toBeGreaterThan(0);
      expect(t.opacity).toBeLessThanOrEqual(1);
    }
  });
});
