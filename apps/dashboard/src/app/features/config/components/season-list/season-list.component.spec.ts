import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Calendar,
  Home,
  Layers,
  Menu,
  Plus,
  Settings,
  Star,
  Users,
} from 'lucide-angular';
import { provideRouter } from '@angular/router';
import { SeasonListComponent } from './season-list.component';
import { SeasonService } from '../../../events/services/season.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { Season } from '../../../events/models/event.model';

const mockSeason = (overrides: Partial<Season> = {}): Season => ({
  id: 's1',
  name: 'Temporada 2025-2026',
  startDate: '2025-09-06',
  endDate: '2026-09-05',
  description: null,
  eventCount: 10,
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
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    seasonService = {
      getAll: vi.fn().mockReturnValue(of(mockResponse())),
      getCurrent: vi.fn().mockReturnValue(of(mockSeason())),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SeasonListComponent],
      providers: [
        { provide: SeasonService, useValue: seasonService },
        { provide: ToastService, useValue: toast },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useFactory: () =>
            new LucideIconProvider({
              Calendar,
              Home,
              Layers,
              Menu,
              Plus,
              Settings,
              Star,
              Users,
            }),
        },
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
});
