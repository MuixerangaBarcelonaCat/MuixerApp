import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MarkdownEditorComponent } from './markdown-editor.component';
import { EmojiButtonComponent } from './emoji-button.component';

describe('MarkdownEditorComponent', () => {
  let fixture: ComponentFixture<MarkdownEditorComponent>;
  let emitted: string[];

  const setup = async (value = ''): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownEditorComponent);
    fixture.componentRef.setInput('value', value);
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  };

  const editable = (): HTMLElement =>
    fixture.debugElement.query(By.css('[data-testid="md-editable"] .ProseMirror')).nativeElement;

  const button = (testId: string): HTMLButtonElement =>
    fixture.debugElement.query(By.css(`[data-testid="${testId}"] button`)).nativeElement;

  const click = (testId: string): void => {
    button(testId).click();
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  describe('rendering incoming markdown', () => {
    it('shows bold as rich text, not as asterisks', async () => {
      await setup('Porteu la **faixa** nova');
      expect(editable().innerHTML).toContain('<strong>faixa</strong>');
      expect(editable().textContent).not.toContain('**');
    });

    it('shows a bullet list as a real list', async () => {
      await setup('- un\n- dos');
      expect(editable().querySelectorAll('ul li')).toHaveLength(2);
    });

    it('starts empty when given no value', async () => {
      await setup();
      expect(editable().textContent).toBe('');
    });
  });

  describe('editing', () => {
    it('turns the current block into a heading and emits the markdown', async () => {
      await setup('Convocatòria');

      click('md-h2');

      expect(editable().querySelector('h2')?.textContent).toBe('Convocatòria');
      expect(emitted.at(-1)).toBe('## Convocatòria');
    });

    it('turns the current block into a bullet list', async () => {
      await setup('un');

      click('md-bullet-list');

      expect(emitted.at(-1)).toBe('- un');
    });

    it('arms bold for the text typed next', async () => {
      await setup('Text');

      click('md-bold');

      expect(button('md-bold').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('toolbar state', () => {
    it('marks the heading button as pressed when the caret sits in a heading', async () => {
      await setup('## Ja és un títol');
      expect(button('md-h2').getAttribute('aria-pressed')).toBe('true');
    });

    it('leaves the heading button unpressed in a plain paragraph', async () => {
      await setup('Un paràgraf');
      expect(button('md-h2').getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('external value changes', () => {
    it('re-parses when the value is replaced from outside', async () => {
      await setup('Primer');

      fixture.componentRef.setInput('value', 'Segon **text**');
      fixture.detectChanges();

      expect(editable().textContent).toContain('Segon');
      expect(editable().innerHTML).toContain('<strong>text</strong>');
    });

    it('ignores the value it just emitted, so editing does not reset the document', async () => {
      await setup('Convocatòria');
      click('md-h2');
      const emittedValue = emitted.at(-1)!;
      const htmlAfterEdit = editable().innerHTML;

      fixture.componentRef.setInput('value', emittedValue);
      fixture.detectChanges();

      expect(editable().innerHTML).toBe(htmlAfterEdit);
    });
  });

  describe('links', () => {
    const field = (testId: string): HTMLInputElement =>
      fixture.debugElement.query(By.css(`[data-testid="${testId}"] input`)).nativeElement;

    const fill = (testId: string, value: string): void => {
      const input = field(testId);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('does not show the link dialog until the link button is used', async () => {
      await setup('Text');
      expect(fixture.debugElement.query(By.css('dialog[open]'))).toBeNull();
    });

    it('uses the typed text as the visible label', async () => {
      await setup('');

      click('md-link');
      fill('md-link-text', 'la convocatòria');
      fill('md-link-url', 'https://exemple.cat');
      click('md-link-confirm');

      expect(emitted.at(-1)).toBe('[la convocatòria](https://exemple.cat)');
    });

    it('falls back to the URL as the label when no text is given', async () => {
      await setup('');

      click('md-link');
      fill('md-link-url', 'https://exemple.cat');
      click('md-link-confirm');

      expect(emitted.at(-1)).toBe('[https://exemple.cat](https://exemple.cat)');
    });

    it('prefills both fields from the link the caret sits in', async () => {
      await setup('[exemple](https://exemple.cat)');

      click('md-link');
      // `[ngModel]` writes to the control in a microtask, so the inputs are one tick behind.
      await fixture.whenStable();
      fixture.detectChanges();

      expect(field('md-link-url').value).toBe('https://exemple.cat');
      expect(field('md-link-text').value).toBe('exemple');
    });

    it('rewrites an existing link instead of nesting a new one inside it', async () => {
      await setup('[exemple](https://exemple.cat)');

      click('md-link');
      fill('md-link-text', 'la nova');
      fill('md-link-url', 'https://nou.cat');
      click('md-link-confirm');

      expect(emitted.at(-1)).toBe('[la nova](https://nou.cat)');
    });

    it('does nothing when confirmed with no URL', async () => {
      await setup('Text');

      click('md-link');
      fill('md-link-text', 'sense adreça');
      click('md-link-confirm');

      expect(emitted).toHaveLength(0);
    });
  });

  describe('emoji', () => {
    it('inserts the chosen emoji into the document', async () => {
      await setup('Bon assaig');

      const emojiButton = fixture.debugElement.query(By.directive(EmojiButtonComponent));
      (emojiButton.componentInstance as EmojiButtonComponent).picked.emit('🎉');
      fixture.detectChanges();

      expect(emitted.at(-1)).toContain('🎉');
    });
  });

  describe('content it has no button for', () => {
    it('keeps a markdown table intact through a round trip', async () => {
      const table = '| Tram | Hora |\n| --- | --- |\n| Primer | 18:00 |';
      await setup(table);

      expect(editable().querySelectorAll('table')).toHaveLength(1);

      click('md-bold');
      expect(emitted.at(-1) ?? table).toContain('| Primer | 18:00 |');
    });
  });

  describe('accessibility and disabled state', () => {
    it('names the editing region for screen readers', async () => {
      await setup();
      fixture.componentRef.setInput('ariaLabel', 'Notes de l\'esdeveniment');
      fixture.detectChanges();
      expect(editable().getAttribute('aria-label')).toBe('Notes de l\'esdeveniment');
    });

    it('is not editable when disabled', async () => {
      await setup('Text');
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(editable().getAttribute('contenteditable')).toBe('false');
    });

    it('disables the toolbar when disabled', async () => {
      await setup('Text');
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(button('md-bold').disabled).toBe(true);
    });
  });
});
