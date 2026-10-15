import { findSeasonForDate } from './season.util';
import { Season } from '../models/event.model';

const season = (id: string, startDate: string, endDate: string): Season => ({
  id,
  name: id,
  startDate,
  endDate,
  description: null,
  eventCount: 0,
  rehearsalCount: 0,
  performanceCount: 0,
});

describe('findSeasonForDate', () => {
  const seasons = [season('a', '2025-09-06', '2026-09-05'), season('b', '2026-09-06', '2027-09-05')];

  it('finds the season whose range contains the date, inclusive at both ends', () => {
    expect(findSeasonForDate('2025-09-06', seasons)?.id).toBe('a');
    expect(findSeasonForDate('2026-09-05', seasons)?.id).toBe('a');
    expect(findSeasonForDate('2026-09-06', seasons)?.id).toBe('b');
  });

  it('returns null for a date in no season', () => {
    expect(findSeasonForDate('2025-09-05', seasons)).toBeNull();
    expect(findSeasonForDate('2027-09-06', seasons)).toBeNull();
  });

  it('ignores a time part on either side', () => {
    expect(findSeasonForDate('2026-09-05T00:00:00.000Z', [season('a', '2025-09-06T00:00:00.000Z', '2026-09-05')])?.id).toBe(
      'a',
    );
  });

  it('returns null for an empty date', () => {
    expect(findSeasonForDate('', seasons)).toBeNull();
  });
});
