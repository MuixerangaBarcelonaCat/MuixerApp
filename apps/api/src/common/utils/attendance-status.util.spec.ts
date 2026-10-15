import { AttendanceStatus, NOT_REGISTERED_STATUS } from '@muixer/shared';
import { personExistedAtEventSql, personPendingAtEventSql, resolveAttendanceStatus } from './attendance-status.util';

describe('resolveAttendanceStatus', () => {
  const eventDate = '2026-05-10';

  it('keeps an answered status regardless of when the person was created', () => {
    const createdAfter = new Date('2026-06-01T10:00:00Z');
    expect(resolveAttendanceStatus(AttendanceStatus.ANIRE, createdAfter, eventDate)).toBe(AttendanceStatus.ANIRE);
    expect(resolveAttendanceStatus(AttendanceStatus.ASSISTIT, createdAfter, eventDate)).toBe(AttendanceStatus.ASSISTIT);
    expect(resolveAttendanceStatus(AttendanceStatus.NO_VAIG, createdAfter, eventDate)).toBe(AttendanceStatus.NO_VAIG);
  });

  it('is PENDENT with no row when the person existed before the event', () => {
    expect(resolveAttendanceStatus(null, new Date('2026-01-01T10:00:00Z'), eventDate)).toBe(AttendanceStatus.PENDENT);
  });

  it('is PENDENT when the person was created on the event day', () => {
    expect(resolveAttendanceStatus(null, new Date('2026-05-10T18:00:00Z'), eventDate)).toBe(AttendanceStatus.PENDENT);
  });

  it('compares the creation day in Europe/Madrid, not UTC', () => {
    // 23:30 UTC on the 9th is 01:30 on the 10th in Madrid (CEST) → same day as the event.
    expect(resolveAttendanceStatus(null, new Date('2026-05-09T23:30:00Z'), eventDate)).toBe(AttendanceStatus.PENDENT);
    // 22:30 UTC on the 10th is 00:30 on the 11th in Madrid → the day after.
    expect(resolveAttendanceStatus(null, new Date('2026-05-10T22:30:00Z'), eventDate)).toBe(NOT_REGISTERED_STATUS);
  });

  it('is NO_REGISTRAT with no row when the person was created after the event', () => {
    expect(resolveAttendanceStatus(null, new Date('2026-05-11T10:00:00Z'), eventDate)).toBe(NOT_REGISTERED_STATUS);
  });

  it('treats a PENDENT row like no row', () => {
    expect(resolveAttendanceStatus(AttendanceStatus.PENDENT, new Date('2026-01-01T10:00:00Z'), eventDate)).toBe(
      AttendanceStatus.PENDENT,
    );
    expect(resolveAttendanceStatus(AttendanceStatus.PENDENT, new Date('2026-05-11T10:00:00Z'), eventDate)).toBe(
      NOT_REGISTERED_STATUS,
    );
  });

  it('accepts the event date as a Date (date-only column hydrated at UTC midnight)', () => {
    expect(resolveAttendanceStatus(null, new Date('2026-05-10T18:00:00Z'), new Date('2026-05-10'))).toBe(
      AttendanceStatus.PENDENT,
    );
  });
});

describe('personExistedAtEventSql', () => {
  it('compares the Madrid creation day of the person with the event date', () => {
    expect(personExistedAtEventSql('p', 'e.date')).toBe(
      `(p."createdAt" AT TIME ZONE 'Europe/Madrid')::date <= e.date`,
    );
  });
});

describe('personPendingAtEventSql', () => {
  it('requires the person to have existed and to have no answered row for the event', () => {
    expect(personPendingAtEventSql('p', 'e')).toBe(
      `(p."createdAt" AT TIME ZONE 'Europe/Madrid')::date <= e.date AND NOT EXISTS (` +
        `SELECT 1 FROM attendances pending_a WHERE pending_a."personId" = p.id ` +
        `AND pending_a."eventId" = e.id AND pending_a.status <> 'PENDENT')`,
    );
  });
});
