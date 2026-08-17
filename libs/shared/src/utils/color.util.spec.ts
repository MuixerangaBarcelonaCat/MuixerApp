import { getContrastColor } from './color.util';

describe('getContrastColor', () => {
  it('returns black for a light background', () => {
    expect(getContrastColor('#FFFFFF')).toBe('#000000');
  });

  it('returns white for a dark background', () => {
    expect(getContrastColor('#000000')).toBe('#FFFFFF');
  });

  it('accepts a hex color without the leading #', () => {
    expect(getContrastColor('FFFFFF')).toBe('#000000');
  });
});
