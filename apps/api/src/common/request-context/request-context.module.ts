import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

/**
 * Global so any service can inject `RequestContextService` without importing
 * this module explicitly — the same reasoning as `SegmentEventsModule`.
 */
@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware],
  exports: [RequestContextService],
})
export class RequestContextModule {}
