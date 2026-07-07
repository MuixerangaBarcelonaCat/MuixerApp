import { Request } from 'express';

/**
 * Reads the JWT from the `?token=` query parameter. Used only by the
 * SSE-scoped strategy — the browser's EventSource API cannot set custom
 * headers, so this is the only way it can authenticate (SEC-4). Never wired
 * into the default strategy used by every other route.
 */
export function extractSseQueryToken(req: Request): string | null {
  const token = req.query?.['token'] as string | undefined;
  return token ?? null;
}
