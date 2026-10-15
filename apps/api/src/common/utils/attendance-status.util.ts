import { AttendanceStatus, NOT_REGISTERED_STATUS, ResolvedAttendanceStatus } from '@muixer/shared';
import { formatDateOnly } from './date.util';

/**
 * Resolves the attendance status the API exposes for a person at an event. No row and a PENDENT
 * row are equivalent: both are PENDENT if the person existed on the event day (Europe/Madrid,
 * created that same day included), and NO_REGISTRAT if they were created afterwards.
 */
export function resolveAttendanceStatus(
  rowStatus: AttendanceStatus | null,
  personCreatedAt: Date,
  eventDate: Date | string,
): ResolvedAttendanceStatus {
  if (rowStatus && rowStatus !== AttendanceStatus.PENDENT) return rowStatus;
  return formatDateOnly(personCreatedAt) <= eventDateOnly(eventDate)
    ? AttendanceStatus.PENDENT
    : NOT_REGISTERED_STATUS;
}

/**
 * SQL counterpart of the "existed at the event" check in `resolveAttendanceStatus`, so every query
 * compares the Madrid creation day of the person with the event date the same way.
 */
export function personExistedAtEventSql(personAlias: string, eventDateExpr: string): string {
  return `(${personAlias}."createdAt" AT TIME ZONE 'Europe/Madrid')::date <= ${eventDateExpr}`;
}

/**
 * SQL condition for "this person is pending at this event": existed on the event day and has no
 * answer — no attendance row, or a PENDENT one. `eventAlias` must expose `id` and `date`.
 */
export function personPendingAtEventSql(personAlias: string, eventAlias: string): string {
  return (
    `${personExistedAtEventSql(personAlias, `${eventAlias}.date`)} AND NOT EXISTS (` +
    `SELECT 1 FROM attendances pending_a WHERE pending_a."personId" = ${personAlias}.id ` +
    `AND pending_a."eventId" = ${eventAlias}.id AND pending_a.status <> '${AttendanceStatus.PENDENT}')`
  );
}

/** `Event.date` is a date-only column: a string from raw queries, a UTC-midnight Date once hydrated. */
export function eventDateOnly(date: Date | string): string {
  return typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}
