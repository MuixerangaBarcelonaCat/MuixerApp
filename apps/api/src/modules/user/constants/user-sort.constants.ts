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

/** Sort whitelist of the «Dispositius i sessions» list (`GET /users/devices-summary`). */
export const USER_DEVICES_SORT_BY_FIELDS = [
  'alias',
  'email',
  'activeSessions',
  'activeDevices',
  'lastAccessAt',
  'lastPushAt',
  'pwaInstalledAt',
] as const;

export type UserDevicesSortByField = (typeof USER_DEVICES_SORT_BY_FIELDS)[number];

/** Raw-select aliases (or columns) of `UserService.findDevicesSummary`. */
export const USER_DEVICES_SORT_COLUMN_MAP: Record<UserDevicesSortByField, string> = {
  alias: 'unaccent(lower(person.alias))',
  email: 'unaccent(lower(user.email))',
  activeSessions: '"activeSessions"',
  activeDevices: '"activeDevices"',
  lastAccessAt: '"lastAccessAt"',
  lastPushAt: '"lastPushAt"',
  pwaInstalledAt: '"pwaInstalledAt"',
};
