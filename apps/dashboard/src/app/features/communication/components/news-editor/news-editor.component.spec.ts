import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { News } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NewsEditorComponent } from './news-editor.component';
import { NewsService } from '../../services/news.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
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

  const setup = async (routeId: string | null) => {
    newsService = {
      getOne: vi.fn().mockReturnValue(of(mockNews())),
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

      expect(newsService.create).toHaveBeenCalledWith({ title: 'Nova', body: 'Cos', publishedAt: null, sendPush: false });
      expect(toast.success).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/communication/news']);
    });

    it('creates the news with a parsed ISO publishedAt when scheduled', () => {
      component.title.set('Nova');
      component.body.set('Cos');
      component.publishedAtLocal.set('2026-01-01T10:30');
      component.save();

      expect(newsService.create).toHaveBeenCalledWith({
        title: 'Nova',
        body: 'Cos',
        publishedAt: new Date('2026-01-01T10:30').toISOString(),
        sendPush: false,
      });
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

  describe('statusLabel', () => {
    beforeEach(() => setup(null));

    it('shows Esborrany when the datetime field is blank', () => {
      expect(component.statusLabel()).toBe('Esborrany');
    });

    it('shows Programada when the datetime field is in the future', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      component.publishedAtLocal.set(toDatetimeLocalValue(future.toISOString()));
      expect(component.statusLabel()).toBe('Programada');
    });

    it('shows Immediata (not Publicada) when the datetime field is in the past', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      component.publishedAtLocal.set(toDatetimeLocalValue(past.toISOString()));
      expect(component.statusLabel()).toBe('Immediata');
    });
  });

  describe('setPublishNow', () => {
    beforeEach(() => setup(null));

    afterEach(() => vi.useRealTimers());

    it('sets publishedAtLocal to the current local date and time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 10, 30));

      component.setPublishNow();

      expect(component.publishedAtLocal()).toBe('2026-01-01T10:30');
    });

    it('is wired to a button in the template', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 10, 30));

      const button = fixture.nativeElement.querySelector('[data-testid="publish-now-button"]') as HTMLButtonElement;
      expect(button).toBeTruthy();
      button.click();
      fixture.detectChanges();

      expect(component.publishedAtLocal()).toBe('2026-01-01T10:30');
    });
  });

  describe('markdown help tooltip', () => {
    beforeEach(() => setup(null));

    it('shows bold, italic and link syntax examples', () => {
      const help = fixture.nativeElement.querySelector('[data-testid="markdown-help"]') as HTMLElement;
      expect(help).toBeTruthy();
      expect(help.textContent).toContain('**negreta**');
      expect(help.textContent).toContain('*cursiva*');
      expect(help.textContent).toContain('[text](url)');
    });
  });

  describe('markdown preview', () => {
    beforeEach(() => setup(null));

    it('renders sanitized HTML from the markdown body', () => {
      component.body.set('**bold text**');
      expect(component.previewHtml()).toContain('<strong>bold text</strong>');
    });

    it('renders a clickable link with a working href from markdown link syntax', () => {
      component.body.set('[Muixeranga](https://muixeranga.cat)');
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('[data-testid="news-preview"]') as HTMLElement;
      const link = preview.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('https://muixeranga.cat');
    });

    it('opens preview links in a new tab so clicking one does not navigate away from the unsaved editor', () => {
      component.body.set('[Muixeranga](https://muixeranga.cat)');
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('[data-testid="news-preview"]') as HTMLElement;
      const link = preview.querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders preview links underlined so they are recognizable as links', () => {
      component.body.set('[Muixeranga](https://muixeranga.cat)');
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('[data-testid="news-preview"]') as HTMLElement;
      const link = preview.querySelector('a');
      expect(link?.className).toContain('underline');
    });

    it('shows the current title above the rendered preview', () => {
      component.title.set('Nova temporada');
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('[data-testid="news-preview"]') as HTMLElement;
      expect(preview.textContent).toContain('Nova temporada');
    });

    it('renders the title in bold', () => {
      component.title.set('Nova temporada');
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('[data-testid="news-preview"]') as HTMLElement;
      const titleEl = preview.querySelector('[data-testid="news-preview-title"]') as HTMLElement;
      expect(titleEl).toBeTruthy();
      expect(titleEl.className).toContain('font-bold');
    });

    it('updates the previewed title as the title field changes', () => {
      component.title.set('Primer títol');
      fixture.detectChanges();
      component.title.set('Títol actualitzat');
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('[data-testid="news-preview"]') as HTMLElement;
      expect(preview.textContent).toContain('Títol actualitzat');
      expect(preview.textContent).not.toContain('Primer títol');
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
