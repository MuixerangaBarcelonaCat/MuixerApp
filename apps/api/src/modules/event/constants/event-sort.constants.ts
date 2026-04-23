export const EVENT_SORT_BY_FIELDS = [
  'date',
  'title',
  'location',
  'startTime',
  'createdAt',
  'chronological',
] as const;

export type EventSortByField = (typeof EVENT_SORT_BY_FIELDS)[number];

export const EVENT_SORT_COLUMN_MAP: Partial<Record<EventSortByField, string>> = {
  date: 'event.date',
  title: 'event.title',
  location: 'event.location',
  startTime: 'event.startTime',
  createdAt: 'event.createdAt',
  // 'chronological' is handled separately in the service with a CASE expression
};

export const EVENT_SORT_ORDER_VALUES = ['ASC', 'DESC'] as const;
export type EventSortOrder = (typeof EVENT_SORT_ORDER_VALUES)[number];

export const EVENT_TIME_FILTER_VALUES = ['upcoming', 'past', 'all'] as const;
export type EventTimeFilter = (typeof EVENT_TIME_FILTER_VALUES)[number];
