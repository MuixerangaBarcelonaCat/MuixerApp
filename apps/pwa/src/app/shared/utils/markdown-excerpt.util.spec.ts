import { markdownExcerpt } from './markdown-excerpt.util';

describe('markdownExcerpt', () => {
  it('strips markdown syntax to plain text', () => {
    expect(markdownExcerpt('Cos amb **negreta** i [enllaç](https://x.cat)', 200)).toBe(
      'Cos amb negreta i enllaç',
    );
  });

  it('returns the full text unchanged when shorter than the limit', () => {
    expect(markdownExcerpt('Text curt', 200)).toBe('Text curt');
  });

  it('truncates to the given character count and appends an ellipsis', () => {
    const longText = 'a'.repeat(300);
    expect(markdownExcerpt(longText, 200)).toBe(`${'a'.repeat(200)}…`);
  });

  it('collapses multiple blank lines/paragraphs into single spaces', () => {
    expect(markdownExcerpt('Primer paràgraf.\n\nSegon paràgraf.', 200)).toBe(
      'Primer paràgraf. Segon paràgraf.',
    );
  });
});
