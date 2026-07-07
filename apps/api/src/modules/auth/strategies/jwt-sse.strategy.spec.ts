import { SseJwtStrategy } from './jwt-sse.strategy';

describe('SseJwtStrategy', () => {
  const original = process.env['JWT_SECRET'];

  afterEach(() => {
    if (original === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = original;
  });

  it('throws at construction when JWT_SECRET is not set', () => {
    delete process.env['JWT_SECRET'];
    expect(() => new SseJwtStrategy()).toThrow(/JWT_SECRET/);
  });

  it('constructs successfully when JWT_SECRET is set', () => {
    process.env['JWT_SECRET'] = 'test-secret';
    expect(() => new SseJwtStrategy()).not.toThrow();
  });

  it('validate() returns the JWT payload unchanged', () => {
    process.env['JWT_SECRET'] = 'test-secret';
    const strategy = new SseJwtStrategy();
    const payload = { sub: 'user-1', role: 'ADMIN' } as Parameters<typeof strategy.validate>[0];

    expect(strategy.validate(payload)).toBe(payload);
  });
});
