import { titleCaseName } from './title-case-name';

describe('titleCaseName', () => {
  it('title-cases an all-caps name', () => {
    expect(titleCaseName('PERSIANA')).toBe('Persiana');
  });

  it('capitalises every word, including after hyphens and apostrophes', () => {
    expect(titleCaseName('MARIA JOSEP')).toBe('Maria Josep');
    expect(titleCaseName('JOAN-MARC')).toBe('Joan-Marc');
    expect(titleCaseName("D'ALÒS")).toBe("D'Alòs");
    expect(titleCaseName('N’ANDREU')).toBe('N’Andreu');
  });

  it('handles Catalan letters and the l·l middle dot', () => {
    expect(titleCaseName('CÈLIA')).toBe('Cèlia');
    expect(titleCaseName('MARCEL·LA')).toBe('Marcel·la');
  });

  it('leaves text in brackets untouched (direction markers, climb indicators)', () => {
    expect(titleCaseName('AINA (X)')).toBe('Aina (X)');
    expect(titleCaseName('PEP (ENXANETA)')).toBe('Pep (ENXANETA)');
  });

  it('leaves names that already have lower-case letters as they were typed', () => {
    expect(titleCaseName('MariaJo')).toBe('MariaJo');
    expect(titleCaseName('Quim (X)')).toBe('Quim (X)');
  });

  it('leaves placeholders and empty strings alone', () => {
    expect(titleCaseName('?')).toBe('?');
    expect(titleCaseName('')).toBe('');
  });
});
