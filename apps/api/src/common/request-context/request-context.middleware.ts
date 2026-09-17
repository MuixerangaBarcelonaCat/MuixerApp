import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

/**
 * Populates the request context so deeply-nested services can read the
 * originating tab's id without a parameter threaded through every call.
 *
 * Must be middleware, not an interceptor: `next.handle()` in an interceptor
 * returns an Observable synchronously, and Nest subscribes to it only after
 * the interceptor itself returns — i.e. outside an `als.run()` wrapped around
 * that call — so the route handler would run with an empty store. Express
 * middleware instead wraps the entire downstream continuation, and
 * `AsyncLocalStorage` propagates correctly through the async calls from there.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const clientId = (req.headers['x-client-id'] as string | undefined) ?? null;
    this.context.run({ clientId }, next);
  }
}
