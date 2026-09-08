import { FigureZone } from '../enums/figure-zone.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';
import { SegmentConflictKind } from '../enums/segment-conflict.enum';
import { areaForZone, classifyPlacementKind, conflictRelevantPlacements } from './assignment-area.constants';

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
