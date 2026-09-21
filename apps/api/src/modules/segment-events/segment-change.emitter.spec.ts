import { EventEmitter2 } from '@nestjs/event-emitter';
import { SegmentChangeSource, FigureDataChangedEvent } from '@muixer/shared';
import { SegmentChangeEmitter } from './segment-change.emitter';
import { FIGURE_DATA_CHANGED } from './segment-events.service';
import { RequestContextService } from '../../common/request-context/request-context.service';

describe('SegmentChangeEmitter', () => {
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let requestContext: jest.Mocked<RequestContextService>;
  let emitter: SegmentChangeEmitter;

  const emittedPayload = (): FigureDataChangedEvent =>
    eventEmitter.emit.mock.calls[0][1] as FigureDataChangedEvent;

  beforeEach(() => {
    eventEmitter = { emit: jest.fn() } as unknown as jest.Mocked<EventEmitter2>;
    requestContext = { get: jest.fn().mockReturnValue(undefined) } as unknown as jest.Mocked<RequestContextService>;
    emitter = new SegmentChangeEmitter(eventEmitter, requestContext);
  });

  it('publishes the change on the figure-data bus', () => {
    emitter.emitChange('event-1', ['segment-1'], SegmentChangeSource.ASSIGNMENT);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit.mock.calls[0][0]).toBe(FIGURE_DATA_CHANGED);
    expect(emittedPayload()).toMatchObject({
      eventId: 'event-1',
      segmentIds: ['segment-1'],
      source: SegmentChangeSource.ASSIGNMENT,
    });
  });

  it('stamps the change with the moment it happened', () => {
    emitter.emitChange('event-1', ['segment-1'], SegmentChangeSource.ASSIGNMENT);

    expect(Date.parse(emittedPayload().occurredAt)).not.toBeNaN();
  });

  it('drops duplicate segment ids', () => {
    emitter.emitChange('event-1', ['segment-1', 'segment-1'], SegmentChangeSource.INSTANCE);

    expect(emittedPayload().segmentIds).toEqual(['segment-1']);
  });

  it('accepts an event-wide change with no segments', () => {
    emitter.emitChange('event-1', [], SegmentChangeSource.ATTENDANCE);

    expect(emittedPayload().segmentIds).toEqual([]);
  });

  it('skips changes whose event is unknown, rather than emitting a useless message', () => {
    emitter.emitChange(undefined, ['segment-1'], SegmentChangeSource.ASSIGNMENT);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("stamps the change with the request's client id, so the originating tab can recognize its own echo", () => {
    requestContext.get.mockReturnValue({ clientId: 'tab-1' });

    emitter.emitChange('event-1', ['segment-1'], SegmentChangeSource.ASSIGNMENT);

    expect(emittedPayload().originClientId).toBe('tab-1');
  });

  it('stamps null when no request context is available (e.g. a cron job, not a tab)', () => {
    requestContext.get.mockReturnValue(undefined);

    emitter.emitChange('event-1', ['segment-1'], SegmentChangeSource.ASSIGNMENT);

    expect(emittedPayload().originClientId).toBeNull();
  });
});
