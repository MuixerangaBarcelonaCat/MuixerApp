import { Request, Response } from 'express';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  let contextService: RequestContextService;
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    contextService = new RequestContextService();
    middleware = new RequestContextMiddleware(contextService);
  });

  const makeRequest = (headers: Record<string, string> = {}): Request =>
    ({ headers }) as unknown as Request;

  it('stores the X-Client-Id header as clientId', () => {
    let seen: unknown;
    middleware.use(makeRequest({ 'x-client-id': 'tab-1' }), {} as Response, () => {
      seen = contextService.get();
    });

    expect(seen).toEqual({ clientId: 'tab-1' });
  });

  it('stores null when no X-Client-Id header is present', () => {
    let seen: unknown;
    middleware.use(makeRequest(), {} as Response, () => {
      seen = contextService.get();
    });

    expect(seen).toEqual({ clientId: null });
  });

  it('calls next() so the request continues', () => {
    const next = jest.fn();
    middleware.use(makeRequest(), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps the clientId available to an async continuation started inside next() — the exact case an interceptor cannot cover, since Nest subscribes to a controller Observable only after the interceptor returns', async () => {
    let seenAfterAwait: unknown;

    await new Promise<void>((resolve) => {
      middleware.use(makeRequest({ 'x-client-id': 'tab-1' }), {} as Response, () => {
        // Simulates the route handler's async work continuing after the
        // middleware's own call stack has already unwound.
        setImmediate(() => {
          seenAfterAwait = contextService.get();
          resolve();
        });
      });
    });

    expect(seenAfterAwait).toEqual({ clientId: 'tab-1' });
  });
});
