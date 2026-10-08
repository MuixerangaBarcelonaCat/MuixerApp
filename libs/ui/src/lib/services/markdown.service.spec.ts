import { TestBed } from '@angular/core/testing';
import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let service: MarkdownService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MarkdownService);
  });

  it('renders emphasis as markup', () => {
    expect(service.render('Porteu la **faixa**')).toContain('<strong>faixa</strong>');
  });

  it('renders a bullet list', () => {
    const html = service.render('- un\n- dos');
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)).toHaveLength(2);
  });

  it('renders headings', () => {
    expect(service.render('## Convocatoria')).toContain('<h2>Convocatoria</h2>');
  });

  // Angular's sanitizer re-serializes the parsed DOM and escapes everything outside ASCII.
  // The rendered result is identical; it only looks different as a string.
  it('escapes accented characters as numeric entities', () => {
    expect(service.render('## Convocatòria')).toContain('Convocat&#242;ria');
  });

  it('opens links in a new tab without leaking the opener', () => {
    const html = service.render('[exemple](https://exemple.cat)');
    expect(html).toContain('href="https://exemple.cat"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  describe('link attributes', () => {
    // Read back through the DOM: what matters is what the browser makes of the markup, and the
    // sanitizer re-serializes it anyway.
    const firstLink = (markdown: string): HTMLAnchorElement => {
      const container = document.createElement('div');
      container.innerHTML = service.render(markdown);
      return container.querySelector('a') as HTMLAnchorElement;
    };

    it('keeps a quoted title inside its own attribute', () => {
      const link = firstLink('[a](https://exemple.cat "Diu \\"hola\\"")');
      expect(link.getAttribute('title')).toBe('Diu "hola"');
      expect(link.getAttribute('href')).toBe('https://exemple.cat');
    });

    it('keeps a quote in the URL from ending the href early', () => {
      expect(firstLink('[a](<https://exemple.cat/a"b>)').getAttribute('href')).toBe('https://exemple.cat/a%22b');
    });

    // The browser keeps the first of two repeated attributes, so markup smuggled in through the
    // title would win over the renderer's own `target` and navigate the PWA shell away.
    it('cannot be talked out of opening in a new tab through the title', () => {
      const link = firstLink('[a](https://exemple.cat "x\\" target=\\"_self\\" rel=\\"opener")');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('title')).toBe('x" target="_self" rel="opener');
    });

    it('keeps the underline and any inline markup in the link text', () => {
      const link = firstLink('[**faixa**](https://exemple.cat)');
      expect(link.classList).toContain('underline');
      expect(link.innerHTML).toBe('<strong>faixa</strong>');
    });
  });

  it('strips script tags rather than trusting the stored markdown', () => {
    const html = service.render('Hola <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('returns an empty string for empty input', () => {
    expect(service.render('')).toBe('');
  });
});
