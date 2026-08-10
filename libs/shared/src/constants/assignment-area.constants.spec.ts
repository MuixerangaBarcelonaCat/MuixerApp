import { FigureZone } from '../enums/figure-zone.enum';
import { AssignmentArea } from '../enums/assignment-area.enum';
import { areaForZone } from './assignment-area.constants';

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
