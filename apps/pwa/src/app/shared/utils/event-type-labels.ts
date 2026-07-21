import { EventType } from '@muixer/shared';

export type EventTypeLabelForm = 'singular' | 'plural';

const LABELS: Record<EventType, Record<EventTypeLabelForm, string>> = {
  [EventType.ASSAIG]: { singular: 'Assaig', plural: 'Assajos' },
  [EventType.ACTUACIO]: { singular: 'Actuació', plural: 'Actuacions' },
};

export function eventTypeLabel(type: EventType, form: EventTypeLabelForm = 'singular'): string {
  return LABELS[type][form];
}

export const MIXED_EVENTS_LABEL = 'Assajos i actuacions';

export function selectedDayHeading(events: { eventType: EventType }[]): string {
  if (events.length === 0) return MIXED_EVENTS_LABEL;
  const types = new Set(events.map((e) => e.eventType));
  if (types.size === 1) {
    return eventTypeLabel(events[0].eventType, 'plural');
  }
  return MIXED_EVENTS_LABEL;
}
