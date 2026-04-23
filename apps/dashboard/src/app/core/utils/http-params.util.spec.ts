import { buildHttpParams } from './http-params.util';

describe('buildHttpParams', () => {
  it('maps scalar values to HttpParams', () => {
    const p = buildHttpParams({ a: 'x', b: 1, c: true });
    expect(p.get('a')).toBe('x');
    expect(p.get('b')).toBe('1');
    expect(p.get('c')).toBe('true');
  });

  it('appends array values with repeated keys', () => {
    const p = buildHttpParams({ id: ['u1', 'u2'] });
    expect(p.getAll('id')).toEqual(['u1', 'u2']);
  });

  it('omits undefined, null, and empty string', () => {
    const p = buildHttpParams({ a: undefined, b: null, c: '', d: 'ok' });
    expect(p.keys().length).toBe(1);
    expect(p.get('d')).toBe('ok');
  });
});
