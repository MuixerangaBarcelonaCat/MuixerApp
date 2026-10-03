import { AttendanceStatus, NOT_REGISTERED_STATUS, ResolvedAttendanceStatus } from '@muixer/shared';

/**
 * The status a member sees. The API reports NO_REGISTRAT for someone created after the event;
 * in the PWA that reads exactly like PENDENT (no answer). `null` (no attendance at all) stays null.
 */
export function memberAttendanceStatus(
  status: ResolvedAttendanceStatus | null | undefined,
): AttendanceStatus | null {
  if (status == null) return null;
  return status === NOT_REGISTERED_STATUS ? AttendanceStatus.PENDENT : status;
}
