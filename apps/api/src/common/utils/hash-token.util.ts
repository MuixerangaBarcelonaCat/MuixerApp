import { createHash } from 'crypto';

/**
 * SHA-256 hex digest for secrets stored at rest (invite tokens, reset tokens).
 * Never store or log the raw token — compare/lookup by this hash instead, so a
 * DB dump/backup leak doesn't hand out ready-to-use tokens (SEC-6).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
