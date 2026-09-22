const madridFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const madridWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Madrid',
  weekday: 'short',
});

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const madridTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Returns today's date as YYYY-MM-DD in the Europe/Madrid timezone.
 * Avoids the UTC midnight edge-case of `new Date().toISOString().slice(0,10)`.
 */
export function getLocalToday(): string {
  return madridFormatter.format(new Date());
}

/**
 * Formats a Date (or date-like column value) as YYYY-MM-DD,
 * safe for date-only comparisons regardless of the original timezone.
 */
export function formatDateOnly(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return madridFormatter.format(d);
}

/** Day of week (0=Sunday..6=Saturday) of `at` (default now) in the Europe/Madrid timezone. */
export function getLocalDayOfWeek(at: Date = new Date()): number {
  return WEEKDAY_INDEX[madridWeekdayFormatter.format(at)];
}

/** Time of day as `HH:mm` of `at` (default now) in the Europe/Madrid timezone. */
export function getLocalTimeOfDay(at: Date = new Date()): string {
  // en-GB with hour12:false can render midnight as "24:00" on some ICU versions — normalize it.
  const formatted = madridTimeFormatter.format(at);
  return formatted === '24:00' ? '00:00' : formatted;
}
