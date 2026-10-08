import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownViewComponent } from './markdown-view.component';

describe('MarkdownViewComponent', () => {
  let fixture: ComponentFixture<MarkdownViewComponent>;

  const render = (content: string | null) => {
    fixture.componentRef.setInput('content', content);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MarkdownViewComponent] });
    fixture = TestBed.createComponent(MarkdownViewComponent);
  });

  it('renders Markdown as typeset markup', () => {
    const el = render('## Dades\n\n- nom\n- correu');

    expect(el.querySelector('.prose h2')?.textContent).toBe('Dades');
    expect(el.querySelectorAll('.prose li')).toHaveLength(2);
  });

  it('keeps plain text with no Markdown readable, paragraph by paragraph', () => {
    const el = render('Primer paràgraf.\n\nSegon paràgraf.');

    expect(Array.from(el.querySelectorAll('p')).map((p) => p.textContent)).toEqual([
      'Primer paràgraf.',
      'Segon paràgraf.',
    ]);
  });

  it('drops scripts from the content', () => {
    const el = render('Text<script>alert(1)</script>');

    expect(el.querySelector('script')).toBeNull();
  });

  it('renders nothing for empty content', () => {
    expect(render(null).textContent?.trim()).toBe('');
  });
});
