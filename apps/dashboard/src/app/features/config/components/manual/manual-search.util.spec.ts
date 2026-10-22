import { buildManualIndex, normalizeText, searchManual } from './manual-search.util';

const pages = [
  { slug: '03-persones', title: 'Persones', markdown: '# Persones\n\n## Alta\n\nAfegiu una **persona** nova amb el botó «Nova».' },
  { slug: '07-assajos', title: 'Assajos', markdown: '# Assajos\n\n## Assistència\n\nLes respostes d\'assistència es veuen al detall.' },
];

describe('manual search', () => {
  it('normalizes accents and case', () => {
    expect(normalizeText('Assistència')).toBe('assistencia');
  });

  it('finds a page ignoring accents and returns a snippet around the match', () => {
    const [hit] = searchManual(buildManualIndex(pages), 'ASSISTENCIA');
    expect(hit.slug).toBe('07-assajos');
    expect(hit.snippet).toContain('assistència');
  });

  it('ranks title matches before body matches', () => {
    const hits = searchManual(buildManualIndex(pages), 'persona');
    expect(hits.map((h) => h.slug)).toEqual(['03-persones']);
  });

  it('returns nothing for queries shorter than 2 characters', () => {
    expect(searchManual(buildManualIndex(pages), 'a')).toEqual([]);
  });

  it('strips markdown syntax from snippets', () => {
    const [hit] = searchManual(buildManualIndex(pages), 'nova');
    expect(hit.snippet).not.toMatch(/[*#«]/);
  });
});
