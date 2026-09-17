import { Global, Module } from '@nestjs/common';
import { SegmentEventsService } from './segment-events.service';
import { SegmentChangeEmitter } from './segment-change.emitter';

/**
 * Bridges figure-data mutations to per-event SSE streams.
 *
 * Global because almost every mutating module needs `SegmentChangeEmitter`, the
 * same way they already rely on a globally-registered `EventEmitter2` — importing
 * it into each of them would be noise, not clarity.
 */
@Global()
@Module({
  providers: [SegmentEventsService, SegmentChangeEmitter],
  exports: [SegmentEventsService, SegmentChangeEmitter],
})
export class SegmentEventsModule {}
