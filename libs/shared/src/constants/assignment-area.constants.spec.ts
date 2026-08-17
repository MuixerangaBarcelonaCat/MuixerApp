import { FigureZone } from '../enums/figure-zone.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';
import { SegmentConflictKind } from '../enums/segment-conflict.enum';
import { areaForZone, classifyPlacementKind } from './assignment-area.constants';

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

  it('maps direction zones to the DIRECTION area', () => {
    expect(areaForZone(FigureZone.FIGURE_DIRECTION)).toBe(AssignmentArea.DIRECTION);
    expect(areaForZone(FigureZone.XICALLA_DIRECTION)).toBe(AssignmentArea.DIRECTION);
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
