import {
  formatAssignedLabel,
  resolveAssignmentPersonLabel,
} from './assigned-label.util';

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

describe('resolveAssignmentPersonLabel', () => {
  it('prefers alias', () => {
    expect(resolveAssignmentPersonLabel({ alias: 'MARTA', name: 'Marta' })).toBe(
      'MARTA',
    );
  });

  it('falls back to name when alias is blank', () => {
    expect(resolveAssignmentPersonLabel({ alias: ' ', name: 'Marta' })).toBe(
      'Marta',
    );
  });

  it('never falls back to surname or a blank label', () => {
    expect(
      resolveAssignmentPersonLabel({
        alias: '',
        name: '',
      }),
    ).toBe('—');
  });
});
