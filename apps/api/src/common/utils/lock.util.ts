/** Days after an event's date past which edits linked to it are locked (same variable node-assignment uses). */
export function getAssignmentLockDays(): number {
  return parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '2', 10);
}

/** True once `lockDays` days have elapsed since `eventDate`. `lockDays <= 0` disables the lock. */
export function isPastLockWindow(eventDate: Date | string, lockDays: number = getAssignmentLockDays()): boolean {
  if (lockDays <= 0) return false;

  const lockDate = new Date(eventDate);
  lockDate.setDate(lockDate.getDate() + lockDays);

  return new Date() > lockDate;
}
