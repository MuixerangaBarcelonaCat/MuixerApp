import { isPastLockWindow } from './lock.util';

describe('isPastLockWindow', () => {
  it('is false right after the event, within the lock window', () => {
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() - 1);
    expect(isPastLockWindow(eventDate, 2)).toBe(false);
  });

  it('is true once lockDays have elapsed since the event', () => {
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() - 5);
    expect(isPastLockWindow(eventDate, 2)).toBe(true);
  });

  it('is always false when lockDays is 0 or negative', () => {
    const eventDate = new Date('2000-01-01');
    expect(isPastLockWindow(eventDate, 0)).toBe(false);
    expect(isPastLockWindow(eventDate, -1)).toBe(false);
  });

  it('defaults lockDays from ASSIGNMENT_LOCK_DAYS env var', () => {
    const original = process.env.ASSIGNMENT_LOCK_DAYS;
    process.env.ASSIGNMENT_LOCK_DAYS = '0';
    expect(isPastLockWindow(new Date('2000-01-01'))).toBe(false);
    process.env.ASSIGNMENT_LOCK_DAYS = original;
  });
});
