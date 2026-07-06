import { describe, it, expect } from 'vitest';
import { fitFontSize } from './fit-font-size.util';

describe('fitFontSize', () => {
  it('returns max font size when single-line text fits at max', () => {
    const result = fitFontSize(18, 5, 100, 50, 'none', (fs) => ({ width: 80, height: fs }));
    expect(result).toBe(18);
  });

  it('shrinks font size until multiline text height fits in the box', () => {
    // text has 3 lines; height = 3 * fontSize; box is 30px tall
    const result = fitFontSize(18, 5, 100, 30, 'word', (fs) => ({ width: 60, height: fs * 3 }));
    expect(result).toBeLessThan(18);
    expect(result * 3).toBeLessThanOrEqual(30);
  });

  it('returns minFontSize when no size fits', () => {
    // 10 lines, even at fontSize 5 height is 50 > 20
    const result = fitFontSize(18, 5, 100, 20, 'word', (fs) => ({ width: 60, height: fs * 10 }));
    expect(result).toBe(5);
  });

  it('in word-wrap mode, does not check width', () => {
    // text is very wide but word-wrapped — width should be ignored
    const result = fitFontSize(18, 5, 100, 50, 'word', (fs) => ({ width: 9999, height: fs }));
    expect(result).toBe(18);
  });

  it('in non-wrap mode, shrinks when text is wider than box', () => {
    // text too wide for box at large sizes; each line shrinks proportionally
    const result = fitFontSize(18, 5, 100, 50, 'none', (fs) => ({ width: fs * 8, height: fs }));
    // at fs=12: width=96 <= 100, height=12 <= 50 → should fit
    expect(result).toBe(12.5);
  });
});
