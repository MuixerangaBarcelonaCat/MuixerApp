import { COPYRIGHT_HOLDER, SOURCE_CODE_URL, formatCopyrightYears } from './about-app.constants';

describe('formatCopyrightYears', () => {
  it('returns the single start year in 2026', () => {
    expect(formatCopyrightYears(2026)).toBe('2026');
  });

  it('returns a range from 2026 to the current year after 2026', () => {
    expect(formatCopyrightYears(2028)).toBe('2026–2028');
  });

  it('never returns a range ending before the start year', () => {
    expect(formatCopyrightYears(2025)).toBe('2026');
  });
});

describe('about-app constants', () => {
  it('names the association as the copyright holder', () => {
    expect(COPYRIGHT_HOLDER).toBe('Associació Muixeranga de Barcelona');
  });

  it('points to the public GitHub repository', () => {
    expect(SOURCE_CODE_URL).toBe('https://github.com/MuixerangaBarcelonaCat/MuixerApp');
  });
});
