import { FigureZone } from '../enums/figure-zone.enum';
import {
  analyzeTroncHeights,
  heightGapLevel,
  TRONC_HEIGHT_THRESHOLDS,
} from './tronc-height.util';
import { TroncSupportNode } from './tronc-support.util';

const base = (id: string): TroncSupportNode => ({ id, zone: FigureZone.BASE, z: 0, standsOnNodeIds: [] });
const tronc = (id: string, z: number, standsOnNodeIds: string[] = []): TroncSupportNode => ({
  id,
  zone: FigureZone.TRONC,
  z,
  standsOnNodeIds,
});
/** Assigned nodes and their person's shoulder height; a node missing from the map is unassigned. */
const heights = (entries: Record<string, number | null>) => new Map(Object.entries(entries));

describe('heightGapLevel', () => {
  const t = { warning: 5, error: 10 };

  it('is ok below the warning threshold', () => {
    expect(heightGapLevel(0, t)).toBe('ok');
    expect(heightGapLevel(4, t)).toBe('ok');
  });

  it('is warning from the warning threshold up to just below the error one', () => {
    expect(heightGapLevel(5, t)).toBe('warning');
    expect(heightGapLevel(9, t)).toBe('warning');
  });

  it('is error from the error threshold up', () => {
    expect(heightGapLevel(10, t)).toBe('error');
    expect(heightGapLevel(23, t)).toBe('error');
  });

  it('compares the rounded gap, the number that is displayed', () => {
    expect(heightGapLevel(4.4, t)).toBe('ok');
    expect(heightGapLevel(4.5, t)).toBe('warning');
    expect(heightGapLevel(9.5, t)).toBe('error');
  });
});

describe('TRONC_HEIGHT_THRESHOLDS', () => {
  it('flags a floor at 5/10 cm and uneven supporters at 3/5 cm', () => {
    expect(TRONC_HEIGHT_THRESHOLDS).toEqual({
      floor: { warning: 5, error: 10 },
      support: { warning: 3, error: 5 },
    });
  });
});

describe('analyzeTroncHeights — cumulative height', () => {
  it('gives a base its own shoulder height', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights([base('b1')], heights({ b1: 142 }));
    expect(cumulativeByNodeId.get('b1')).toEqual({ known: true, cm: 142 });
  });

  it('adds the base below to a P2 standing on one base', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), tronc('s1', 1, ['b1'])],
      heights({ b1: 142, s1: 130 }),
    );
    expect(cumulativeByNodeId.get('s1')).toEqual({ known: true, cm: 272 });
  });

  it('adds the mean of the bases below to a P2 standing on two', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])],
      heights({ b1: 142, b2: 145, s1: 130 }),
    );
    expect(cumulativeByNodeId.get('s1')).toEqual({ known: true, cm: 273.5 });
  });

  it('chains through every floor, whatever order the nodes come in', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [tronc('t1', 3, ['s2']), tronc('s2', 2, ['s1']), tronc('s1', 1, ['b1', 'b2']), base('b2'), base('b1')],
      heights({ b1: 140, b2: 144, s1: 130, s2: 120, t1: 100 }),
    );
    expect(cumulativeByNodeId.get('s1')).toEqual({ known: true, cm: 272 });
    expect(cumulativeByNodeId.get('s2')).toEqual({ known: true, cm: 392 });
    expect(cumulativeByNodeId.get('t1')).toEqual({ known: true, cm: 492 });
  });

  it('marks an assigned person with no registered height as missing-height, and so is everyone above', () => {
    const nodes = [base('b1'), tronc('s1', 1, ['b1']), tronc('s2', 2, ['s1'])];
    for (const missing of [null, 0]) {
      const { cumulativeByNodeId } = analyzeTroncHeights(nodes, heights({ b1: missing, s1: 130, s2: 120 }));
      expect(cumulativeByNodeId.get('b1')).toEqual({ known: false, reason: 'missing-height' });
      expect(cumulativeByNodeId.get('s1')).toEqual({ known: false, reason: 'missing-height' });
      expect(cumulativeByNodeId.get('s2')).toEqual({ known: false, reason: 'missing-height' });
    }
  });

  it('marks an empty node as unassigned, and so is everyone above', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])],
      heights({ b1: 140, s1: 130 }),
    );
    expect(cumulativeByNodeId.get('b2')).toEqual({ known: false, reason: 'unassigned' });
    expect(cumulativeByNodeId.get('s1')).toEqual({ known: false, reason: 'unassigned' });
  });

  it('marks a TRONC node with no links as unlinked, and so is everyone above', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), tronc('s1', 1), tronc('s2', 2, ['s1'])],
      heights({ b1: 140, s1: 130, s2: 120 }),
    );
    expect(cumulativeByNodeId.get('s1')).toEqual({ known: false, reason: 'unlinked' });
    expect(cumulativeByNodeId.get('s2')).toEqual({ known: false, reason: 'unlinked' });
  });

  it('keeps the most actionable reason: missing-height, then unlinked, then unassigned', () => {
    const nodes = [base('b1'), base('b2'), tronc('s1', 1, ['b1']), tronc('s2', 1), tronc('t1', 2, ['s1', 's2'])];

    const missing = analyzeTroncHeights(nodes, heights({ b1: null, s1: 130, s2: 130, t1: 100 }));
    expect(missing.cumulativeByNodeId.get('t1')).toEqual({ known: false, reason: 'missing-height' });

    const unlinked = analyzeTroncHeights(nodes, heights({ s1: 130, s2: 130, t1: 100 }));
    expect(unlinked.cumulativeByNodeId.get('t1')).toEqual({ known: false, reason: 'unlinked' });
  });

  it('reports a missing height of the node itself over an unknown node below', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), tronc('s1', 1, ['b1'])],
      heights({ s1: null }),
    );
    expect(cumulativeByNodeId.get('s1')).toEqual({ known: false, reason: 'missing-height' });
  });

  it('ignores links that fail the stands-on rule', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), tronc('s1', 1, ['b1']), tronc('t1', 2, ['b1', 'gone', 's1'])],
      heights({ b1: 140, s1: 130, t1: 100 }),
    );
    expect(cumulativeByNodeId.get('t1')).toEqual({ known: true, cm: 370 });
  });

  it('ignores nodes outside the BASE and TRONC zones', () => {
    const { cumulativeByNodeId } = analyzeTroncHeights(
      [base('b1'), { id: 'p1', zone: FigureZone.PINYA, z: 0 }, { id: 'd1', zone: FigureZone.DIRECTION, z: 0 }],
      heights({ b1: 140, p1: 150, d1: 150 }),
    );
    expect([...cumulativeByNodeId.keys()]).toEqual(['b1']);
  });

  it('does not mutate its input', () => {
    const nodes = [base('b1'), tronc('s1', 1, ['b1', 'gone'])];
    const snapshot = structuredClone(nodes);
    analyzeTroncHeights(nodes, heights({ b1: 140, s1: 130 }));
    expect(nodes).toEqual(snapshot);
  });
});

