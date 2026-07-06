import { createHash } from 'crypto';
import { hashToken } from './hash-token.util';

describe('hashToken', () => {
  it('returns the sha256 hex digest of the token', () => {
    const expected = createHash('sha256').update('my-secret-token').digest('hex');
    expect(hashToken('my-secret-token')).toBe(expected);
  });

  it('is deterministic — same input always produces the same hash', () => {
    expect(hashToken('same-token')).toBe(hashToken('same-token'));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('never returns the plaintext token itself', () => {
    expect(hashToken('super-secret')).not.toBe('super-secret');
  });
});
