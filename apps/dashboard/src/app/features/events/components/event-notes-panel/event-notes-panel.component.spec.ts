import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { ToastService } from '@muixer/ui';
import { MarkdownEditorComponent } from '@muixer/ui/markdown-editor';
import { EventService } from '../../services/event.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import {
  EventNotesPanelComponent,
  NOTES_EXPANDED_STORAGE_KEY,
} from './event-notes-panel.component';

describe('EventNotesPanelComponent', () => {
  let fixture: ComponentFixture<EventNotesPanelComponent>;
  let updateFull: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;

  const setup = async (notes: string | null = null): Promise<void> => {
    updateFull = vi.fn().mockReturnValue(of({}));
    toastSuccess = vi.fn();

    await TestBed.configureTestingModule({
      imports: [EventNotesPanelComponent],
      providers: [
        allLucideIconsProvider,
        { provide: EventService, useValue: { updateFull } },
        { provide: ToastService, useValue: { success: toastSuccess, error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventNotesPanelComponent);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentRef.setInput('notes', notes);
    fixture.detectChanges();
    // The editor sits behind an `@defer (on immediate)`, so it arrives a tick after the body does.
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const toggle = (): HTMLButtonElement =>
    fixture.debugElement.query(By.css('[data-testid="event-notes-toggle"]')).nativeElement;

  const expand = async (): Promise<void> => {
    toggle().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const editorDebug = () => fixture.debugElement.query(By.directive(MarkdownEditorComponent));
  const editorText = (): string =>
    fixture.debugElement.query(By.css('.ProseMirror')).nativeElement.textContent;
  const editorHtml = (): string =>
    fixture.debugElement.query(By.css('.ProseMirror')).nativeElement.innerHTML;

  const clickButton = (testId: string): void => {
    fixture.debugElement.query(By.css(`[data-testid="${testId}"] button`)).nativeElement.click();
    fixture.detectChanges();
  };

  /**
   * The panel's contract with the editor is its `valueChange` output — how the text got typed is
   * the editor's own concern, and covered by its spec.
   */
  const editInEditor = (markdown: string): void => {
    (editorDebug().componentInstance as MarkdownEditorComponent).valueChange.emit(markdown);
    fixture.detectChanges();
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('collapsing', () => {
    it('starts collapsed when nothing is stored', async () => {
      await setup('Notes');
      expect(editorDebug()).toBeNull();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
    });

    it('expands on toggle and persists the state', async () => {
      await setup();
      await expand();

      expect(editorDebug()).not.toBeNull();
      expect(localStorage.getItem(NOTES_EXPANDED_STORAGE_KEY)).toBe('true');
    });

    it('starts expanded when the stored state says so', async () => {
      localStorage.setItem(NOTES_EXPANDED_STORAGE_KEY, 'true');
      await setup();
      expect(editorDebug()).not.toBeNull();
    });

    it('reveals nothing of the notes while collapsed', async () => {
      await setup('Primera línia\nSegona línia');
      expect(toggle().textContent).toContain('Notes');
      expect(toggle().textContent).not.toContain('Primera línia');
    });
  });

  describe('editing', () => {
    beforeEach(() => localStorage.setItem(NOTES_EXPANDED_STORAGE_KEY, 'true'));

    it('seeds the editor with the current notes', async () => {
      await setup('Text existent');
      expect(editorText()).toContain('Text existent');
    });

    it('renders stored markdown as rich text rather than syntax', async () => {
      await setup('Porteu la **faixa** nova');
      expect(editorHtml()).toContain('<strong>faixa</strong>');
      expect(editorText()).not.toContain('**');
    });

    it('keeps the save button disabled until the text changes', async () => {
      await setup('Text existent');
      const save = fixture.debugElement.query(By.css('[data-testid="event-notes-save"] button'))
        .nativeElement as HTMLButtonElement;
      expect(save.disabled).toBe(true);

      editInEditor('Text nou');
      expect(save.disabled).toBe(false);
    });

    it('sends the new markdown to the API and emits it', async () => {
      await setup('Antic');
      const emitted: (string | null)[] = [];
      fixture.componentInstance.saved.subscribe((v) => emitted.push(v));

      editInEditor('## Nou');
      clickButton('event-notes-save');

      expect(updateFull).toHaveBeenCalledWith('event-1', { notes: '## Nou' });
      expect(emitted).toEqual(['## Nou']);
      expect(toastSuccess).toHaveBeenCalled();
    });

    it('sends null when the text is cleared, so the field is emptied', async () => {
      await setup('Antic');

      editInEditor('   ');
      clickButton('event-notes-save');

      expect(updateFull).toHaveBeenCalledWith('event-1', { notes: null });
    });

    it('restores the original text on cancel', async () => {
      await setup('Antic');

      editInEditor('Esborrany descartat');
      clickButton('event-notes-cancel');

      expect(editorText()).toContain('Antic');
      expect(updateFull).not.toHaveBeenCalled();
    });

    it('shows an error when the save fails and keeps the draft', async () => {
      await setup('Antic');
      updateFull.mockReturnValue(throwError(() => new Error('boom')));

      editInEditor('Nou');
      clickButton('event-notes-save');

      expect(fixture.debugElement.query(By.css('lib-alert'))).not.toBeNull();
      expect(editorText()).toContain('Nou');
    });
  });
});
