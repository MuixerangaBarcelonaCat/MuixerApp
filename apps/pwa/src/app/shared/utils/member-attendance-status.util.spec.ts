import { AttendanceStatus, NOT_REGISTERED_STATUS } from '@muixer/shared';
import { memberAttendanceStatus } from './member-attendance-status.util';

describe('memberAttendanceStatus', () => {
  it('shows NO_REGISTRAT as PENDENT', () => {
    expect(memberAttendanceStatus(NOT_REGISTERED_STATUS)).toBe(AttendanceStatus.PENDENT);
  });

  it('keeps every stored status as it is', () => {
    for (const status of Object.values(AttendanceStatus)) {
      expect(memberAttendanceStatus(status)).toBe(status);
    }
  });

  it('keeps a missing attendance as null', () => {
    expect(memberAttendanceStatus(null)).toBeNull();
    expect(memberAttendanceStatus(undefined)).toBeNull();
  });
});
