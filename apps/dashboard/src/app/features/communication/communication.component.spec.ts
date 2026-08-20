import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { News } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { CommunicationComponent } from './communication.component';
import { NewsService } from './services/news.service';
import { ToastService } from '@muixer/ui';

const mockNews = (overrides: Partial<News> = {}): News => ({
  id: 'news-1',
  title: 'Nova temporada',
  body: 'Cos',
  publishedAt: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sendPush: false,
  pushSentAt: null,
  ...overrides,
});

describe('CommunicationComponent', () => {
  let component: CommunicationComponent;
  let fixture: ComponentFixture<CommunicationComponent>;
  let newsService: { getAll: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn> };

  const setup = async (items: News[]) => {
    newsService = { getAll: vi.fn().mockReturnValue(of(items)) };
    toast = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommunicationComponent],
      providers: [
        { provide: NewsService, useValue: newsService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('counts published, scheduled and draft news separately', async () => {
    const past = '2020-01-01T00:00:00.000Z';
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await setup([
      mockNews({ id: '1', publishedAt: past }),
      mockNews({ id: '2', publishedAt: past }),
      mockNews({ id: '3', publishedAt: future }),
      mockNews({ id: '4', publishedAt: null }),
    ]);

    expect(component.newsCounts()).toEqual({ published: 2, scheduled: 1, draft: 1 });
  });

  it('lists the most recent published news first, capped at 3', async () => {
    await setup([
      mockNews({ id: '1', title: 'Primera', publishedAt: '2026-01-01T00:00:00.000Z' }),
      mockNews({ id: '2', title: 'Segona', publishedAt: '2026-01-03T00:00:00.000Z' }),
      mockNews({ id: '3', title: 'Tercera', publishedAt: '2026-01-02T00:00:00.000Z' }),
      mockNews({ id: '4', title: 'Quarta', publishedAt: '2026-01-04T00:00:00.000Z' }),
    ]);

    expect(component.recentPublished().map((n) => n.title)).toEqual(['Quarta', 'Segona', 'Tercera']);
  });

  it('excludes drafts and scheduled news from the recent published list', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await setup([
      mockNews({ id: '1', title: 'Esborrany', publishedAt: null }),
      mockNews({ id: '2', title: 'Programada', publishedAt: future }),
    ]);

    expect(component.recentPublished()).toEqual([]);
  });

  it('lists the soonest upcoming scheduled news first, capped at 3', async () => {
    const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
    await setup([
      mockNews({ id: '1', title: 'En 5 dies', publishedAt: inDays(5) }),
      mockNews({ id: '2', title: 'Demà', publishedAt: inDays(1) }),
      mockNews({ id: '3', title: 'En 3 dies', publishedAt: inDays(3) }),
      mockNews({ id: '4', title: 'En 10 dies', publishedAt: inDays(10) }),
    ]);

    expect(component.upcomingScheduled().map((n) => n.title)).toEqual(['Demà', 'En 3 dies', 'En 5 dies']);
  });

  it('excludes drafts and published news from the upcoming scheduled list', async () => {
    const past = '2020-01-01T00:00:00.000Z';
    await setup([
      mockNews({ id: '1', title: 'Esborrany', publishedAt: null }),
      mockNews({ id: '2', title: 'Publicada', publishedAt: past }),
    ]);

    expect(component.upcomingScheduled()).toEqual([]);
  });

  it('shows an error toast when loading news fails', async () => {
    newsService = { getAll: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) };
    toast = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommunicationComponent],
      providers: [
        { provide: NewsService, useValue: newsService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunicationComponent);
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
  });
});
