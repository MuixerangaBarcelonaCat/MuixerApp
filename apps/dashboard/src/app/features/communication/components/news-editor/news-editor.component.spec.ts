import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MarkdownEditorComponent } from '@muixer/ui/markdown-editor';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { News } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NewsEditorComponent } from './news-editor.component';
import { NewsService } from '../../services/news.service';
import { ToastService } from '@muixer/ui';
import { toDatetimeLocalValue } from '../../../../shared/utils';

const mockNews = (overrides: Partial<News> = {}): News => ({
  id: 'news-1',
  title: 'Nova temporada',
  body: 'Cos en **markdown**',
  publishedAt: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sendPush: false,
  pushSentAt: null,
  ...overrides,
});

describe('NewsEditorComponent', () => {
  let component: NewsEditorComponent;
  let fixture: ComponentFixture<NewsEditorComponent>;
  let newsService: {
    getOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const setup = async (routeId: string | null, loaded: News = mockNews()) => {
    newsService = {
      getOne: vi.fn().mockReturnValue(of(loaded)),
      create: vi.fn().mockReturnValue(of(mockNews())),
      update: vi.fn().mockReturnValue(of(mockNews())),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewsEditorComponent],
      providers: [
        { provide: NewsService, useValue: newsService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(routeId ? { id: routeId } : {}) } },
        },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // The editor is behind an `@defer (on immediate)`, so it lands a tick later.
    await fixture.whenStable();
    fixture.detectChanges();
  };

  describe('create mode (no route id)', () => {
    beforeEach(() => setup(null));

    it('does not load an existing news', () => {
      expect(newsService.getOne).not.toHaveBeenCalled();
      expect(component.isEditMode()).toBe(false);
    });

    it('disables save while title or body are empty', () => {
      expect(component.canSave()).toBe(false);
      component.title.set('Títol');
      expect(component.canSave()).toBe(false);
      component.body.set('Cos');
      expect(component.canSave()).toBe(true);
    });

    it('creates the news with publishedAt null when the datetime field is left blank', () => {
      component.title.set('Nova');
      component.body.set('Cos');
      component.save();

      expect(newsService.create).toHaveBeenCalledWith({ title: 'Nova', body: 'Cos', publishedAt: null, sendPush: true });
      expect(toast.success).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/communication/news']);
    });

    it('shows an error toast when creation fails', () => {
      newsService.create.mockReturnValue(throwError(() => ({ error: { message: 'Error' } })));
      component.title.set('Nova');
      component.body.set('Cos');
      component.save();

      expect(toast.error).toHaveBeenCalledWith('Error');
    });
  });

  describe('edit mode (route id present)', () => {
    beforeEach(() => setup('news-1'));

    it('loads the existing news into the form', () => {
      expect(newsService.getOne).toHaveBeenCalledWith('news-1');
      expect(component.isEditMode()).toBe(true);
      expect(component.title()).toBe('Nova temporada');
      expect(component.body()).toBe('Cos en **markdown**');
    });

    it('updates the news on save', () => {
      component.title.set('Actualitzat');
      component.save();

      expect(newsService.update).toHaveBeenCalledWith('news-1', {
        title: 'Actualitzat',
        body: 'Cos en **markdown**',
        publishedAt: null,
        sendPush: false,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/communication/news']);
    });
  });

  describe('publication mode', () => {
    const modeButton = (mode: string): HTMLButtonElement =>
      fixture.nativeElement.querySelector(`[data-testid="publish-mode-${mode}"] button`);
    const pick = (mode: string): void => {
      modeButton(mode).click();
      fixture.detectChanges();
    };
    const dateField = (): HTMLInputElement | null =>
      fixture.nativeElement.querySelector('#news-published-at');

    describe('create mode', () => {
      beforeEach(() => setup(null));

      it('starts on Esborrany', () => {
        expect(component.publishMode()).toBe('draft');
        // The design system marks a selected segment by swapping fill/outline, never with
        // `btn-active`, so the selection is asserted semantically instead.
        expect(modeButton('draft').getAttribute('aria-pressed')).toBe('true');
        expect(modeButton('now').getAttribute('aria-pressed')).toBe('false');
      });

      it('offers no date field until Programa is chosen', () => {
        expect(dateField()).toBeNull();

        pick('scheduled');
        expect(dateField()).not.toBeNull();

        pick('now');
        expect(dateField()).toBeNull();
      });

      it('saves a draft with no publication date', () => {
        component.title.set('Nova');
        component.body.set('Cos');
        component.save();

        expect(newsService.create).toHaveBeenCalledWith(
          expect.objectContaining({ publishedAt: null }),
        );
      });

      it('publishes immediately with the current instant', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-01T10:30:00.000Z'));

        component.title.set('Nova');
        component.body.set('Cos');
        pick('now');
        component.save();

        expect(newsService.create).toHaveBeenCalledWith(
          expect.objectContaining({ publishedAt: '2026-03-01T10:30:00.000Z' }),
        );
        vi.useRealTimers();
      });

      it('schedules for the chosen date', () => {
        component.title.set('Nova');
        component.body.set('Cos');
        pick('scheduled');
        component.publishedAtLocal.set('2026-01-01T10:30');
        component.save();

        expect(newsService.create).toHaveBeenCalledWith(
          expect.objectContaining({ publishedAt: new Date('2026-01-01T10:30').toISOString() }),
        );
      });

      it('cannot be saved as scheduled without a date', () => {
        component.title.set('Nova');
        component.body.set('Cos');
        expect(component.canSave()).toBe(true);

        pick('scheduled');
        expect(component.canSave()).toBe(false);

        component.publishedAtLocal.set('2026-01-01T10:30');
        expect(component.canSave()).toBe(true);
      });

      it('drops the old «Ara» shortcut, now covered by the Publica ara option', () => {
        expect(fixture.nativeElement.querySelector('[data-testid="publish-now-button"]')).toBeNull();
      });
    });

    describe('edit mode', () => {
      it('opens on Esborrany for an unpublished news', async () => {
        await setup('news-1');
        expect(component.publishMode()).toBe('draft');
      });

      // Keeping it on Programa with the original date is what preserves the publication
      // timestamp of an already-published news across an edit.
      it('opens on Programa with the stored date for a published news', async () => {
        await setup('news-1', mockNews({ publishedAt: '2026-02-01T09:00:00.000Z' }));

        expect(component.publishMode()).toBe('scheduled');
        expect(component.publishedAtLocal()).toBe(toDatetimeLocalValue('2026-02-01T09:00:00.000Z'));

        component.save();
        expect(newsService.update).toHaveBeenCalledWith(
          'news-1',
          expect.objectContaining({ publishedAt: '2026-02-01T09:00:00.000Z' }),
        );
      });
    });
  });

  describe('markdown body', () => {
    beforeEach(() => setup(null));

    it('edits the body through the WYSIWYG editor', () => {
      const editor = fixture.debugElement.query(By.directive(MarkdownEditorComponent));
      expect(editor).toBeTruthy();

      (editor.componentInstance as MarkdownEditorComponent).valueChange.emit('## Nou cos');

      expect(component.body()).toBe('## Nou cos');
    });

    it('seeds the editor with the stored markdown', () => {
      const editor = fixture.debugElement.query(By.directive(MarkdownEditorComponent));
      component.body.set('Porteu la **faixa**');
      fixture.detectChanges();

      expect((editor.componentInstance as MarkdownEditorComponent).value()).toBe('Porteu la **faixa**');
    });

    // Both were scaffolding around a raw-Markdown textarea: with a WYSIWYG the syntax is never
    // typed and the result is already on screen.
    it('no longer needs a syntax cheatsheet or a side-by-side preview', () => {
      expect(fixture.nativeElement.querySelector('[data-testid="markdown-help"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="news-preview"]')).toBeNull();
    });
  });

  describe('cancel', () => {
    beforeEach(() => setup(null));

    it('navigates back to the news list without saving', () => {
      component.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/communication/news']);
      expect(newsService.create).not.toHaveBeenCalled();
    });
  });
});
