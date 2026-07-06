import { requireJwtSecret } from './jwt-secret.util';

describe('requireJwtSecret', () => {
  const ENV_VAR = 'JWT_SECRET_TEST_VAR';
  const original = process.env[ENV_VAR];

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = original;
  });

  it('throws when the environment variable is not set', () => {
    delete process.env[ENV_VAR];
    expect(() => requireJwtSecret(ENV_VAR)).toThrow(/JWT_SECRET_TEST_VAR/);
  });

  it('throws when the environment variable is an empty string', () => {
    process.env[ENV_VAR] = '';
    expect(() => requireJwtSecret(ENV_VAR)).toThrow(/JWT_SECRET_TEST_VAR/);
  });

  it('returns the configured value when set', () => {
    process.env[ENV_VAR] = 'a-real-secret';
    expect(requireJwtSecret(ENV_VAR)).toBe('a-real-secret');
  });
});
