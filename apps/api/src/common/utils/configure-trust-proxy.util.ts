import type { INestApplication } from '@nestjs/common';

/**
 * Trusts the first hop (the Caddy reverse proxy) so Express resolves the real
 * client IP from `X-Forwarded-For` instead of Caddy's own address (SEC-8).
 * Rate limiting is enforced at Caddy; this still matters for logs and audit.
 */
export function configureTrustProxy(app: INestApplication): void {
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
}