describe('analyzeTroncHeights — floor spread', () => {
  it('is the max − min cumulative height of the floor, naming the lowest and highest node', () => {
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), base('b3')],
      heights({ b1: 142, b2: 139, b3: 145 }),
    );
    expect(floors.get(0)).toEqual({ status: 'ok', gapCm: 6, level: 'warning', lowestNodeId: 'b2', highestNodeId: 'b3' });
  });

  it('compares cumulative heights, not own heights', () => {
    // Same own heights on P2, but the bases under s2 are 6 cm taller.
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1']), tronc('s2', 1, ['b2'])],
      heights({ b1: 140, b2: 146, s1: 130, s2: 130 }),
    );
    expect(floors.get(1)).toMatchObject({ status: 'ok', gapCm: 6, lowestNodeId: 's1', highestNodeId: 's2' });
  });

  it('flags a floor at the floor thresholds, on the rounded gap', () => {
    const levelFor = (b2: number) =>
      analyzeTroncHeights([base('b1'), base('b2')], heights({ b1: 140, b2 })).floors.get(0);
    expect(levelFor(144)).toMatchObject({ level: 'ok' });
    expect(levelFor(145)).toMatchObject({ level: 'warning' });
    expect(levelFor(149)).toMatchObject({ level: 'warning' });
    expect(levelFor(150)).toMatchObject({ level: 'error' });
  });

  it('keeps the exact gap when cumulative heights are fractional', () => {
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), base('b3'), tronc('s1', 1, ['b1', 'b2']), tronc('s2', 1, ['b3'])],
      heights({ b1: 140, b2: 141, b3: 145, s1: 130, s2: 130 }),
    );
    // s1 = 140.5 + 130, s2 = 145 + 130 → 4.5, displayed as 5 and flagged
    expect(floors.get(1)).toMatchObject({ gapCm: 4.5, level: 'warning' });
  });

  it('skips unassigned nodes, so a floor can be checked while it is being filled', () => {
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), base('b3')],
      heights({ b1: 140, b3: 143 }),
    );
    expect(floors.get(0)).toMatchObject({ status: 'ok', gapCm: 3, level: 'ok' });
  });

  it('cannot be computed when an assigned person on the floor has no registered height', () => {
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), base('b3')],
      heights({ b1: 140, b2: 150, b3: null }),
    );
    expect(floors.get(0)).toEqual({ status: 'missing-height' });
  });

  it('cannot be computed on the floors above a person with no registered height', () => {
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1']), tronc('s2', 1, ['b2'])],
      heights({ b1: null, b2: 140, s1: 130, s2: 130 }),
    );
    expect(floors.get(1)).toEqual({ status: 'missing-height' });
  });

  it('skips an empty node even when a person below it has no registered height', () => {
    const { floors } = analyzeTroncHeights(
      [base('b1'), base('b2'), base('b3'), tronc('s1', 1, ['b1']), tronc('s2', 1, ['b2']), tronc('s3', 1, ['b3'])],
      heights({ b1: null, b2: 140, b3: 141, s2: 130, s3: 130 }),
    );
    expect(floors.get(1)).toMatchObject({ status: 'ok', gapCm: 1 });
  });

  it('is insufficient with fewer than 2 known heights, saying why', () => {
    const unassigned = analyzeTroncHeights([base('b1'), base('b2')], heights({ b1: 140 }));
    expect(unassigned.floors.get(0)).toEqual({ status: 'insufficient', reason: 'unassigned' });

    const unlinked = analyzeTroncHeights(
      [base('b1'), tronc('s1', 1), tronc('s2', 1)],
      heights({ b1: 140, s1: 130, s2: 130 }),
    );
    expect(unlinked.floors.get(1)).toEqual({ status: 'insufficient', reason: 'unlinked' });
  });

  it('has one entry per floor that has nodes', () => {
    const { floors } = analyzeTroncHeights([base('b1'), tronc('s1', 1, ['b1'])], heights({}));
    expect([...floors.keys()]).toEqual([0, 1]);
  });

  it('uses custom thresholds', () => {
    const { floors } = analyzeTroncHeights([base('b1'), base('b2')], heights({ b1: 140, b2: 142 }), {
      ...TRONC_HEIGHT_THRESHOLDS,
      floor: { warning: 1, error: 2 },
    });
    expect(floors.get(0)).toMatchObject({ level: 'error' });
  });
});

