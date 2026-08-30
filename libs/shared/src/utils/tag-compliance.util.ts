import { TagCategory } from '../enums/tag-category.enum';

export interface TagCompliance {
  ok: boolean;
  /** Grups que li completarien la regla. Buit quan `ok`. */
  missing: TagCategory[];
}

/**
 * Regla mínima d'etiquetatge acordada amb l'equip tècnic: n'hi ha prou amb satisfer UNA de
 * les tres condicions (xicalla · altres · pinya+tronc). Satisfer-ne més d'una és normal i
 * mai és un avís. Mai bloqueja res: només alimenta un badge i un filtre de seguiment.
 */
export function evaluateTagCompliance(categories: TagCategory[]): TagCompliance {
  const has = (category: TagCategory): boolean => categories.includes(category);

  if (has(TagCategory.XICALLA) || has(TagCategory.ALTRES)) {
    return { ok: true, missing: [] };
  }

  const pinya = has(TagCategory.PINYA);
  const tronc = has(TagCategory.TRONC);

  if (pinya && tronc) return { ok: true, missing: [] };
  if (pinya) return { ok: false, missing: [TagCategory.TRONC] };
  if (tronc) return { ok: false, missing: [TagCategory.PINYA] };

  return { ok: false, missing: [TagCategory.PINYA, TagCategory.TRONC] };
}
