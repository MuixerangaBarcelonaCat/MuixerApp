import { AttendanceStatus } from '../enums/attendance-status.enum';
import { attendanceGroupLabel, attendanceStatusLabel, getEventPhase, isArrivalPhase } from './event-phase.util';

describe('getEventPhase', () => {
  it('is "before" until the event day starts (Europe/Madrid)', () => {
    // 21:59 UTC on 9 May = 23:59 in Madrid (CEST), still the day before.
    expect(getEventPhase('2026-05-10', new Date('2026-05-09T21:59:00Z'))).toBe('before');
  });

  it('is "day" for the whole event day in Madrid, before and after the start time', () => {
    // 22:30 UTC on 9 May = 00:30 on 10 May in Madrid.
    expect(getEventPhase('2026-05-10', new Date('2026-05-09T22:30:00Z'))).toBe('day');
    expect(getEventPhase('2026-05-10', new Date('2026-05-10T21:30:00Z'))).toBe('day');
  });

  it('is "after" from the next day on', () => {
    expect(getEventPhase('2026-05-10', new Date('2026-05-10T22:30:00Z'))).toBe('after');
  });
});

describe('attendanceStatusLabel', () => {
  it.each([
    ['before', AttendanceStatus.ANIRE, 'Ve'],
    ['before', AttendanceStatus.NO_VAIG, 'No ve'],
    ['before', AttendanceStatus.PENDENT, 'Pendent'],
    ['before', AttendanceStatus.ASSISTIT, 'Assistit'],
    ['day', AttendanceStatus.ASSISTIT, 'Ha arribat'],
    ['day', AttendanceStatus.ANIRE, 'No ha arribat'],
    ['day', AttendanceStatus.NO_VAIG, 'No vindrà'],
    ['day', AttendanceStatus.PENDENT, 'Pendent'],
    ['after', AttendanceStatus.ASSISTIT, 'Va vindre'],
    ['after', AttendanceStatus.ANIRE, 'No presentat'],
    ['after', AttendanceStatus.NO_VAIG, 'No va vindre'],
    ['after', AttendanceStatus.PENDENT, 'Sense resposta'],
  ] as const)('%s / %s → "%s"', (phase, status, label) => {
    expect(attendanceStatusLabel(status, phase)).toBe(label);
  });
});

describe('isArrivalPhase', () => {
  it('is true from the event day on', () => {
    expect(isArrivalPhase('before')).toBe(false);
    expect(isArrivalPhase('day')).toBe(true);
    expect(isArrivalPhase('after')).toBe(true);
  });
});

describe('attendanceGroupLabel', () => {
  it('names the PENDENT group in plural until the event day is over', () => {
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'before')).toBe('Pendents');
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'day')).toBe('Pendents');
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'after')).toBe('Sense resposta');
  });

  it('uses the status label for every other group', () => {
    expect(attendanceGroupLabel(AttendanceStatus.ASSISTIT, 'day')).toBe('Ha arribat');
    expect(attendanceGroupLabel(AttendanceStatus.ANIRE, 'after')).toBe('No presentat');
  });
});
