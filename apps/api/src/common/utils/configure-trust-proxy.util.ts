import type { INestApplication } from '@nestjs/common';

/**
 * Trusts the first hop (the Caddy reverse proxy) so Express — and the
 * `@nestjs/throttler` guard, which keys on `req.ip` — resolve the real
 * client IP from `X-Forwarded-For` instead of Caddy's own address (SEC-8).
 */
export function configureTrustProxy(app: INestApplication): void {
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
}
