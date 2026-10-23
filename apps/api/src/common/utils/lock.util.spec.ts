import { isPastLockWindow, lockWindow } from './lock.util';

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

describe('isPastLockWindow', () => {
  it('is false right after the event, within the lock window', () => {
    expect(isPastLockWindow(daysAgo(1), 2)).toBe(false);
  });

  it('is true once lockDays have elapsed since the event', () => {
    expect(isPastLockWindow(daysAgo(5), 2)).toBe(true);
  });

  it('is always false when lockDays is 0 or negative', () => {
    const eventDate = new Date('2000-01-01');
    expect(isPastLockWindow(eventDate, 0)).toBe(false);
    expect(isPastLockWindow(eventDate, -1)).toBe(false);
  });
});

describe('lockWindow', () => {
  it('gives the day the lock starts, lockDays after the event', () => {
    expect(lockWindow('2026-03-10', 2).lockDate).toBe('2026-03-12');
  });

  it('is locked once that day has passed', () => {
    expect(lockWindow(daysAgo(5), 2).locked).toBe(true);
    expect(lockWindow(daysAgo(1), 2).locked).toBe(false);
  });

  it('has no lock day when the lock is disabled', () => {
    expect(lockWindow('2000-01-01', 0)).toEqual({ locked: false, lockDate: null });
  });
});
