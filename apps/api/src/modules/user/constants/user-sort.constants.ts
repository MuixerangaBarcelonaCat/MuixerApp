export const USER_SORT_BY_FIELDS = [
  'email',
  'alias',
  'role',
  'isActive',
  'createdAt',
] as const;

export type UserSortByField = (typeof USER_SORT_BY_FIELDS)[number];

export const USER_SORT_COLUMN_MAP: Partial<Record<UserSortByField, string>> = {
  email: 'user.email',
  role: 'user.role',
  alias: 'user.person.alias',
  isActive: 'user.isActive',
  createdAt: 'user.createdAt',
};

export const USER_SORT_ORDER_VALUES = ['ASC', 'DESC'] as const;
export type UserSortOrder = (typeof USER_SORT_ORDER_VALUES)[number];
