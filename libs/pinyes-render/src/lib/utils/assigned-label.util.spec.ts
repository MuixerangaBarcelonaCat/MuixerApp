import { formatAssignedLabel } from './assigned-label.util';

describe('formatAssignedLabel', () => {
  it('returns the alias alone when there is no indicator', () => {
    expect(formatAssignedLabel('MARTA', null)).toBe('MARTA');
  });

  it('returns the alias alone when the indicator is undefined', () => {
    expect(formatAssignedLabel('MARTA', undefined)).toBe('MARTA');
  });

  it('returns the alias alone when the indicator is an empty string', () => {
    expect(formatAssignedLabel('MARTA', '')).toBe('MARTA');
  });

  it('appends the indicator in parentheses when present', () => {
    expect(formatAssignedLabel('MARTA', 'X')).toBe('MARTA (X)');
  });
});
