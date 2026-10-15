import { AttendanceStatus } from '../enums/attendance-status.enum';

/**
 * Where "today" falls relative to an event, by calendar day in Europe/Madrid: attendance is asked
 * for `before` the event day, taken (arrivals) on the `day`, and only read `after` it.
 */
export type EventPhase = 'before' | 'day' | 'after';

/** From the event day on, attendance means arrival: ANIRE is someone who hasn't (or didn't) show up. */
export function isArrivalPhase(phase: EventPhase): boolean {
  return phase !== 'before';
}

const madridDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `eventDate` is the event's date-only `YYYY-MM-DD`. */
export function getEventPhase(eventDate: string, now: Date = new Date()): EventPhase {
  const today = madridDate.format(now);
  const day = eventDate.slice(0, 10);
  if (today < day) return 'before';
  return today === day ? 'day' : 'after';
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
