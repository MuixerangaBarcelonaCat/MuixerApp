import { resolveDbSslOptions } from './resolve-db-ssl-options.util';

describe('resolveDbSslOptions', () => {
  it('returns false when DB_SSL is not set', () => {
    expect(resolveDbSslOptions({})).toBe(false);
  });

  it('returns false when DB_SSL is not "true"', () => {
    expect(resolveDbSslOptions({ DB_SSL: 'false' })).toBe(false);
  });

  it('returns a verified ssl config when DB_SSL is enabled and DB_SSL_CA is provided', () => {
    const ca = '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----';

    expect(resolveDbSslOptions({ DB_SSL: 'true', DB_SSL_CA: ca })).toEqual({
      ca,
      rejectUnauthorized: true,
    });
  });

  it('crashes instead of silently connecting unverified when DB_SSL is enabled without DB_SSL_CA (SEC-15)', () => {
    expect(() => resolveDbSslOptions({ DB_SSL: 'true' })).toThrow(/DB_SSL_CA/);
  });

  it('crashes when DB_SSL_CA is set but empty', () => {
    expect(() => resolveDbSslOptions({ DB_SSL: 'true', DB_SSL_CA: '' })).toThrow(/DB_SSL_CA/);
  });
});
