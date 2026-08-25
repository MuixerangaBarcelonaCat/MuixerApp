import { SelectQueryBuilder } from 'typeorm';
import { TagCategory } from '@muixer/shared';
import { Person } from '../person.entity';

/**
 * Single source of truth for "person has at least one tag in one of these categories" —
 * the `IN (subquery)` shape used both by the person list filter and by the segment
 * assignment "available persons" search.
 */
export function applyPositionCategoryFilter(
  qb: SelectQueryBuilder<Person>,
  personAlias: string,
  categories: TagCategory[],
): void {
  if (categories.length === 0) return;
  qb.andWhere((sub) => {
    const subQuery = sub
      .subQuery()
      .select('sub_person_cat.id')
      .from(Person, 'sub_person_cat')
      .innerJoin('sub_person_cat.positions', 'sub_position_cat')
      .where('sub_position_cat.category IN (:...positionCategories)')
      .getQuery();
    return `${personAlias}.id IN ` + subQuery;
  });
  qb.setParameter('positionCategories', categories);
}
