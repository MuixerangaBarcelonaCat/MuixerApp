import { getLocalDayOfWeek, getLocalTimeOfDay } from './date.util';

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
});
