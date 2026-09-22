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

const madridOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Madrid',
  timeZoneName: 'shortOffset',
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

/**
 * Adds (or, given a negative number, subtracts) whole calendar days to a `YYYY-MM-DD` date-only
 * string. Pure UTC-based arithmetic — no timezone conversion involved, since a date-only value has
 * no wall-clock component to convert.
 */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Europe/Madrid's UTC offset (in minutes, e.g. 60 or 120) at the given instant. */
function getMadridOffsetMinutes(at: Date): number {
  const offsetPart = madridOffsetFormatter.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
  const match = offsetPart?.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 60;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;
  return sign * (hours * 60 + minutes);
}

/**
 * Converts a wall-clock `YYYY-MM-DD` date + `HH:mm` time in the Europe/Madrid timezone to the UTC
 * instant it represents. Needed because values like `Event.startTime` are bare local times with no
 * attached timezone — comparing them to `now` (UTC) requires this conversion first.
 *
 * Implementation: guess the instant by treating the wall time as if it were already UTC, read off
 * Madrid's offset at that guess, then shift by it. A single shift is enough outside the ~1 hour
 * around a DST transition — not worth the added complexity for a notification scheduler.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getMadridOffsetMinutes(utcGuess);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}
