import { SelectQueryBuilder } from 'typeorm';
import { TagCategory } from '@muixer/shared';
import { Person } from '../person.entity';

/** Categories are enum literals, never user input — safe to inline in the SQL. */
const hasCategory = (personAlias: string, categories: TagCategory[]): string =>
  `EXISTS (
     SELECT 1 FROM person_positions pp
     JOIN positions t ON t.id = pp."positionsId"
     WHERE pp."personsId" = ${personAlias}.id
       AND t.category IN (${categories.map((c) => `'${c}'`).join(', ')})
   )`;

/**
 * «Compleix la regla mínima d'etiquetatge»: té xicalla, o altres, o pinya i tronc alhora.
 * Mateixa regla que `evaluateTagCompliance` a `@muixer/shared`, expressada en SQL perquè el
 * filtre haja de paginar al servidor.
 */
export function applyTagRuleFilter(
  qb: SelectQueryBuilder<Person>,
  personAlias: string,
  ok: boolean,
): void {
  const rule = `(
    ${hasCategory(personAlias, [TagCategory.XICALLA, TagCategory.ALTRES])}
    OR (${hasCategory(personAlias, [TagCategory.PINYA])} AND ${hasCategory(personAlias, [TagCategory.TRONC])})
  )`;

  qb.andWhere(ok ? rule : `NOT ${rule}`);
}
