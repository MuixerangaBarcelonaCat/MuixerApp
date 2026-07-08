import { Injectable } from '@nestjs/common';

/** In-process mutex shared by all /sync endpoints so only one legacy sync can run at a time. */
@Injectable()
export class SyncLockService {
  private locked = false;

  tryAcquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }
}
