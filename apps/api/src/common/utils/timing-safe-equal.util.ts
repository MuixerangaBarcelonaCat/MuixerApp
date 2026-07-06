import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for secrets (tokens, API keys). A plain
 * `===`/`!==` leaks timing information proportional to the matching prefix
 * length; `crypto.timingSafeEqual` closes that but throws on mismatched
 * buffer lengths, so the length check must happen first (SEC-3).
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
