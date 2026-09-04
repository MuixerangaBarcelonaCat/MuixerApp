import { FigureZone } from '../enums/figure-zone.enum';
import { ImportScope } from '../enums/import-scope.enum';
import { zonesForScope } from './import-scope.util';

describe('zonesForScope', () => {
  it('maps PINYA to only the PINYA zone', () => {
    expect(zonesForScope(ImportScope.PINYA)).toEqual(new Set([FigureZone.PINYA]));
  });

  it('maps TRONC to TRONC and BASE zones', () => {
    expect(zonesForScope(ImportScope.TRONC)).toEqual(
      new Set([FigureZone.TRONC, FigureZone.BASE]),
    );
  });

  it('maps ALL to null (no filter)', () => {
    expect(zonesForScope(ImportScope.ALL)).toBeNull();
  });
});
