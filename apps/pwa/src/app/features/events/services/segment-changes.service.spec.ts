import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { FigureDataChangedEvent, SegmentChangeSource } from '@muixer/shared';
import { SegmentChangesService } from './segment-changes.service';
import { AuthService } from '../../../core/auth/services/auth.service';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  /** Simulates the server pushing a change down this connection. */
  push(change: FigureDataChangedEvent) {
    this.onmessage?.({ data: JSON.stringify(change) } as MessageEvent);
  }

  open() {
    this.onopen?.(new Event('open'));
  }
}

const change = (segmentIds: string[]): FigureDataChangedEvent => ({
  eventId: 'event-1',
  segmentIds,
  source: SegmentChangeSource.ASSIGNMENT,
  originClientId: null,
  occurredAt: '2026-09-15T10:00:00.000Z',
});

describe('SegmentChangesService', () => {
  let service: SegmentChangesService;
  let originalEventSource: typeof EventSource;
  let subscription: Subscription | null;

  beforeEach(() => {
    vi.useFakeTimers();
    originalEventSource = globalThis.EventSource;
    MockEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource;
    subscription = null;

    TestBed.configureTestingModule({
      providers: [
        SegmentChangesService,
        { provide: AuthService, useValue: { getAccessToken: vi.fn().mockReturnValue('token-1') } },
      ],
    });
    service = TestBed.inject(SegmentChangesService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    (globalThis as unknown as { EventSource: unknown }).EventSource = originalEventSource;
    vi.useRealTimers();
  });

  /** Watches one segment and counts how many times a refetch is asked for. */
  const watch = (segmentId: string) => {
    let refetches = 0;
    subscription = service.watch('event-1', () => segmentId).subscribe(() => (refetches += 1));
    return {
      get count() {
        return refetches;
      },
      source: () => MockEventSource.instances[0],
    };
  };

  it('connects to the event stream with the access token', () => {
    const watcher = watch('segment-1');

    expect(watcher.source().url).toContain('/me/events/event-1/changes');
    expect(watcher.source().url).toContain('token=token-1');
  });

  it('asks for a refetch when a change touches the watched segment', () => {
    const watcher = watch('segment-1');

    watcher.source().push(change(['segment-1']));
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(1);
  });

  it('stays quiet when a change only touches other segments', () => {
    const watcher = watch('segment-1');

    watcher.source().push(change(['segment-2']));
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(0);
  });

  it('asks for a refetch on an event-wide change such as attendance', () => {
    const watcher = watch('segment-1');

    watcher.source().push(change([]));
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(1);
  });

  it('collapses a burst of changes into a single refetch', () => {
    const watcher = watch('segment-1');

    watcher.source().push(change(['segment-1']));
    watcher.source().push(change(['segment-1']));
    watcher.source().push(change(['segment-1']));
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(1);
  });

  it('resyncs after a dropped connection reopens', () => {
    const watcher = watch('segment-1');
    watcher.source().open(); // initial connect

    // Anything pushed while disconnected is gone for good, so reconnecting has to
    // refetch rather than assume the view is still current.
    watcher.source().open();
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(1);
  });

  it('does not refetch on the very first connection', () => {
    const watcher = watch('segment-1');

    watcher.source().open();
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(0);
  });

  it('closes the connection when the caller unsubscribes', () => {
    const watcher = watch('segment-1');
    const source = watcher.source();

    subscription?.unsubscribe();

    expect(source.closed).toBe(true);
  });
});
