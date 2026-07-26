/**
 * Reads a required JWT secret from the environment. A missing secret is a
 * fatal startup error, not a silent authentication bypass.
 */
export function requireJwtSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Missing required environment variable: ${envVar}.`);
  }
  return value;
}
