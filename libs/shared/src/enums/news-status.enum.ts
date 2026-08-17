/**
 * Display-only status derived from a News item's `publishedAt`, never persisted:
 * null → DRAFT, future → SCHEDULED, past/now → PUBLISHED.
 */
export enum NewsStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
}
