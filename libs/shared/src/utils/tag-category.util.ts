import {
  DIRECTION_POSITION_TYPES,
  PINYA_POSITION_TYPES,
  TRONC_NODE_PRESETS,
} from '../constants/node-preset.constants';
import { TagCategory } from '../enums/tag-category.enum';

export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  [TagCategory.TRONC]: 'Tronc',
  [TagCategory.PINYA]: 'Pinya',
  [TagCategory.XICALLA]: 'Xicalla',
  [TagCategory.ALTRES]: 'Altres',
};

const TRONC_POSITION_TYPES: string[] = [
  ...TRONC_NODE_PRESETS.map((p) => p.positionType),
  ...DIRECTION_POSITION_TYPES,
  'base',
];

/**
 * Infereix la categoria d'una etiqueta a partir dels seus positionTypes.
 * ALTRES quan la llista és buida, hi ha barreja de tronc+pinya, o hi ha un
 * positionType desconegut.
 */
export function inferTagCategory(positionTypes: string[]): TagCategory {
  if (positionTypes.length === 0) {
    return TagCategory.ALTRES;
  }

  const isTronc = (t: string): boolean => TRONC_POSITION_TYPES.includes(t);
  const isPinya = (t: string): boolean => PINYA_POSITION_TYPES.includes(t);

  const allTronc = positionTypes.every(isTronc);
  const allPinya = positionTypes.every(isPinya);

  if (allTronc) {
    return TagCategory.TRONC;
  }
  if (allPinya) {
    return TagCategory.PINYA;
  }
  return TagCategory.ALTRES;
}
