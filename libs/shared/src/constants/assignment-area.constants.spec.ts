import { FigureZone } from '../enums/figure-zone.enum';
import { FigureMode } from '../enums/figure-mode.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';
import { SegmentConflictKind } from '../enums/segment-conflict.enum';
import {
  areaForZone,
  classifyPlacementKind,
  conflictRelevantPlacements,
  isNodeVisibleByModeAndCordons,
} from './assignment-area.constants';

describe('areaForZone', () => {
  it('maps TRONC to the TRONC area', () => {
    expect(areaForZone(FigureZone.TRONC)).toBe(AssignmentArea.TRONC);
  });

  // D10 / §5.3: BASE counts as TRONC for conflicts and dotació. The completeness
  // queries that group PINYA + BASE are deliberately NOT unified — do not "fix" this.
  it('maps BASE to the TRONC area (D10 — BASE counts as tronc for conflicts)', () => {
    expect(areaForZone(FigureZone.BASE)).toBe(AssignmentArea.TRONC);
  });

  it('maps PINYA to the PINYA area', () => {
    expect(areaForZone(FigureZone.PINYA)).toBe(AssignmentArea.PINYA);
  });

  it('maps the DIRECTION zone to the DIRECTION area', () => {
    expect(areaForZone(FigureZone.DIRECTION)).toBe(AssignmentArea.DIRECTION);
  });

  it('maps DECORATION to null (no assignment area)', () => {
    expect(areaForZone(FigureZone.DECORATION)).toBeNull();
  });
});

describe('classifyPlacementKind', () => {
  const { TRONC, PINYA, DIRECTION } = AssignmentArea;

  // §4.1 precedence: >=2 tronc placements make the WHOLE conflict TRONC_TRONC,
  // even when a pinya is also involved — it is the most expensive case and must
  // not hide behind a TRONC_PINYA.
  it('classifies two or more tronc placements as TRONC_TRONC', () => {
    expect(classifyPlacementKind([TRONC, TRONC])).toBe(SegmentConflictKind.TRONC_TRONC);
    expect(classifyPlacementKind([TRONC, TRONC, PINYA])).toBe(SegmentConflictKind.TRONC_TRONC);
  });

  it('classifies exactly one tronc placement plus others as TRONC_PINYA', () => {
    expect(classifyPlacementKind([TRONC, PINYA])).toBe(SegmentConflictKind.TRONC_PINYA);
    expect(classifyPlacementKind([TRONC, DIRECTION])).toBe(SegmentConflictKind.TRONC_PINYA);
  });

  it('classifies no tronc placement as PINYA_PINYA', () => {
    expect(classifyPlacementKind([PINYA, PINYA])).toBe(SegmentConflictKind.PINYA_PINYA);
    expect(classifyPlacementKind([PINYA, DIRECTION])).toBe(SegmentConflictKind.PINYA_PINYA);
  });
});

