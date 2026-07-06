/**
 * Reads a required JWT secret from the environment. Throws instead of
 * falling back to a hardcoded default — a missing secret must be a fatal
 * startup error, not a silent authentication bypass (SEC-1).
 */
export function requireJwtSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${envVar}. Refusing to start with a hardcoded fallback secret.`,
    );
  }
  return value;
}
