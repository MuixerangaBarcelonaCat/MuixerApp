import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FigureDataChangedEvent, SegmentChangeSource } from '@muixer/shared';
import { FIGURE_DATA_CHANGED } from './segment-events.service';
import { RequestContextService } from '../../common/request-context/request-context.service';

/**
 * The single place figure-data mutations announce themselves. Services call
 * `emitChange()` rather than building the payload themselves, so the shape — and
 * later the originating-tab attribution — lives in one file instead of a dozen
 * call sites.
 */
@Injectable()
export class SegmentChangeEmitter {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * @param segmentIds affected segments; empty means event-wide.
   */
  emitChange(
    eventId: string | undefined | null,
    segmentIds: (string | undefined | null)[],
    source: SegmentChangeSource,
  ): void {
    // Some mutation paths don't load the event relation. Emitting without an event
    // id would produce a message no stream is keyed by, so drop it instead.
    if (!eventId) return;

    const event: FigureDataChangedEvent = {
      eventId,
      segmentIds: [...new Set(segmentIds.filter((id): id is string => !!id))],
      source,
      originClientId: this.requestContext.get()?.clientId ?? null,
      occurredAt: new Date().toISOString(),
    };

    this.eventEmitter.emit(FIGURE_DATA_CHANGED, event);
  }
}
