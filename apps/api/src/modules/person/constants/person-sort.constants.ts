/**
 * Allowed `sortBy` query values for GET /persons (maps to `person.<column>` in SQL).
 */
export const PERSON_SORT_BY_FIELDS = [
  'alias',
  'name',
  'firstSurname',
  'phone',
  'shoulderHeight',
  'birthDate',
  'availability',
  'onboardingStatus',
  'isActive',
  'isMember',
  'isXicalla',
  'shirtDate',
  'createdAt',
  'updatedAt',
  'attendedCount',
] as const;

export type PersonSortByField = (typeof PERSON_SORT_BY_FIELDS)[number];

/** Maps API sort field names to TypeORM query builder column paths (alias.table). */
export const PERSON_SORT_COLUMN_MAP: Record<PersonSortByField, string> = {
  alias: 'person.alias',
  name: 'person.name',
  firstSurname: 'person.firstSurname',
  phone: 'person.phone',
  shoulderHeight: 'person.shoulderHeight',
  birthDate: 'person.birthDate',
  availability: 'person.availability',
  onboardingStatus: 'person.onboardingStatus',
  isActive: 'person.isActive',
  isMember: 'person.isMember',
  isXicalla: 'person.isXicalla',
  shirtDate: 'person.shirtDate',
  createdAt: 'person.createdAt',
  updatedAt: 'person.updatedAt',
  // Alias del `addSelect` que `PersonService.findAll` només afegeix quan s'ordena per ací.
  attendedCount: 'attended_count',
};

export const PERSON_SORT_ORDER_VALUES = ['ASC', 'DESC'] as const;
export type PersonSortOrder = (typeof PERSON_SORT_ORDER_VALUES)[number];
