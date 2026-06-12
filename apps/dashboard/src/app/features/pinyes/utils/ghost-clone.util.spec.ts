import {
  calculatePinyaCentroid,
  calculateGhostPosition,
  isGhostEligible,
  GhostPositionInput,
} from './ghost-clone.util';
import { FigureZone } from '@muixer/shared';

function makeNode(
  overrides: Partial<GhostPositionInput> = {},
): GhostPositionInput {
  return { x: 100, y: 100, width: 80, height: 40, rotation: 0, ...overrides };
}

describe('ghost-clone.util', () => {
  // ── calculatePinyaCentroid ─────────────────────────────────────────────

  describe('calculatePinyaCentroid', () => {
    it('returns (0,0) for an empty array', () => {
      expect(calculatePinyaCentroid([])).toEqual({ x: 0, y: 0 });
    });

    it('returns the node position for a single node', () => {
      const result = calculatePinyaCentroid([makeNode({ x: 50, y: 70 })]);
      expect(result).toEqual({ x: 50, y: 70 });
    });

    it('computes the arithmetic mean of 3 nodes', () => {
      const nodes = [
        makeNode({ x: 0, y: 0 }),
        makeNode({ x: 90, y: 60 }),
        makeNode({ x: 210, y: 240 }),
      ];
      expect(calculatePinyaCentroid(nodes)).toEqual({ x: 100, y: 100 });
    });

    it('handles negative coordinates', () => {
      const nodes = [
        makeNode({ x: -100, y: -50 }),
        makeNode({ x: 100, y: 50 }),
      ];
      expect(calculatePinyaCentroid(nodes)).toEqual({ x: 0, y: 0 });
    });
  });

  // ── calculateGhostPosition ─────────────────────────────────────────────

  describe('calculateGhostPosition', () => {
    it('places ghost upward (north) for rotation=0', () => {
      const node = makeNode({ x: 200, y: 200, width: 80, rotation: 0 });
      const result = calculateGhostPosition(node);
      expect(result.x).toBe(200);
      expect(result.y).toBe(200 - (40 + 3));
    });

    it('places ghost to the right (east) for rotation=90', () => {
      const node = makeNode({ x: 200, y: 200, width: 80, rotation: 90 });
      const result = calculateGhostPosition(node);
      expect(result.x).toBe(200 + (40 + 3));
      expect(result.y).toBe(200);
    });

    it('places ghost downward (south) for rotation=180', () => {
      const node = makeNode({ x: 200, y: 200, width: 80, rotation: 180 });
      const result = calculateGhostPosition(node);
      expect(result.x).toBe(200);
      expect(result.y).toBe(200 + (40 + 3));
    });

    it('places ghost to the left (west) for rotation=270', () => {
      const node = makeNode({ x: 200, y: 200, width: 80, rotation: 270 });
      const result = calculateGhostPosition(node);
      expect(result.x).toBe(200 - (40 + 3));
      expect(result.y).toBe(200);
    });

    it('places ghost upper-right for rotation=45', () => {
      const node = makeNode({ x: 200, y: 200, width: 80, rotation: 45 });
      const result = calculateGhostPosition(node);
      expect(result.x).toBeGreaterThan(200);
      expect(result.y).toBeLessThan(200);
    });

    it('places ghost upper-left for rotation=315', () => {
      const node = makeNode({ x: 200, y: 200, width: 80, rotation: 315 });
      const result = calculateGhostPosition(node);
      expect(result.x).toBeLessThan(200);
      expect(result.y).toBeLessThan(200);
    });

    it('uses height + default gap (0) for offset distance', () => {
      const node = makeNode({ x: 100, y: 100, width: 60, height: 50, rotation: 0 });
      const result = calculateGhostPosition(node);
      expect(result.y).toBe(100 - 50);
    });

    it('respects custom gap', () => {
      const node = makeNode({ x: 100, y: 100, width: 80, rotation: 0 });
      const gap10 = calculateGhostPosition(node, 10);
      const gap5 = calculateGhostPosition(node, 5);
      expect(gap10.y).toBeLessThan(gap5.y);
    });

    it('is independent of node position', () => {
      const a = makeNode({ x: 0, y: 0, width: 80, rotation: 45 });
      const b = makeNode({ x: 500, y: 500, width: 80, rotation: 45 });
      const ra = calculateGhostPosition(a);
      const rb = calculateGhostPosition(b);
      expect(ra.x - a.x).toBe(rb.x - b.x);
      expect(ra.y - a.y).toBe(rb.y - b.y);
    });
  });

  // ── isGhostEligible ────────────────────────────────────────────────────

  describe('isGhostEligible', () => {
    it('returns true for PINYA mans', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'mans', renglaPosition: null }, 0),
      ).toBe(true);
    });

    it('returns true for PINYA vents', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'vents', renglaPosition: null }, 0),
      ).toBe(true);
    });

    it('returns true for PINYA laterals', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'laterals', renglaPosition: null}, 0),
      ).toBe(true);
    });

    it('returns true for PINYA with null positionType', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: null, renglaPosition: null }, 0),
      ).toBe(true);
    });

    it('returns false for agulla', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'agulla', renglaPosition: null}, null),
      ).toBe(false);
    });

    it('returns false for crossa', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'crossa', renglaPosition: null }, null),
      ).toBe(false);
    });

    it('returns false for contrafort', () => {
      expect(
        isGhostEligible({
          zone: FigureZone.PINYA,
          positionType: 'contrafort',
          renglaPosition: null
        }, null),
      ).toBe(false);
    });

    it('returns true for tap', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'tap', renglaPosition: null }, null),
      ).toBe(true);
    });

    it('returns false for cordo-obert', () => {
      expect(
        isGhostEligible({
          zone: FigureZone.PINYA,
          positionType: 'cordo-obert',
          renglaPosition: null
        }, null),
      ).toBe(false);
    });

    it('returns false for TRONC zone', () => {
      expect(
        isGhostEligible({ zone: FigureZone.TRONC, positionType: 'mans', renglaPosition: null }, null),
      ).toBe(false);
    });

    it('returns false for BASE zone', () => {
      expect(
        isGhostEligible({ zone: FigureZone.BASE, positionType: null, renglaPosition: null }, null),
      ).toBe(false);
    });

    it('returns false for FIGURE_DIRECTION zone', () => {
      expect(
        isGhostEligible({
          zone: FigureZone.FIGURE_DIRECTION,
          positionType: null,
          renglaPosition: null
        }, null),
      ).toBe(false);
    });

    it('returns true only for the last node of the rengla', () => {
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'mans', renglaPosition: 1 }, 3),
      ).toBe(false);
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'mans', renglaPosition: 2 }, 3),
      ).toBe(false);
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'mans', renglaPosition: 3 }, 3),
      ).toBe(true);
      expect(
        isGhostEligible({ zone: FigureZone.PINYA, positionType: 'mans', renglaPosition: 4 }, 3),
      ).toBe(false);
    });
  });
});
