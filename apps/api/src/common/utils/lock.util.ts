export interface LockWindow {
  locked: boolean;
  /** `YYYY-MM-DD` the lock starts; `null` when the lock is disabled. */
  lockDate: string | null;
}

/** Where `eventDate` stands against a lock of `lockDays` days (the colla setting `assignmentLockDays`). `lockDays <= 0` disables the lock. */
export function lockWindow(eventDate: Date | string, lockDays: number): LockWindow {
  if (lockDays <= 0) return { locked: false, lockDate: null };

  const lockDate = new Date(eventDate);
  lockDate.setDate(lockDate.getDate() + lockDays);

  return { locked: new Date() > lockDate, lockDate: lockDate.toISOString().slice(0, 10) };
}

/** True once `lockDays` days have elapsed since `eventDate`. `lockDays <= 0` disables the lock. */
export function isPastLockWindow(eventDate: Date | string, lockDays: number): boolean {
  return lockWindow(eventDate, lockDays).locked;
}