describe('analyzeTroncHeights — uneven supporters', () => {
  it('is the max − min cumulative height of the nodes a TRONC node stands on', () => {
    const { supports } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])],
      heights({ b1: 140, b2: 144, s1: 130 }),
    );
    expect(supports.get('s1')).toEqual({ gapCm: 4, level: 'warning', supporterIds: ['b1', 'b2'] });
  });

  it('compares the supporters\' cumulative heights', () => {
    const { supports } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1']), tronc('s2', 1, ['b2']), tronc('t1', 2, ['s1', 's2'])],
      heights({ b1: 140, b2: 146, s1: 130, s2: 130, t1: 100 }),
    );
    expect(supports.get('t1')).toMatchObject({ gapCm: 6, level: 'error' });
  });

  it('flags at the support thresholds, on the rounded gap', () => {
    const levelFor = (b2: number) =>
      analyzeTroncHeights(
        [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])],
        heights({ b1: 140, b2, s1: 130 }),
      ).supports.get('s1');
    expect(levelFor(142)).toMatchObject({ level: 'ok' });
    expect(levelFor(143)).toMatchObject({ level: 'warning' });
    expect(levelFor(144)).toMatchObject({ level: 'warning' });
    expect(levelFor(145)).toMatchObject({ level: 'error' });
  });

  it('is computed before anyone is assigned to the upper node', () => {
    const { supports } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])],
      heights({ b1: 140, b2: 145 }),
    );
    expect(supports.get('s1')).toMatchObject({ gapCm: 5, level: 'error' });
  });

  it('is left out for a node standing on a single node', () => {
    const { supports } = analyzeTroncHeights([base('b1'), tronc('s1', 1, ['b1'])], heights({ b1: 140, s1: 130 }));
    expect(supports.has('s1')).toBe(false);
  });

  it('is left out while any supporter is unknown', () => {
    const nodes = [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])];
    expect(analyzeTroncHeights(nodes, heights({ b1: 140 })).supports.has('s1')).toBe(false);
    expect(analyzeTroncHeights(nodes, heights({ b1: 140, b2: null })).supports.has('s1')).toBe(false);
  });

  it('uses custom thresholds', () => {
    const { supports } = analyzeTroncHeights(
      [base('b1'), base('b2'), tronc('s1', 1, ['b1', 'b2'])],
      heights({ b1: 140, b2: 141 }),
      { ...TRONC_HEIGHT_THRESHOLDS, support: { warning: 1, error: 8 } },
    );
    expect(supports.get('s1')).toMatchObject({ level: 'warning' });
  });
});
