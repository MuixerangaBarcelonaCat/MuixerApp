export const EVENT_SORT_BY_FIELDS = ['date', 'eventType', 'title', 'createdAt'] as const;

export type EventSortByField = (typeof EVENT_SORT_BY_FIELDS)[number];

export const EVENT_SORT_COLUMN_MAP: Record<EventSortByField, string> = {
  date: 'event.date',
  eventType: 'event.eventType',
  title: 'event.title',
  createdAt: 'event.createdAt',
};

export const EVENT_SORT_ORDER_VALUES = ['ASC', 'DESC'] as const;
export type EventSortOrder = (typeof EVENT_SORT_ORDER_VALUES)[number];
