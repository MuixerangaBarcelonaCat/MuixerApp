import { Injectable, signal } from '@angular/core';

/**
 * How many pinyes-mutation HTTP requests (assignments, cordons, ad-hoc nodes, instance
 * CRUD, segment updates, ...) are currently in flight, tracked by `pendingMutationsInterceptor`.
 * `SegmentWorkspaceStateService` gates a live-push refresh on this being zero, so a
 * server-truth refetch never races the response to the tab's own in-flight edit.
 */
@Injectable({ providedIn: 'root' })
export class PendingMutationsService {
  private readonly _count = signal(0);
  readonly count = this._count.asReadonly();

  increment(): void {
    this._count.update((n) => n + 1);
  }

  decrement(): void {
    this._count.update((n) => Math.max(0, n - 1));
  }
}
