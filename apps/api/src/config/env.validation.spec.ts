import { envValidationSchema } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a-sufficiently-long-secret',
  JWT_REFRESH_SECRET: 'a-different-sufficiently-long-secret',
};

function validate(env: Record<string, string>) {
  return envValidationSchema.validate(env, { allowUnknown: true, abortEarly: false });
}

describe('envValidationSchema', () => {
  it('accepts the minimal required set of variables', () => {
    const { error } = validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('ignores unrelated environment variables (PATH, HOME, ...)', () => {
    const { error } = validate({ ...validEnv, PATH: '/usr/bin', HOME: '/home/user' });
    expect(error).toBeUndefined();
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'])(
    'rejects a missing %s',
    (key) => {
      const env = { ...validEnv };
      delete (env as Record<string, string>)[key];
      const { error } = validate(env);
      expect(error?.message).toContain(key);
    },
  );

  it('fills in defaults for optional numeric/string variables', () => {
    const { value, error } = validate(validEnv);
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.JWT_ACCESS_TTL).toBe(900);
    expect(value.JWT_REFRESH_TTL_DASHBOARD).toBe(28800);
    expect(value.JWT_REFRESH_TTL_PWA).toBe(604800);
    expect(value.REFRESH_TOKEN_COOKIE).toBe('muixer_rt');
    expect(value.ASSIGNMENT_LOCK_DAYS).toBe(2);
    expect(value.DB_SSL).toBe(false);
    expect(value.NODE_ENV).toBe('development');
  });

  it('coerces DB_SSL string values to a boolean', () => {
    const { value, error } = validate({ ...validEnv, DB_SSL: 'true' });
    expect(error).toBeUndefined();
    expect(value.DB_SSL).toBe(true);
  });

  it('allows LEGACY_API_* and SETUP_TOKEN to be absent (optional integrations)', () => {
    const { error } = validate(validEnv);
    expect(error).toBeUndefined();
  });
});
