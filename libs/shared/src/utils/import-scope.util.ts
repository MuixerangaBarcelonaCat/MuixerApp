import { FigureZone } from '../enums/figure-zone.enum';
import { ImportScope } from '../enums/import-scope.enum';

/** Zones that belong to each import scope; `null` for ALL means "no filter — every zone". */
export function zonesForScope(scope: ImportScope): Set<FigureZone> | null {
  switch (scope) {
    case ImportScope.PINYA:
      return new Set([FigureZone.PINYA]);
    case ImportScope.TRONC:
      return new Set([FigureZone.TRONC, FigureZone.BASE]);
    case ImportScope.ALL:
      return null;
  }
}
