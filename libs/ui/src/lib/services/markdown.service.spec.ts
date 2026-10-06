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

  it('strips script tags rather than trusting the stored markdown', () => {
    const html = service.render('Hola <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('returns an empty string for empty input', () => {
    expect(service.render('')).toBe('');
  });
});
