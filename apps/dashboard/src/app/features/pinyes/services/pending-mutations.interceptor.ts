import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { PendingMutationsService } from './pending-mutations.service';

/** Matches a write to a pinyes figure/assignment/segment endpoint — never a GET (a read is
 *  never a mutation to gate on) and never an unrelated feature's endpoint (a save elsewhere
 *  in the app must not block the segment workspace's live-update banner). */
const PINYES_MUTATION_URL = /\/(figure-instances|events\/[^/]+\/segments)\//;

/**
 * Tracks pinyes mutation requests in flight via `PendingMutationsService`, so
 * `SegmentWorkspaceStateService` can defer a live-push refresh until the tab's own
 * edit has actually landed — one interceptor covers every mutation call site
 * (present and future) rather than wrapping each one individually.
 */
export const pendingMutationsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || !PINYES_MUTATION_URL.test(req.url)) {
    return next(req);
  }

  const tracker = inject(PendingMutationsService);
  tracker.increment();
  return next(req).pipe(finalize(() => tracker.decrement()));
};
