import { BeforeEventOffsetUnit, BeforeEventScheduleConfig } from '@muixer/shared';
import { addDaysToDateOnly, formatDateOnly, zonedTimeToUtc } from '../../common/utils/date.util';

/** Just enough of an Event to place its reminder in time. */
export interface FireInstantEvent {
  date: Date | string;
  startTime: string | null;
}

/**
 * The UTC instant a BEFORE_EVENT schedule should fire for `event`, or `null` when it can't be
 * computed (an `HOURS` offset needs the event's own `startTime`, which may be unset).
 *
 * Shared by the cron sweep (which asks "has this instant passed?") and the next-run projection
 * (which asks "when is the next one?"), so the two can never drift apart.
 */
export function computeBeforeEventFireInstant(rule: BeforeEventScheduleConfig, event: FireInstantEvent): Date | null {
  if (rule.offsetUnit === BeforeEventOffsetUnit.HOURS) {
    if (!event.startTime) return null;
    const eventStartUtc = zonedTimeToUtc(formatDateOnly(event.date), event.startTime);
    return new Date(eventStartUtc.getTime() - rule.offsetValue * 60 * 60 * 1000);
  }
  const fireDate = addDaysToDateOnly(formatDateOnly(event.date), -rule.offsetValue);
  return zonedTimeToUtc(fireDate, rule.timeOfDay as string);
}

/** Whether `dateStr` (`YYYY-MM-DD`) falls inside a rule's inclusive, optional active window. */
export function withinActiveWindow(dateStr: string, rule: { startDate?: string; endDate?: string }): boolean {
  if (rule.startDate && dateStr < rule.startDate) return false;
  if (rule.endDate && dateStr > rule.endDate) return false;
  return true;
}
