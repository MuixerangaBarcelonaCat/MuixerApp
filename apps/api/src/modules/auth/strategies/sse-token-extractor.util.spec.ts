import { Request } from 'express';
import { extractSseQueryToken } from './sse-token-extractor.util';

const mockRequest = (query: Record<string, unknown>): Request => ({ query }) as unknown as Request;

describe('extractSseQueryToken', () => {
  it('returns the token from the `token` query parameter', () => {
    expect(extractSseQueryToken(mockRequest({ token: 'jwt-value' }))).toBe('jwt-value');
  });

  it('returns null when there is no token query parameter', () => {
    expect(extractSseQueryToken(mockRequest({}))).toBeNull();
  });
});
