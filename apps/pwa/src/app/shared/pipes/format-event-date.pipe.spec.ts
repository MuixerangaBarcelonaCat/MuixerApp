import { FormatEventDatePipe } from './format-event-date.pipe';

describe('FormatEventDatePipe', () => {
  const pipe = new FormatEventDatePipe();

  it('should format date in Catalan with capitalized weekday', () => {
    const result = pipe.transform('2026-06-18');
    expect(result.toLowerCase()).toContain('dijous');
    expect(result.charAt(0)).toBe(result.charAt(0).toUpperCase());
  });

  it('should return empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should return empty string for invalid date', () => {
    expect(pipe.transform('not-a-date')).toBe('');
  });

  it('should include day and month', () => {
    const result = pipe.transform('2026-01-15');
    expect(result.toLowerCase()).toContain('15');
    expect(result.toLowerCase()).toContain('gener');
  });
});
