import { NewsStatus } from '@muixer/shared';

/**
 * Display-only status derived from `publishedAt`, mirroring the backend's rule:
 * null → DRAFT, future → SCHEDULED, past/now → PUBLISHED.
 */
export function getNewsStatus(news: { publishedAt: string | null }): NewsStatus {
  if (!news.publishedAt) return NewsStatus.DRAFT;
  return new Date(news.publishedAt) > new Date() ? NewsStatus.SCHEDULED : NewsStatus.PUBLISHED;
}

export function getNewsStatusLabel(status: NewsStatus): string {
  switch (status) {
    case NewsStatus.DRAFT: return 'Esborrany';
    case NewsStatus.SCHEDULED: return 'Programada';
    case NewsStatus.PUBLISHED: return 'Publicada';
  }
}

/** Formats an ISO date as a local `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`). */
export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a `<input type="datetime-local">` value back into an ISO string; empty = null (draft). */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}
