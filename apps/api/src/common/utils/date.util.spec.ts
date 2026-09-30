import { addDaysToDateOnly, getLocalDayOfWeek, getLocalTimeOfDay, zonedTimeToUtc } from './date.util';

describe('date.util', () => {
  describe('getLocalDayOfWeek', () => {
    it('returns the Europe/Madrid day of week (0=Sunday..6=Saturday) for a given instant', () => {
      // 2026-06-01 is a Monday.
      const noonMadridInJune = new Date('2026-06-01T10:00:00.000Z');
      expect(getLocalDayOfWeek(noonMadridInJune)).toBe(1);
    });

    it('crosses the UTC day boundary correctly (late evening in Madrid, still same UTC day)', () => {
      // 2026-06-01 23:30 Europe/Madrid (CEST, UTC+2) is still Monday locally.
      const lateMonday = new Date('2026-06-01T21:30:00.000Z');
      expect(getLocalDayOfWeek(lateMonday)).toBe(1);
    });

    it('crosses the UTC day boundary the other way (just past midnight in Madrid, previous UTC day)', () => {
      // 2026-06-01 00:30 Europe/Madrid (CEST, UTC+2) is 2026-05-31 22:30 UTC — still Monday locally.
      const justAfterMidnightMonday = new Date('2026-05-31T22:30:00.000Z');
      expect(getLocalDayOfWeek(justAfterMidnightMonday)).toBe(1);
    });
  });

  describe('getLocalTimeOfDay', () => {
    it('returns HH:mm in the Europe/Madrid timezone', () => {
      // 16:00 UTC in June (CEST, UTC+2) is 18:00 in Madrid.
      const instant = new Date('2026-06-01T16:00:00.000Z');
      expect(getLocalTimeOfDay(instant)).toBe('18:00');
    });

    it('pads single-digit hours and minutes', () => {
      // 06:05 UTC in June (CEST, UTC+2) is 08:05 in Madrid.
      const instant = new Date('2026-06-01T06:05:00.000Z');
      expect(getLocalTimeOfDay(instant)).toBe('08:05');
    });
  });

  describe('addDaysToDateOnly', () => {
    it('adds a positive number of calendar days', () => {
      expect(addDaysToDateOnly('2026-06-01', 3)).toBe('2026-06-04');
    });

    it('subtracts days when given a negative number', () => {
      expect(addDaysToDateOnly('2026-06-04', -3)).toBe('2026-06-01');
    });

    it('rolls over a month boundary', () => {
      expect(addDaysToDateOnly('2026-06-01', -1)).toBe('2026-05-31');
    });

    it('rolls over a year boundary', () => {
      expect(addDaysToDateOnly('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('returns the same date when given zero days', () => {
      expect(addDaysToDateOnly('2026-06-01', 0)).toBe('2026-06-01');
    });
  });

  describe('zonedTimeToUtc', () => {
    it('converts a Europe/Madrid wall time to UTC during CEST (summer, UTC+2)', () => {
      expect(zonedTimeToUtc('2026-06-01', '18:00').toISOString()).toBe('2026-06-01T16:00:00.000Z');
    });

    it('converts a Europe/Madrid wall time to UTC during CET (winter, UTC+1)', () => {
      expect(zonedTimeToUtc('2026-01-15', '18:00').toISOString()).toBe('2026-01-15T17:00:00.000Z');
    });

    it('rolls the UTC date back a day when the local time is early morning', () => {
      // 00:30 Madrid in June (CEST, UTC+2) is 2026-05-31 22:30 UTC.
      expect(zonedTimeToUtc('2026-06-01', '00:30').toISOString()).toBe('2026-05-31T22:30:00.000Z');
    });
  });
});