describe('conflictRelevantPlacements', () => {
  const { TRONC, PINYA, DIRECTION } = AssignmentArea;
  type P = { id: string; positionType: string | null; area: AssignmentArea; instanceId: string };
  const p = (id: string, area: AssignmentArea, instanceId: string, positionType: string | null = null): P => ({
    id,
    area,
    instanceId,
    positionType,
  });
  const run = (placements: P[]) => conflictRelevantPlacements(placements, (x) => x).map((x) => x.id);

  it('is a no-op when there are no direcció pinya placements', () => {
    const list = [p('a', PINYA, 'f1'), p('b', TRONC, 'f2')];
    expect(run(list)).toEqual(['a', 'b']);
  });

  it('excuses a direcció pinya placement when the person is in the pinya of the SAME figure', () => {
    const list = [
      p('dp', DIRECTION, 'f1', 'direccio-pinya'),
      p('pinya', PINYA, 'f1'),
    ];
    expect(run(list)).toEqual(['pinya']);
  });

  it('keeps a direcció pinya placement when the pinya is in a DIFFERENT figure', () => {
    const list = [
      p('dp', DIRECTION, 'f1', 'direccio-pinya'),
      p('pinya', PINYA, 'f2'),
    ];
    expect(run(list)).toEqual(['dp', 'pinya']);
  });

  it('keeps a direcció pinya placement paired with tronc / base / another direcció of the same figure', () => {
    expect(run([p('dp', DIRECTION, 'f1', 'direccio-pinya'), p('tr', TRONC, 'f1')])).toEqual(['dp', 'tr']);
    expect(run([p('dp', DIRECTION, 'f1', 'direccio-pinya'), p('dt', DIRECTION, 'f1', 'direccio-tronc')])).toEqual(['dp', 'dt']);
  });

  it('excuses only the direcció pinya placements whose figure also holds the person in pinya', () => {
    const list = [
      p('dp1', DIRECTION, 'f1', 'direccio-pinya'),
      p('pinya1', PINYA, 'f1'),
      p('dp2', DIRECTION, 'f2', 'direccio-pinya'),
    ];
    expect(run(list)).toEqual(['pinya1', 'dp2']);
  });

  it('does not excuse a direcció tronc placement', () => {
    const list = [p('dt', DIRECTION, 'f1', 'direccio-tronc'), p('pinya', PINYA, 'f1')];
    expect(run(list)).toEqual(['dt', 'pinya']);
  });
});

describe('isNodeVisibleByModeAndCordons', () => {
  const opts = (overrides: Partial<Parameters<typeof isNodeVisibleByModeAndCordons>[1]> = {}) => ({
    figureMode: FigureMode.COMPLETA,
    numberOfCordons: null,
    cordonsObertsEnabled: true,
    ...overrides,
  });

  it('hides a BASE node when figureMode is REMAT', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.BASE }, opts({ figureMode: FigureMode.REMAT }))).toBe(false);
  });

  it('keeps a BASE node visible when figureMode is NETA (only PINYA strips on NETA)', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.BASE }, opts({ figureMode: FigureMode.NETA }))).toBe(true);
  });

  it('keeps a BASE node visible for COMPLETA/PEU regardless of cordons', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.BASE }, opts({ figureMode: FigureMode.COMPLETA, numberOfCordons: 1 }))).toBe(true);
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.BASE }, opts({ figureMode: FigureMode.PEU, numberOfCordons: 1 }))).toBe(true);
  });

  it('always keeps TRONC and DIRECTION nodes visible regardless of mode', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.TRONC }, opts({ figureMode: FigureMode.REMAT }))).toBe(true);
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.DIRECTION }, opts({ figureMode: FigureMode.REMAT }))).toBe(true);
  });

  it('hides a PINYA node entirely in REMAT/NETA', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.PINYA }, opts({ figureMode: FigureMode.REMAT }))).toBe(false);
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.PINYA }, opts({ figureMode: FigureMode.NETA }))).toBe(false);
  });

  it('gates a cordo-obert PINYA node purely on cordonsObertsEnabled, ignoring renglaPosition', () => {
    const node = { zone: FigureZone.PINYA, positionType: 'cordo-obert', renglaPosition: 99 };
    expect(isNodeVisibleByModeAndCordons(node, opts({ numberOfCordons: 1, cordonsObertsEnabled: true }))).toBe(true);
    expect(isNodeVisibleByModeAndCordons(node, opts({ numberOfCordons: 1, cordonsObertsEnabled: false }))).toBe(false);
  });

  it('caps a regular PINYA node by numberOfCordons', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.PINYA, renglaPosition: 2 }, opts({ numberOfCordons: 1 }))).toBe(false);
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.PINYA, renglaPosition: 1 }, opts({ numberOfCordons: 1 }))).toBe(true);
  });

  it('keeps a PINYA node with no renglaPosition visible regardless of numberOfCordons', () => {
    expect(isNodeVisibleByModeAndCordons({ zone: FigureZone.PINYA, renglaPosition: null }, opts({ numberOfCordons: 1 }))).toBe(true);
  });
});
