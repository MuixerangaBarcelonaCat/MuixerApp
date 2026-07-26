import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Baseline HTTP security headers (SEC-11): nosniff, frame-deny, HSTS, etc.
 * Cheap defense-in-depth — the API is mostly JSON, but Swagger UI is real HTML.
 */
export function configureHelmet(app: INestApplication): void {
  app.use(helmet());
}
