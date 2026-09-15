import { Injectable, inject } from '@angular/core';
import { Observable, Subject, debounceTime, filter, map, merge } from 'rxjs';
import { FigureDataChangedEvent } from '@muixer/shared';
import { AuthService } from '../../../core/auth/services/auth.service';
import { environment } from '../../../../environments/environment';

/** Collapses a burst of writes (a bulk import, a fast run of assignments) into one refetch. */
const REFETCH_DEBOUNCE_MS = 400;

/** Spreads simultaneous refetches so every open tab doesn't hit the API at once. */
const MAX_REFETCH_JITTER_MS = 300;

@Injectable({ providedIn: 'root' })
export class SegmentChangesService {
  private readonly auth = inject(AuthService);

  /**
   * Emits whenever the given segment's data should be refetched.
   *
   * Resolves the segment id lazily so segment navigation within the workspace reuses
   * the same connection — the stream is keyed by event, not by segment.
   */
  watch(eventId: string, currentSegmentId: () => string): Observable<void> {
    return new Observable<void>((subscriber) => {
      const token = this.auth.getAccessToken();
      if (!token) return;

      // EventSource cannot set headers, hence the token in the query string (SEC-4).
      const source = new EventSource(
        `${environment.apiUrl}/events/${eventId}/segments/changes?token=${encodeURIComponent(token)}`,
      );

      const changes = new Subject<FigureDataChangedEvent>();
      const reconnects = new Subject<void>();
      let connected = false;

      source.onopen = () => {
        // Anything pushed while the connection was down is gone for good — the server
        // keeps no backlog — so a reopened connection has to resync rather than trust
        // what's on screen. The first open is skipped: the caller just loaded.
        if (connected) reconnects.next();
        connected = true;
      };

      source.onmessage = (message) => {
        changes.next(JSON.parse(message.data) as FigureDataChangedEvent);
      };

      const relevant = changes.pipe(
        filter((change) => this.touches(change, currentSegmentId())),
        map(() => undefined),
      );

      const inner = merge(relevant, reconnects)
        .pipe(debounceTime(REFETCH_DEBOUNCE_MS + Math.random() * MAX_REFETCH_JITTER_MS))
        .subscribe(() => subscriber.next());

      return () => {
        inner.unsubscribe();
        source.close();
      };
    });
  }

  /** An empty segment list means the change is event-wide (attendance, for instance). */
  private touches(change: FigureDataChangedEvent, segmentId: string): boolean {
    return change.segmentIds.length === 0 || change.segmentIds.includes(segmentId);
  }
}
