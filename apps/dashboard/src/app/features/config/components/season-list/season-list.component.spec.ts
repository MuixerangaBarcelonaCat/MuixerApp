import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { provideRouter } from '@angular/router';
import { SeasonListComponent } from './season-list.component';
import { SeasonService } from '../../../events/services/season.service';
import { ToastService } from '@muixer/ui';
import { Season } from '../../../events/models/event.model';

const mockSeason = (overrides: Partial<Season> = {}): Season => ({
  id: 's1',
  name: 'Temporada 2025-2026',
  startDate: '2025-09-06',
  endDate: '2026-09-05',
  description: null,
  eventCount: 10,
  rehearsalCount: 10,
  performanceCount: 0,
  ...overrides,
});

const mockResponse = (data: Season[] = [mockSeason()], total = 1) => ({
  data,
  meta: { total, page: 1, limit: 25 },
});

describe('SeasonListComponent', () => {
  let component: SeasonListComponent;
  let fixture: ComponentFixture<SeasonListComponent>;
  let seasonService: {
    getAll: ReturnType<typeof vi.fn>;
    getCurrent: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getUncoveredEventCount: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    seasonService = {
      getAll: vi.fn().mockReturnValue(of(mockResponse())),
      getCurrent: vi.fn().mockReturnValue(of(mockSeason())),
      remove: vi.fn().mockReturnValue(of(undefined)),
      getUncoveredEventCount: vi.fn().mockReturnValue(of({ count: 0 })),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SeasonListComponent],
      providers: [
        { provide: SeasonService, useValue: seasonService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads seasons on init', () => {
    expect(seasonService.getAll).toHaveBeenCalledTimes(1);
    expect(component.seasons().length).toBe(1);
  });

  it('loads current season on init', () => {
    expect(seasonService.getCurrent).toHaveBeenCalledTimes(1);
    expect(component.currentSeasonId()).toBe('s1');
  });

  it('marks current season in formatted list', () => {
    const formatted = component.formattedSeasons();
    expect(formatted[0].isCurrent).toBe(true);
  });

  it('opens create modal', () => {
    component.openCreateModal();
    expect(component.modalOpen()).toBe(true);
    expect(component.selectedSeason()).toBeNull();
  });

  it('opens edit modal with season', () => {
    const season = mockSeason();
    component.openEditModal(season);
    expect(component.modalOpen()).toBe(true);
    expect(component.selectedSeason()).toBe(season);
  });

  it('closes modal on saved', () => {
    component.modalOpen.set(true);
    component.onModalSaved();
    expect(component.modalOpen()).toBe(false);
    expect(seasonService.getAll).toHaveBeenCalledTimes(2);
  });

  it('executes delete successfully', () => {
    const target = mockSeason({ eventCount: 0 });
    component.confirmDelete(target);
    component.executeDelete();
    expect(seasonService.remove).toHaveBeenCalledWith('s1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows error toast on delete failure', () => {
    seasonService.remove.mockReturnValue(
      throwError(() => ({ error: { message: 'No es pot eliminar' } })),
    );
    const target = mockSeason({ eventCount: 5 });
    component.confirmDelete(target);
    component.executeDelete();
    expect(toast.error).toHaveBeenCalledWith('No es pot eliminar');
  });

  it('cancels delete', () => {
    component.confirmDelete(mockSeason());
    component.cancelDelete();
    expect(component.confirmDeleteTarget()).toBeNull();
  });

  describe('tap targets >=24px (WI-03, CF-L1)', () => {
    it('gives the event-count link a real >=24px tap target instead of the bare glyph height', () => {
      const link = fixture.nativeElement.querySelector('a.link') as HTMLElement;
      expect(link).toBeTruthy();
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('inline-flex');
    });
  });

  describe('event count links per type', () => {
    const rebuildWith = (season: Season) => {
      seasonService.getAll.mockReturnValue(of(mockResponse([season])));
      fixture = TestBed.createComponent(SeasonListComponent);
      fixture.detectChanges();
    };
    const links = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('td a')).map((a) => ({
        text: a.textContent?.trim(),
        href: a.getAttribute('href'),
      }));

    it('links each type to its own list, filtered by the season', () => {
      rebuildWith(mockSeason({ eventCount: 10, rehearsalCount: 8, performanceCount: 2 }));
      expect(links()).toEqual([
        { text: '8 assajos', href: '/rehearsals?seasonId=s1' },
        { text: '2 actuacions', href: '/performances?seasonId=s1' },
      ]);
    });

    it('uses the singular for a single event of a type', () => {
      rebuildWith(mockSeason({ eventCount: 2, rehearsalCount: 1, performanceCount: 1 }));
      expect(links().map((l) => l.text)).toEqual(['1 assaig', '1 actuació']);
    });

    it('leaves out a type with no events', () => {
      rebuildWith(mockSeason({ eventCount: 3, rehearsalCount: 0, performanceCount: 3 }));
      expect(links()).toEqual([{ text: '3 actuacions', href: '/performances?seasonId=s1' }]);
    });

    it('shows a plain 0 for a season with no events', () => {
      rebuildWith(mockSeason({ eventCount: 0, rehearsalCount: 0, performanceCount: 0 }));
      expect(links()).toEqual([]);
    });
  });

  describe('seasons derived from event dates', () => {
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    const rebuild = async () => {
      fixture = TestBed.createComponent(SeasonListComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    };

    it('labels the count column «Esdeveniments»', () => {
      const headers = [...fixture.nativeElement.querySelectorAll('th')].map((th: HTMLElement) => th.textContent?.trim());
      expect(headers).toContain('Esdeveniments');
      expect(headers).not.toContain('Events');
    });

    it('warns how many events fall in no season', async () => {
      seasonService.getUncoveredEventCount.mockReturnValue(of({ count: 4 }));
      await rebuild();
      expect(text()).toContain('Hi ha 4 esdeveniments que no estan dins de cap temporada.');
    });

    it('uses the singular for a single uncovered event', async () => {
      seasonService.getUncoveredEventCount.mockReturnValue(of({ count: 1 }));
      await rebuild();
      expect(text()).toContain('Hi ha 1 esdeveniment que no està dins de cap temporada.');
    });

    it('shows no warning when every event falls in a season', () => {
      expect(fixture.nativeElement.querySelector('lib-alert')).toBeNull();
    });

    it('explains that deleting a season with events leaves them without one', () => {
      component.confirmDelete(mockSeason({ eventCount: 10 }));
      fixture.detectChanges();
      expect(text()).toContain('Esteu segur que voleu eliminar');
      expect(text()).toContain("Hi ha 10 esdeveniments en esta temporada. Si l'elimineu, quedaran sense temporada.");
    });

    it('deletes a season with events once confirmed, allowing them to be left uncovered', () => {
      component.confirmDelete(mockSeason({ eventCount: 10 }));
      component.executeDelete();
      expect(seasonService.remove).toHaveBeenCalledWith('s1', { allowUncovered: true });
    });

    it('refreshes the uncovered count after a delete and after a save', () => {
      seasonService.getUncoveredEventCount.mockClear();
      component.confirmDelete(mockSeason({ eventCount: 10 }));
      component.executeDelete();
      component.onModalSaved();
      expect(seasonService.getUncoveredEventCount).toHaveBeenCalledTimes(2);
    });
  });
});
