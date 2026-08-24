/**
 * Categoria d'una etiqueta (Tag), derivada dels positionTypes que agrupa.
 * - TRONC: posicions de tronc, direccions i base
 * - PINYA: posicions de pinya
 * - ALTRES: sense positionTypes, barreja de categories, o positionType desconegut
 */
export enum TagCategory {
  TRONC = 'TRONC',
  PINYA = 'PINYA',
  ALTRES = 'ALTRES',
}
