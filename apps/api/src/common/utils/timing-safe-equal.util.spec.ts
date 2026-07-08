import { safeCompare } from './timing-safe-equal.util';

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('super-secret-token', 'super-secret-token')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(safeCompare('super-secret-token', 'super-secret-tokeX')).toBe(false);
  });

  it('returns false — not throws — for strings of different lengths', () => {
    expect(() => safeCompare('short', 'a-much-longer-string')).not.toThrow();
    expect(safeCompare('short', 'a-much-longer-string')).toBe(false);
  });

  it('returns false when one of the strings is empty', () => {
    expect(safeCompare('', 'non-empty')).toBe(false);
  });

  it('returns true when both strings are empty', () => {
    expect(safeCompare('', '')).toBe(true);
  });
});
