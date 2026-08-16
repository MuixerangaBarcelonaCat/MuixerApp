import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { News } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NewsListComponent } from './news-list.component';
import { NewsService } from '../../services/news.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

const mockNews = (overrides: Partial<News> = {}): News => ({
  id: 'news-1',
  title: 'Nova temporada',
  body: 'Cos en **markdown**',
  publishedAt: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('NewsListComponent', () => {
  let component: NewsListComponent;
  let fixture: ComponentFixture<NewsListComponent>;
  let newsService: { getAll: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    newsService = {
      getAll: vi.fn().mockReturnValue(of([mockNews()])),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewsListComponent],
      providers: [
        { provide: NewsService, useValue: newsService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads news items on init', () => {
    expect(newsService.getAll).toHaveBeenCalledTimes(1);
    expect(component.newsItems().length).toBe(1);
  });

  it('derives DRAFT status for a news item with no publishedAt', () => {
    expect(component.formattedNewsItems()[0].statusLabel).toBe('Esborrany');
  });

  it('derives PUBLISHED status for a news item published in the past', () => {
    newsService.getAll.mockReturnValue(
      of([mockNews({ publishedAt: '2020-01-01T00:00:00.000Z' })]),
    );
    component.reload();
    expect(component.formattedNewsItems()[0].statusLabel).toBe('Publicada');
  });

  it('derives SCHEDULED status for a news item published in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    newsService.getAll.mockReturnValue(of([mockNews({ publishedAt: future })]));
    component.reload();
    expect(component.formattedNewsItems()[0].statusLabel).toBe('Programada');
  });

  it('confirms and executes delete successfully', () => {
    const target = mockNews();
    component.confirmDelete(target);
    component.executeDelete();
    expect(newsService.remove).toHaveBeenCalledWith('news-1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on delete failure', () => {
    newsService.remove.mockReturnValue(throwError(() => ({ error: { message: 'No es pot eliminar' } })));
    component.confirmDelete(mockNews());
    component.executeDelete();
    expect(toast.error).toHaveBeenCalledWith('No es pot eliminar');
  });

  it('cancels delete', () => {
    component.confirmDelete(mockNews());
    component.cancelDelete();
    expect(component.confirmDeleteTarget()).toBeNull();
  });
});
