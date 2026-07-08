const madridFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
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
