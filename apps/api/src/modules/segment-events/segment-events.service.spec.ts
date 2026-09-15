import { Subscription } from 'rxjs';
import { SegmentChangeSource, FigureDataChangedEvent } from '@muixer/shared';
import { SegmentEventsService, SEGMENT_EVENTS_HEARTBEAT_MS } from './segment-events.service';

const makeEvent = (overrides: Partial<FigureDataChangedEvent> = {}): FigureDataChangedEvent => ({
  eventId: 'event-1',
  segmentIds: ['segment-1'],
  source: SegmentChangeSource.ASSIGNMENT,
  originClientId: 'client-a',
  occurredAt: '2026-09-15T10:00:00.000Z',
  ...overrides,
});

/** Parses the JSON payload of a captured SSE message. */
const payloadOf = (message: { data: string | object }): FigureDataChangedEvent =>
  JSON.parse(message.data as string) as FigureDataChangedEvent;

describe('SegmentEventsService', () => {
  let service: SegmentEventsService;
  let subscriptions: Subscription[];

  beforeEach(() => {
    jest.useFakeTimers();
    service = new SegmentEventsService();
    subscriptions = [];
  });

  afterEach(() => {
    subscriptions.forEach((s) => s.unsubscribe());
    jest.useRealTimers();
  });

  /** Subscribes to an event's stream and collects everything it emits. */
  const listen = (eventId: string) => {
    const received: { type?: string; data: string | object }[] = [];
    subscriptions.push(service.stream(eventId).subscribe((m) => received.push(m)));
    return received;
  };

  it('delivers a change to a subscriber of the same event', () => {
    const received = listen('event-1');

    service.handleChanged(makeEvent({ segmentIds: ['segment-7'] }));
    jest.advanceTimersByTime(1000);

    expect(received).toHaveLength(1);
    expect(payloadOf(received[0])).toMatchObject({
      eventId: 'event-1',
      segmentIds: ['segment-7'],
      source: SegmentChangeSource.ASSIGNMENT,
    });
  });

  it('does not deliver a change to a subscriber of a different event', () => {
    const other = listen('event-2');

    service.handleChanged(makeEvent({ eventId: 'event-1' }));
    jest.advanceTimersByTime(1000);

    expect(other).toHaveLength(0);
  });

  it('coalesces changes in the same window into one message with the union of segments', () => {
    const received = listen('event-1');

    service.handleChanged(makeEvent({ segmentIds: ['segment-1'] }));
    service.handleChanged(makeEvent({ segmentIds: ['segment-2'] }));
    service.handleChanged(makeEvent({ segmentIds: ['segment-1', 'segment-3'] }));
    jest.advanceTimersByTime(1000);

    expect(received).toHaveLength(1);
    expect(payloadOf(received[0]).segmentIds.sort()).toEqual(['segment-1', 'segment-2', 'segment-3']);
  });

  it('drops originClientId when coalescing changes made by different clients', () => {
    const received = listen('event-1');

    service.handleChanged(makeEvent({ originClientId: 'client-a' }));
    service.handleChanged(makeEvent({ originClientId: 'client-b' }));
    jest.advanceTimersByTime(1000);

    // Keeping either id would make the other client wrongly treat this as its own echo
    // and silently skip the "someone else changed this" banner.
    expect(payloadOf(received[0]).originClientId).toBeNull();
  });

  it('keeps originClientId when every coalesced change came from the same client', () => {
    const received = listen('event-1');

    service.handleChanged(makeEvent({ originClientId: 'client-a' }));
    service.handleChanged(makeEvent({ originClientId: 'client-a' }));
    jest.advanceTimersByTime(1000);

    expect(payloadOf(received[0]).originClientId).toBe('client-a');
  });

  it('sends changes in separate windows as separate messages', () => {
    const received = listen('event-1');

    service.handleChanged(makeEvent({ segmentIds: ['segment-1'] }));
    jest.advanceTimersByTime(1000);
    service.handleChanged(makeEvent({ segmentIds: ['segment-2'] }));
    jest.advanceTimersByTime(1000);

    expect(received).toHaveLength(2);
  });

  it('emits a heartbeat typed "ping" so idle traffic never reaches onmessage', () => {
    const received = listen('event-1');

    jest.advanceTimersByTime(SEGMENT_EVENTS_HEARTBEAT_MS);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('ping');
  });

  describe('narrowing a stream to what a viewer may see', () => {
    /** Subscribes with a narrowing step and collects what survives it. */
    const listenNarrowed = (
      eventId: string,
      narrow: (event: FigureDataChangedEvent) => Promise<FigureDataChangedEvent | null>,
    ) => {
      const received: { type?: string; data: string | object }[] = [];
      subscriptions.push(service.stream(eventId, narrow).subscribe((m) => received.push(m)));
      return received;
    };

    it('delivers the narrowed version of a change', async () => {
      const received = listenNarrowed('event-1', async (event) => ({
        ...event,
        segmentIds: event.segmentIds.filter((id) => id === 'visible'),
      }));

      service.handleChanged(makeEvent({ segmentIds: ['visible', 'hidden'] }));
      await jest.advanceTimersByTimeAsync(1000);

      expect(payloadOf(received[0]).segmentIds).toEqual(['visible']);
    });

    it('drops a change the viewer may not see at all', async () => {
      const received = listenNarrowed('event-1', async () => null);

      service.handleChanged(makeEvent());
      await jest.advanceTimersByTimeAsync(1000);

      expect(received).toHaveLength(0);
    });

    it('still sends heartbeats through a narrowed stream', async () => {
      const received = listenNarrowed('event-1', async () => null);

      await jest.advanceTimersByTimeAsync(SEGMENT_EVENTS_HEARTBEAT_MS);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('ping');
    });
  });

  it('releases an event once its last subscriber leaves', () => {
    const subscription = service.stream('event-1').subscribe();
    expect(service.activeEventCount).toBe(1);

    subscription.unsubscribe();

    expect(service.activeEventCount).toBe(0);
  });

  it('keeps an event alive while other subscribers remain', () => {
    const first = service.stream('event-1').subscribe();
    const second = service.stream('event-1').subscribe();
    subscriptions.push(second);

    first.unsubscribe();

    expect(service.activeEventCount).toBe(1);
  });

  it('ignores a change for an event nobody is watching', () => {
    expect(() => {
      service.handleChanged(makeEvent({ eventId: 'unwatched' }));
      jest.advanceTimersByTime(1000);
    }).not.toThrow();
  });
});
