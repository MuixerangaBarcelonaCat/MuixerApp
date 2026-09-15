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

  const watch = (segmentId: string) => {
    let refetches = 0;
    const received: (FigureDataChangedEvent | null)[] = [];
    subscription = service.watch('event-1', () => segmentId).subscribe((event) => {
      refetches += 1;
      received.push(event);
    });
    return {
      get count() {
        return refetches;
      },
      received,
      source: () => MockEventSource.instances[0],
    };
  };

  it('connects to the dashboard segments-changes endpoint with the access token', () => {
    const watcher = watch('segment-1');

    expect(watcher.source().url).toContain('/events/event-1/segments/changes');
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

  it('resyncs after a dropped connection reopens', () => {
    const watcher = watch('segment-1');
    watcher.source().open();

    watcher.source().open();
    vi.advanceTimersByTime(2000);

    expect(watcher.count).toBe(1);
  });

  it('passes the actual change event through, so a caller can inspect its originClientId', () => {
    const watcher = watch('segment-1');
    const theChange = change(['segment-1']);

    watcher.source().push(theChange);
    vi.advanceTimersByTime(2000);

    expect(watcher.received[0]).toMatchObject(theChange);
  });

  it('emits null for a reconnect-triggered resync, since there is no specific change to attribute', () => {
    const watcher = watch('segment-1');
    watcher.source().open(); // initial connect

    watcher.source().open(); // reconnect
    vi.advanceTimersByTime(2000);

    expect(watcher.received[0]).toBeNull();
  });

  it('closes the connection when the caller unsubscribes', () => {
    const watcher = watch('segment-1');
    const source = watcher.source();

    subscription?.unsubscribe();

    expect(source.closed).toBe(true);
  });
});
