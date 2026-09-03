import { normalizeForSearch, matchesSearch } from './text-search.util';

describe('normalizeForSearch', () => {
  it('lowercases the value', () => {
    expect(normalizeForSearch('Marta')).toBe('marta');
  });

  it('strips accents', () => {
    expect(normalizeForSearch('Àngela')).toBe('angela');
  });

  it('strips accents and lowercases together', () => {
    expect(normalizeForSearch('ÒSCAR')).toBe('oscar');
  });

  it('leaves plain ASCII untouched other than case', () => {
    expect(normalizeForSearch('Joan Pere')).toBe('joan pere');
  });

  it('handles every valencià/català accented vowel, plus ç and ñ', () => {
    expect(normalizeForSearch('àáèéêíïòóôúüçñ')).toBe('aaeeeiiooouucn');
  });
});

describe('matchesSearch', () => {
  it('matches a plain substring', () => {
    expect(matchesSearch('Marta Puig', 'Puig')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(matchesSearch('Marta Puig', 'puig')).toBe(true);
  });

  it('matches an unaccented query against an accented value', () => {
    expect(matchesSearch('Àngela', 'angela')).toBe(true);
  });

  it('matches an accented query against an unaccented value', () => {
    expect(matchesSearch('Angela', 'àngela')).toBe(true);
  });

  it('does not match an unrelated string', () => {
    expect(matchesSearch('Marta Puig', 'Ferrer')).toBe(false);
  });

  it('treats an empty query as matching everything', () => {
    expect(matchesSearch('Marta Puig', '')).toBe(true);
    expect(matchesSearch('Marta Puig', '   ')).toBe(true);
  });
});
