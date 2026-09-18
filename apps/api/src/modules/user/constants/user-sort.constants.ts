export const USER_SORT_BY_FIELDS = [
  'email',
  'alias',
  'role',
  'isActive',
  'createdAt',
] as const;

export type UserSortByField = (typeof USER_SORT_BY_FIELDS)[number];

/** Text columns are wrapped in `unaccent(lower(...))` so sorting is accent/case-insensitive,
 *  matching every free-text search in the codebase. */
export const USER_SORT_COLUMN_MAP: Record<UserSortByField, string> = {
  email: 'unaccent(lower(user.email))',
  role: 'user.role',
  alias: 'unaccent(lower(person.alias))',
  isActive: 'user.isActive',
  createdAt: 'user.createdAt',
};

export const USER_SORT_ORDER_VALUES = ['ASC', 'DESC'] as const;
export type UserSortOrder = (typeof USER_SORT_ORDER_VALUES)[number];
