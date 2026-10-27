import { AttendanceStatus } from '../enums/attendance-status.enum';

/**
 * Where "now" falls relative to an event, in Valencia time: attendance is asked for `before` the
 * event day; on the `day`, arrivals can be marked from midnight, but someone coming isn't late
 * until the event has `started`; `after` the event day it is only read.
 */
export type EventPhase = 'before' | 'day' | 'started' | 'after';

/** From the event day on, attendance means arrival: the controls mark who has arrived. */
export function isArrivalPhase(phase: EventPhase): boolean {
  return phase !== 'before';
}

/** From the start time on, an ANIRE who hasn't arrived (yet, or at all) is late. */
export function isStartedPhase(phase: EventPhase): boolean {
  return phase === 'started' || phase === 'after';
}

const valenciaWallClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `now` as Valencia wall-clock `YYYY-MM-DD` and `HH:mm`. */
function valenciaDateAndTime(now: Date): { date: string; time: string } {
  const parts = valenciaWallClock.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

/**
 * `eventDate` is the event's date-only `YYYY-MM-DD`; `startTime` its Valencia `HH:mm`, if any. An
 * event with no start time has `started` from the beginning of its day.
 */
export function getEventPhase(eventDate: string, startTime: string | null, now: Date = new Date()): EventPhase {
  const today = valenciaDateAndTime(now);
  const day = eventDate.slice(0, 10);
  if (today.date < day) return 'before';
  if (today.date > day) return 'after';
  return startTime && today.time < startTime ? 'day' : 'started';
}

/** An attendance status as the enum or its plain string value (the Pinyes models use the string union). */
export type AttendanceStatusValue = AttendanceStatus | `${AttendanceStatus}`;

const LABELS: Record<EventPhase, Record<AttendanceStatus, string>> = {
  before: {
    [AttendanceStatus.ANIRE]: 'Ve',
    [AttendanceStatus.NO_VAIG]: 'No ve',
    [AttendanceStatus.PENDENT]: 'Pendent',
    [AttendanceStatus.ASSISTIT]: 'Assistit',
  },
  day: {
    [AttendanceStatus.ASSISTIT]: 'Ha arribat',
    [AttendanceStatus.ANIRE]: 'Ve',
    [AttendanceStatus.NO_VAIG]: 'No vindrà',
    [AttendanceStatus.PENDENT]: 'Pendent',
  },
  started: {
    [AttendanceStatus.ASSISTIT]: 'Ha arribat',
    [AttendanceStatus.ANIRE]: 'No ha arribat',
    [AttendanceStatus.NO_VAIG]: 'No vindrà',
    [AttendanceStatus.PENDENT]: 'Pendent',
  },
  after: {
    [AttendanceStatus.ASSISTIT]: 'Va vindre',
    [AttendanceStatus.ANIRE]: 'No presentat',
    [AttendanceStatus.NO_VAIG]: 'No va vindre',
    [AttendanceStatus.PENDENT]: 'Sense resposta',
  },
};

/**
 * The label of an attendance status for staff, worded for the event's phase. The single source of
 * these labels in the Dashboard (the PWA speaks to the member and keeps its own wording).
 */
export function attendanceStatusLabel(status: AttendanceStatusValue, phase: EventPhase): string {
  return LABELS[phase][status as AttendanceStatus];
}

/**
 * The label of a group of people sharing a status (a filter option, a list section, a counter):
 * the status label, except PENDENT, which reads «Pendents» until the event day is over.
 */
export function attendanceGroupLabel(status: AttendanceStatusValue, phase: EventPhase): string {
  if (status === AttendanceStatus.PENDENT && phase !== 'after') return 'Pendents';
  return attendanceStatusLabel(status, phase);
}
