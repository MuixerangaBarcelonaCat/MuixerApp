import { AttendanceStatus, EventPhase, attendanceStatusLabel, isArrivalPhase, isStartedPhase } from '@muixer/shared';

/**
 * How a node's fill shows attendance: a solid wash when the person is confirmed, hatching while
 * they're pending, no fill when they're absent.
 */
export type AttendanceFill = 'confirmed' | 'pending' | 'absent';

/**
 * Until the start time, attendance is the answer the person gave; from then on, whether they're
 * here. A person with no known status is drawn as confirmed: no information adds no mark.
 */
export function attendanceVisual(status: string | null | undefined, phase: EventPhase): AttendanceFill {
  const started = isStartedPhase(phase);
  switch (status) {
    case 'ANIRE':
      return started ? 'pending' : 'confirmed';
    case 'PENDENT':
      return started ? 'absent' : 'pending';
    case 'NO_VAIG':
      return 'absent';
    default:
      return 'confirmed';
  }
}

const FILL_ORDER: AttendanceFill[] = ['confirmed', 'pending', 'absent'];
/** The order statuses are named in wherever a swatch stands for several of them. */
export const ATTENDANCE_STATUS_ORDER = [AttendanceStatus.ASSISTIT, AttendanceStatus.ANIRE, AttendanceStatus.PENDENT, AttendanceStatus.NO_VAIG];

/** «Ha arribat», «Ve» → «Ha arribat o ve»: the statuses one swatch stands for. */
export function joinAttendanceLabels(labels: string[]): string {
  return labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1))).join(' o ');
}

/**
 * The legend of the attendance fills for a phase: each fill with the statuses it stands for,
 * worded for the phase («Ha arribat o ve»). Nobody has arrived before the event day, so ASSISTIT
 * only counts from then on.
 */
export function attendanceLegend(phase: EventPhase): { fill: AttendanceFill; label: string }[] {
  const statuses = ATTENDANCE_STATUS_ORDER.filter((s) => s !== AttendanceStatus.ASSISTIT || isArrivalPhase(phase));
  return FILL_ORDER.map((fill) => {
    const labels = statuses.filter((s) => attendanceVisual(s, phase) === fill).map((s) => attendanceStatusLabel(s, phase));
    return { fill, label: joinAttendanceLabels(labels) };
  });
}
