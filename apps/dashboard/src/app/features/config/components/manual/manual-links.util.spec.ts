import { manualSlugFromHref, rewriteManualImages } from './manual-links.util';

describe('rewriteManualImages', () => {
  it('prefixes relative img paths', () =>
    expect(rewriteManualImages('<img src="img/03-persones-llista.png" alt="x">')).toBe(
      '<img src="/manual/img/03-persones-llista.png" alt="x">',
    ));

  it('handles ./img', () =>
    expect(rewriteManualImages('<img src="./img/a.png">')).toBe('<img src="/manual/img/a.png">'));

  it('leaves absolute urls alone', () =>
    expect(rewriteManualImages('<img src="https://x/img/a.png">')).toBe(
      '<img src="https://x/img/a.png">',
    ));
});

describe('manualSlugFromHref', () => {
  it.each([
    ['04-etiquetes.md', '04-etiquetes'],
    ['./04-etiquetes.md', '04-etiquetes'],
    ['04-etiquetes.md#categories', '04-etiquetes'],
  ])('%s → %s', (href, slug) => expect(manualSlugFromHref(href)).toBe(slug));

  it.each(['https://example.com/a.md', 'mailto:a@b.c', '/config', null, 'img/a.png'])(
    'returns null for %s',
    (href) => expect(manualSlugFromHref(href)).toBeNull(),
  );
});
