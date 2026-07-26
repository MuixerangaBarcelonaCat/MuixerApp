import { Pipe, PipeTransform } from '@angular/core';

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('ca', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Parses a YYYY-MM-DD string as local time (avoids UTC date shift).
 * Returns null for invalid/empty input.
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Capitalizes the first letter of a string. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Formats "2026-07-16" → "Dimecres 16 de juliol" (Catalan, capitalized).
 * Timezone-safe: always parses as local time.
 */
export function formatEventDate(dateStr: string | null | undefined): string {
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  return capitalize(FULL_DATE_FORMATTER.format(d));
}

@Pipe({ name: 'formatEventDate', standalone: true })
export class FormatEventDatePipe implements PipeTransform {
  transform(dateStr: string | null | undefined): string {
    return formatEventDate(dateStr);
  }
}
