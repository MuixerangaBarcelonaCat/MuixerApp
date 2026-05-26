import { describe, it, expect } from 'vitest';
import {
  validateBaseOrdering,
  BaseNodeForValidation,
} from './base-ordering.util';

// Helpers for building test bases around a centroid at (500, 500)
const TL = (sortOrder: number): BaseNodeForValidation => ({ sortOrder, x: 400, y: 400 }); // top-left
const BL = (sortOrder: number): BaseNodeForValidation => ({ sortOrder, x: 400, y: 600 }); // bottom-left
const BR = (sortOrder: number): BaseNodeForValidation => ({ sortOrder, x: 600, y: 600 }); // bottom-right
const TR = (sortOrder: number): BaseNodeForValidation => ({ sortOrder, x: 600, y: 400 }); // top-right

describe('validateBaseOrdering', () => {

  // ── Edge cases: 0 or 1 base ──────────────────────────────────────────────

  it('returns valid for 0 bases', () => {
    expect(validateBaseOrdering([])).toEqual({ isValid: true, issues: [] });
  });

  it('returns valid for 1 base', () => {
    expect(validateBaseOrdering([{ sortOrder: 0, x: 500, y: 500 }])).toEqual({
      isValid: true,
      issues: [],
    });
  });

  // ── 2 bases ──────────────────────────────────────────────────────────────

  it('returns valid for 2 bases in CCW order (left first)', () => {
    const result = validateBaseOrdering([
      { sortOrder: 0, x: 300, y: 500 }, // left
      { sortOrder: 1, x: 700, y: 500 }, // right — 180° CCW from left
    ]);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns valid for 2 bases TL (sortOrder 0) and BR (sortOrder 1) in CCW order', () => {
    const result = validateBaseOrdering([TL(0), BR(1)]);
    expect(result.isValid).toBe(true);
  });

  // ── 4 bases — correct CCW order ──────────────────────────────────────────

  it('returns valid for 4 bases in correct CCW order: TL → BL → BR → TR', () => {
    const result = validateBaseOrdering([TL(0), BL(1), BR(2), TR(3)]);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('accepts sortOrders that are non-sequential (e.g. 0, 5, 10, 15) in CCW order', () => {
    const result = validateBaseOrdering([TL(0), BL(5), BR(10), TR(15)]);
    expect(result.isValid).toBe(true);
  });

  // ── 4 bases — incorrect CW order ─────────────────────────────────────────

  it('returns invalid for 4 bases in CW order: TL → TR → BR → BL', () => {
    const result = validateBaseOrdering([TL(0), TR(1), BR(2), BL(3)]);
    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('reports a specific issue message for the out-of-order pair', () => {
    // TL(0), TR(1), BR(2), BL(3) — CW order. First CCW break is at BR (sortOrder 2): Base 3 vs Base 2
    const result = validateBaseOrdering([TL(0), TR(1), BR(2), BL(3)]);
    expect(result.issues[0]).toContain('Base 3');
    expect(result.issues[0]).toContain('Base 2');
  });

  // ── Partial misordering ───────────────────────────────────────────────────

  it('returns invalid when only one pair is misordered', () => {
    // Correct order is TL(0) → BL(1) → BR(2) → TR(3)
    // Swapping last two: TL(0) → BL(1) → TR(2) → BR(3) breaks the sequence
    const result = validateBaseOrdering([TL(0), BL(1), TR(2), BR(3)]);
    expect(result.isValid).toBe(false);
  });

  // ── 3 bases ───────────────────────────────────────────────────────────────

  it('returns valid for 3 bases in CCW order: TL → BL → BR', () => {
    const result = validateBaseOrdering([TL(0), BL(1), BR(2)]);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid for 3 bases in CW order: TL → BR → BL', () => {
    const result = validateBaseOrdering([TL(0), BR(1), BL(2)]);
    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  // ── Unsorted input ────────────────────────────────────────────────────────

  it('sorts by sortOrder before validating (input order does not matter)', () => {
    // Provide bases in reverse physical order but with sortOrders that define CCW
    const result = validateBaseOrdering([TR(3), BR(2), BL(1), TL(0)]);
    expect(result.isValid).toBe(true);
  });

  // ── Issue messages are in Catalan ─────────────────────────────────────────

  it('issue messages are in Catalan and reference base numbers', () => {
    const result = validateBaseOrdering([TL(0), TR(1), BR(2), BL(3)]);
    for (const issue of result.issues) {
      expect(issue).toMatch(/Base \d+/);
      expect(issue).toMatch(/anti-horari/i);
    }
  });
});
