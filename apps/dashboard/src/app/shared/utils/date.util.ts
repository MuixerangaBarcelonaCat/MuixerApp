/**
 * Date formatting utility functions
 */

/**
 * Formata una data en format català (dia mes any)
 * @param dateStr Data en format ISO string o null
 * @returns Data formatada o '-' si és null
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr);
  return date.toLocaleDateString('ca-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formata una data i hora en format català
 * @param dateStr Data en format ISO string
 * @returns Data i hora formatades
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ca-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Data local d'avui en format `YYYY-MM-DD` (el que espera un `<input type="date">`). */
export function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const valenciaDateTime = new Intl.DateTimeFormat('ca-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** An instant as Valencia wall-clock `dd/mm/yyyy` and `HH:mm`, whatever the browser's timezone. */
export function formatValenciaDateAndTime(iso: string): { date: string; time: string } {
  const parts = valenciaDateTime.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('day')}/${part('month')}/${part('year')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}
