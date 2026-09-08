export enum FigureZone {
  BASE = 'BASE',
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  /**
   * A "direction" node (staff directing a part of the construction). The flavour —
   * tronc / xicalla / pinya — lives in `positionType` (`direccio-tronc` etc.), the same
   * way PINYA flavours live in `positionType`. Superseded `FIGURE_DIRECTION` /
   * `XICALLA_DIRECTION`, unified by migration `UnifyAndRenameDirectionZones`.
   */
  DIRECTION = 'DIRECTION',
  DECORATION = 'DECORATION',
}
