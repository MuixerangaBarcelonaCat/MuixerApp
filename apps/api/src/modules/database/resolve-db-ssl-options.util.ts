/**
 * Refuses to start with an unverified TLS connection to Postgres (SEC-15):
 * `DB_SSL=true` now requires `DB_SSL_CA` (the provider's CA certificate, PEM
 * content) so the driver can actually validate the server identity instead
 * of silently falling back to `rejectUnauthorized: false`.
 */
export function resolveDbSslOptions(
  env: Record<string, string | undefined>,
): false | { ca: string; rejectUnauthorized: true } {
  if (env.DB_SSL !== 'true') {
    return false;
  }

  if (!env.DB_SSL_CA) {
    throw new Error(
      'DB_SSL is enabled but DB_SSL_CA is not set — refusing to connect with an unverified TLS certificate (SEC-15). ' +
        "Set DB_SSL_CA to the database provider's CA certificate (PEM content).",
    );
  }

  return { ca: env.DB_SSL_CA, rejectUnauthorized: true };
}
