import { Injectable, MessageEvent } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject, concatMap, filter, interval, map, merge, finalize } from 'rxjs';
import { FigureDataChangedEvent } from '@muixer/shared';

/** Emitted on the in-process bus by every service that mutates figure data. */
export const FIGURE_DATA_CHANGED = 'figure-data.changed';

/**
 * An SSE connection is an HTTP response that never ends, and figure edits can be
 * many minutes apart. Anything in between — Caddy, carrier NAT, the OS — closes a
 * connection with no bytes flowing, so a periodic no-op keeps it from looking idle.
 */
export const SEGMENT_EVENTS_HEARTBEAT_MS = 30_000;

/**
 * A burst of writes (a bulk import, a fast sequence of assignments) would otherwise
 * be sent to every subscriber one message at a time, and each message costs every
 * client a projection refetch. Collapsing them at the source caps that fan-out.
 */
export const SEGMENT_EVENTS_COALESCE_MS = 300;

/** Heartbeats carry their own SSE type so `onmessage` only ever sees real changes. */
const HEARTBEAT: MessageEvent = { type: 'ping', data: '' };

@Injectable()
export class SegmentEventsService {
  private readonly streams = new Map<string, Subject<FigureDataChangedEvent>>();
  private readonly pending = new Map<string, { event: FigureDataChangedEvent; timer: NodeJS.Timeout }>();

  /** Events currently being watched by at least one subscriber. Diagnostics. */
  get activeEventCount(): number {
    return this.streams.size;
  }

  /**
   * Live changes for one event, as consumed by an `@Sse()` route.
   *
   * @param narrow trims a change to what this viewer is allowed to see, or returns
   * null to withhold it entirely. Applied per message rather than once at subscribe
   * time, so a segment published mid-stream becomes visible without reconnecting.
   */
  stream(
    eventId: string,
    narrow?: (event: FigureDataChangedEvent) => Promise<FigureDataChangedEvent | null>,
  ): Observable<MessageEvent> {
    const subject = this.subjectFor(eventId);

    const changes = narrow
      ? subject.pipe(
          concatMap((event) => narrow(event)),
          filter((event): event is FigureDataChangedEvent => event !== null),
        )
      : subject.asObservable();

    return merge(
      changes.pipe(map((event): MessageEvent => ({ data: JSON.stringify(event) }))),
      interval(SEGMENT_EVENTS_HEARTBEAT_MS).pipe(map(() => HEARTBEAT)),
    ).pipe(finalize(() => this.releaseIfIdle(eventId)));
  }

  @OnEvent(FIGURE_DATA_CHANGED, { async: true })
  handleChanged(event: FigureDataChangedEvent): void {
    const pending = this.pending.get(event.eventId);
    if (pending) {
      pending.event = this.mergeEvents(pending.event, event);
      return;
    }

    this.pending.set(event.eventId, {
      event,
      timer: setTimeout(() => this.flush(event.eventId), SEGMENT_EVENTS_COALESCE_MS),
    });
  }

  private mergeEvents(
    base: FigureDataChangedEvent,
    next: FigureDataChangedEvent,
  ): FigureDataChangedEvent {
    return {
      ...next,
      segmentIds: [...new Set([...base.segmentIds, ...next.segmentIds])],
      // Attributing a merged message to one tab would make every *other* tab in the
      // merge treat it as its own echo and stay silent about a real remote change.
      originClientId: base.originClientId === next.originClientId ? next.originClientId : null,
    };
  }

  private flush(eventId: string): void {
    const pending = this.pending.get(eventId);
    if (!pending) return;

    this.pending.delete(eventId);
    this.streams.get(eventId)?.next(pending.event);
  }

  private subjectFor(eventId: string): Subject<FigureDataChangedEvent> {
    const existing = this.streams.get(eventId);
    if (existing) return existing;

    const created = new Subject<FigureDataChangedEvent>();
    this.streams.set(eventId, created);
    return created;
  }

  private releaseIfIdle(eventId: string): void {
    const subject = this.streams.get(eventId);
    if (!subject || subject.observed) return;

    subject.complete();
    this.streams.delete(eventId);

    const pending = this.pending.get(eventId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(eventId);
    }
  }
}
