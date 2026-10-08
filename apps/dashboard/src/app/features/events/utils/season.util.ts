import { Season } from '../models/event.model';

/**
 * The season whose inclusive range contains `date`, or null. Mirrors how the API derives an event's
 * season from its date (seasons never overlap, so there is at most one). Compares calendar dates only.
 */
export function findSeasonForDate(date: string, seasons: readonly Season[]): Season | null {
  const day = date.slice(0, 10);
  if (!day) return null;
  return seasons.find((s) => s.startDate.slice(0, 10) <= day && day <= s.endDate.slice(0, 10)) ?? null;
}
