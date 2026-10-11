import { AttendanceStatus } from '../enums/attendance-status.enum';
import { attendanceGroupLabel, attendanceStatusLabel, getEventPhase, isArrivalPhase, isStartedPhase } from './event-phase.util';

describe('getEventPhase', () => {
  it('is "before" until the event day starts (Valencia time)', () => {
    // 21:59 UTC on 9 May = 23:59 in Valencia (CEST), still the day before.
    expect(getEventPhase('2026-05-10', '19:00', new Date('2026-05-09T21:59:00Z'))).toBe('before');
  });

  it('is "day" on the event day until its start time (Valencia time)', () => {
    // 22:30 UTC on 9 May = 00:30 on 10 May in Valencia.
    expect(getEventPhase('2026-05-10', '19:00', new Date('2026-05-09T22:30:00Z'))).toBe('day');
    // 16:59 UTC = 18:59 in Valencia.
    expect(getEventPhase('2026-05-10', '19:00', new Date('2026-05-10T16:59:00Z'))).toBe('day');
  });

  it('is "started" from the start time to the end of the event day (Valencia time)', () => {
    // 17:00 UTC = 19:00 in Valencia.
    expect(getEventPhase('2026-05-10', '19:00', new Date('2026-05-10T17:00:00Z'))).toBe('started');
    // 21:59 UTC = 23:59 in Valencia.
    expect(getEventPhase('2026-05-10', '19:00', new Date('2026-05-10T21:59:00Z'))).toBe('started');
  });

  it('reads the start time in Valencia time in winter too (CET)', () => {
    // 17:59 UTC = 18:59 in Valencia; 18:00 UTC = 19:00.
    expect(getEventPhase('2026-01-10', '19:00', new Date('2026-01-10T17:59:00Z'))).toBe('day');
    expect(getEventPhase('2026-01-10', '19:00', new Date('2026-01-10T18:00:00Z'))).toBe('started');
  });

  it('is "started" for the whole event day when the event has no start time', () => {
    // 22:30 UTC on 9 May = 00:30 on 10 May in Valencia.
    expect(getEventPhase('2026-05-10', null, new Date('2026-05-09T22:30:00Z'))).toBe('started');
    expect(getEventPhase('2026-05-10', '', new Date('2026-05-09T22:30:00Z'))).toBe('started');
  });

  it('is "after" from the next day on', () => {
    expect(getEventPhase('2026-05-10', '19:00', new Date('2026-05-10T22:30:00Z'))).toBe('after');
  });
});

describe('attendanceStatusLabel', () => {
  it.each([
    ['before', AttendanceStatus.ANIRE, 'Ve'],
    ['before', AttendanceStatus.NO_VAIG, 'No ve'],
    ['before', AttendanceStatus.PENDENT, 'Pendent'],
    ['before', AttendanceStatus.ASSISTIT, 'Assistit'],
    ['day', AttendanceStatus.ASSISTIT, 'Ha arribat'],
    ['day', AttendanceStatus.ANIRE, 'Ve'],
    ['day', AttendanceStatus.NO_VAIG, 'No vindrà'],
    ['day', AttendanceStatus.PENDENT, 'Pendent'],
    ['started', AttendanceStatus.ASSISTIT, 'Ha arribat'],
    ['started', AttendanceStatus.ANIRE, 'No ha arribat'],
    ['started', AttendanceStatus.NO_VAIG, 'No vindrà'],
    ['started', AttendanceStatus.PENDENT, 'Pendent'],
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
    expect(isArrivalPhase('started')).toBe(true);
    expect(isArrivalPhase('after')).toBe(true);
  });
});

describe('isStartedPhase', () => {
  it('is true from the start time on: an ANIRE who isn\'t there yet is late', () => {
    expect(isStartedPhase('before')).toBe(false);
    expect(isStartedPhase('day')).toBe(false);
    expect(isStartedPhase('started')).toBe(true);
    expect(isStartedPhase('after')).toBe(true);
  });
});

describe('attendanceGroupLabel', () => {
  it('names the PENDENT group in plural until the event day is over', () => {
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'before')).toBe('Pendents');
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'day')).toBe('Pendents');
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'started')).toBe('Pendents');
    expect(attendanceGroupLabel(AttendanceStatus.PENDENT, 'after')).toBe('Sense resposta');
  });

  it('uses the status label for every other group', () => {
    expect(attendanceGroupLabel(AttendanceStatus.ASSISTIT, 'day')).toBe('Ha arribat');
    expect(attendanceGroupLabel(AttendanceStatus.ANIRE, 'after')).toBe('No presentat');
  });
});
