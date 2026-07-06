import { SyncLockService } from './sync-lock.service';

describe('SyncLockService', () => {
  it('acquires the lock when free', () => {
    const lock = new SyncLockService();

    expect(lock.tryAcquire()).toBe(true);
  });

  it('rejects a second acquire while already locked', () => {
    const lock = new SyncLockService();
    lock.tryAcquire();

    expect(lock.tryAcquire()).toBe(false);
  });

  it('allows acquiring again after release', () => {
    const lock = new SyncLockService();
    lock.tryAcquire();
    lock.release();

    expect(lock.tryAcquire()).toBe(true);
  });
});
