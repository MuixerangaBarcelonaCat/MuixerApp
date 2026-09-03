import { describe, it, expect } from 'vitest';
import { hashSeed, layoutTroncGroup, layoutTroncSilhouette, computeGroundY } from './tronc-silhouette-layout.util';

describe('hashSeed', () => {
  it('returns the same number for the same string', () => {
    expect(hashSeed('Alta clàssica|4,4,2,1,1')).toBe(hashSeed('Alta clàssica|4,4,2,1,1'));
  });

  it('returns different numbers for different strings', () => {
    expect(hashSeed('Pinet de 5')).not.toBe(hashSeed('Campana'));
  });
});

describe('layoutTroncSilhouette', () => {
  it('returns no people for an empty profile', () => {
    const layout = layoutTroncSilhouette([], hashSeed('empty'));
    expect(layout.people).toEqual([]);
  });

  it('places exactly profile[i] people on floor i, bases at floor 0', () => {
    const layout = layoutTroncSilhouette([4, 2, 1], hashSeed('Campana'));
    expect(layout.people).toHaveLength(7);
    expect(layout.people.filter((p) => p.floor === 0)).toHaveLength(4);
    expect(layout.people.filter((p) => p.floor === 1)).toHaveLength(2);
    expect(layout.people.filter((p) => p.floor === 2)).toHaveLength(1);
  });

  it('is deterministic: same profile and seed produce identical positions', () => {
    const seed = hashSeed('Alta clàssica|4,4,2,1,1');
    const a = layoutTroncSilhouette([4, 4, 2, 1, 1], seed);
    const b = layoutTroncSilhouette([4, 4, 2, 1, 1], seed);
    expect(a).toEqual(b);
  });

  it('gives a different layout for a different seed', () => {
    const a = layoutTroncSilhouette([4, 2], hashSeed('Campana'));
    const b = layoutTroncSilhouette([4, 2], hashSeed('Torreta'));
    expect(a.people).not.toEqual(b.people);
  });

  it('does not give every base-floor person the same weight as a higher floor (no floor is specially emphasized)', () => {
    // Regression guard for the "forget bolder bases" direction: radius only varies by the
    // per-person seeded jitter, never by floor index.
    const layout = layoutTroncSilhouette([4, 4], hashSeed('Alta'));
    const baseRadii = layout.people.filter((p) => p.floor === 0).map((p) => p.r);
    const topRadii = layout.people.filter((p) => p.floor === 1).map((p) => p.r);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(Math.abs(avg(baseRadii) - avg(topRadii))).toBeLessThan(avg(baseRadii) * 0.3);
  });

  it('reports a bounding width/height that contains every person plus their radius', () => {
    const layout = layoutTroncSilhouette([6, 4, 2], hashSeed('Quadro'));
    for (const p of layout.people) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(-0.01);
      expect(p.x + p.r).toBeLessThanOrEqual(layout.width + 0.01);
    }
  });
});

describe('layoutTroncGroup', () => {
  it('returns no people for no profiles', () => {
    const group = layoutTroncGroup([], hashSeed('empty'));
    expect(group.people).toEqual([]);
    expect(group.width).toBe(0);
    expect(group.height).toBe(0);
  });

  it('a single profile is exactly the plain silhouette layout — the template-preview case', () => {
    const profile = [4, 2];
    const seed = hashSeed('Campana|4,2');
    expect(layoutTroncGroup([profile], seed)).toEqual(layoutTroncSilhouette(profile, seed));
  });

  it('draws every person from every profile when there are 3 or fewer', () => {
    const profiles = [[4, 2], [2, 2], [1]];
    const group = layoutTroncGroup(profiles, hashSeed('Rúa'));
    expect(group.people).toHaveLength(4 + 2 + 2 + 2 + 1);
  });

  it('draws only the 3 tallest profiles when there are more, dropping the shortest', () => {
    const tall = [1, 1, 1, 1, 1]; // 5 floors
    const midA = [1, 1, 1, 1]; // 4 floors
    const midB = [1, 1, 1]; // 3 floors
    const short1 = [1, 1];
    const short2 = [1];
    const group = layoutTroncGroup([tall, midA, midB, short1, short2], hashSeed('Composició'));
    // 5 + 4 + 3 people from the three tallest; the two shortest (2 + 1 people) are excluded
    expect(group.people).toHaveLength(5 + 4 + 3);
  });

  it('centers the tallest figure among the ones it draws', () => {
    // Two equally-tall (4-floor) figures flanking one 5-floor figure: the widest x-cluster
    // (tallest = most floors stacked = tallest silhouette) should sit in the middle third.
    const tall = [1, 1, 1, 1, 1];
    const midA = [1, 1, 1, 1];
    const midB = [1, 1, 1, 1];
    const group = layoutTroncGroup([midA, tall, midB], hashSeed('Centrat'));
    const xs = group.people.map((p) => p.x).sort((a, b) => a - b);
    const tallXs = group.people.filter((p) => p.y === Math.min(...group.people.map((q) => q.y))).map((p) => p.x);
    // The topmost person overall belongs to the tallest figure — it should sit near
    // the horizontal middle of the whole drawing, not at either edge.
    const mid = (xs[0] + xs[xs.length - 1]) / 2;
    expect(Math.abs(tallXs[0] - mid)).toBeLessThan(group.width * 0.3);
  });

  it('baseline-aligns figures of different heights to the same bottom edge', () => {
    const group = layoutTroncGroup([[1, 1, 1, 1, 1], [1, 1]], hashSeed('Alineat'));
    const maxY = Math.max(...group.people.map((p) => p.y));
    expect(maxY).toBeLessThanOrEqual(group.height);
    expect(maxY).toBeGreaterThan(group.height - 20); // within one row height of the bottom
  });

  it('is deterministic for the same profiles and seed', () => {
    const profiles = [[4, 2], [2, 2]];
    const seed = hashSeed('Torreta');
    expect(layoutTroncGroup(profiles, seed)).toEqual(layoutTroncGroup(profiles, seed));
  });
});

describe('computeGroundY', () => {
  it('sits just below the feet of the base-floor (floor 0) people', () => {
    const layout = layoutTroncSilhouette([4, 2], hashSeed('Campana'));
    const baseFeet = layout.people.filter((p) => p.floor === 0).map((p) => p.y + p.r);
    const groundY = computeGroundY(layout);
    expect(groundY).toBeGreaterThanOrEqual(Math.max(...baseFeet));
  });

  it('falls back to the layout height for an empty profile', () => {
    const layout = layoutTroncSilhouette([], hashSeed('empty'));
    expect(computeGroundY(layout)).toBe(layout.height);
  });
});
