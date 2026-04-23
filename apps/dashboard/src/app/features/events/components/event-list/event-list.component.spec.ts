import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS, LucideIconProvider,
  AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown, ChevronUp,
  ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
  MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
} from 'lucide-angular';
import { EventListComponent, ALL_EVENT_COLUMNS } from './event-list.component';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { EventType } from '@muixer/shared';
import { Season } from '../../models/event.model';

const makeSeasons = (): Season[] => [
  {
    id: 'season-active',
    name: 'Temporada 2025-2026',
    startDate: '2025-09-01',
    endDate: '2026-08-31',
    description: null,
    eventCount: 10,
  },
  {
    id: 'season-old',
    name: 'Temporada 2024-2025',
    startDate: '2024-09-01',
    endDate: '2025-08-31',
    description: null,
    eventCount: 20,
  },
];

const makePaginatedEmpty = () => ({ data: [], meta: { total: 0, page: 1, limit: 25 } });

describe('EventListComponent', () => {
  let fixture: ComponentFixture<EventListComponent>;
  let component: EventListComponent;
  let eventService: { getAll: ReturnType<typeof vi.fn> };
  let seasonService: { getAll: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const mockActivatedRoute = {
    snapshot: { data: { eventType: EventType.ASSAIG } },
  };

  beforeEach(async () => {
    localStorage.clear();
    eventService = { getAll: vi.fn().mockReturnValue(of(makePaginatedEmpty())) };
    seasonService = {
      getAll: vi.fn().mockReturnValue(
        of({ data: makeSeasons(), meta: { total: 2, page: 1, limit: 25 } }),
      ),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: SeasonService, useValue: seasonService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: router },
        {
          provide: LUCIDE_ICONS, multi: true,
          useFactory: () => new LucideIconProvider({
            AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown, ChevronUp,
            ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
            MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initialization', () => {
    it('reads eventType from route data', () => {
      expect(component.eventType()).toBe(EventType.ASSAIG);
    });

    it('sets page title to Assajos for ASSAIG', () => {
      expect(component.pageTitle()).toBe('Assajos');
    });

    it('loads seasons on init', () => {
      expect(seasonService.getAll).toHaveBeenCalledTimes(1);
    });

    it('loads events on init', () => {
      expect(eventService.getAll).toHaveBeenCalled();
    });
  });

  describe('active season auto-selection', () => {
    it('pre-selects the active season (date within start/end)', () => {
      // Season 'season-active' spans 2025-09-01 to 2026-08-31.
      // Today (2026-04-02) falls within that range.
      expect(component.selectedSeasonId()).toBe('season-active');
    });

    it('does not pre-select when no season matches today', async () => {
      seasonService.getAll.mockReturnValue(
        of({ data: [makeSeasons()[1]], meta: { total: 1, page: 1, limit: 25 } }),
      );
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EventListComponent],
        providers: [
          { provide: EventService, useValue: eventService },
          { provide: SeasonService, useValue: seasonService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          { provide: Router, useValue: router },
          {
            provide: LUCIDE_ICONS, multi: true,
            useFactory: () => new LucideIconProvider({
              AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown, ChevronUp,
              ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
              MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
            }),
          },
        ],
      }).compileComponents();
      const f = TestBed.createComponent(EventListComponent);
      f.detectChanges();
      expect(f.componentInstance.selectedSeasonId()).toBeUndefined();
    });
  });

  describe('column visibility', () => {
    it('defaults to default-visible columns only', () => {
      const defaultKeys = ALL_EVENT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
      expect(component.visibleColumnKeys()).toEqual(defaultKeys);
    });

    it('toggleColumn adds a hidden column', () => {
      const before = component.visibleColumnKeys().length;
      component.toggleColumn('season');
      expect(component.visibleColumnKeys().length).toBe(before + 1);
      expect(component.visibleColumnKeys()).toContain('season');
    });

    it('toggleColumn removes a visible column', () => {
      component.toggleColumn('date');
      expect(component.visibleColumnKeys()).not.toContain('date');
    });

    it('isColumnVisible returns correct state based on visibleColumnKeys signal', () => {
      const keys = ALL_EVENT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
      component.visibleColumnKeys.set(keys);
      expect(component.isColumnVisible('date')).toBe(true);
      expect(component.isColumnVisible('season')).toBe(false);
    });
  });

  describe('sorting', () => {
    it('starts with no sort active', () => {
      expect(component.sortBy()).toBeUndefined();
      expect(component.sortOrder()).toBeUndefined();
    });

    it('first click sets ASC', () => {
      const dateCol = ALL_EVENT_COLUMNS.find((c) => c.key === 'date')!;
      component.onSortColumn(dateCol);
      expect(component.sortBy()).toBe('date');
      expect(component.sortOrder()).toBe('ASC');
    });

    it('second click toggles to DESC', () => {
      const dateCol = ALL_EVENT_COLUMNS.find((c) => c.key === 'date')!;
      component.onSortColumn(dateCol);
      component.onSortColumn(dateCol);
      expect(component.sortOrder()).toBe('DESC');
    });

    it('third click clears sort', () => {
      const dateCol = ALL_EVENT_COLUMNS.find((c) => c.key === 'date')!;
      component.onSortColumn(dateCol);
      component.onSortColumn(dateCol);
      component.onSortColumn(dateCol);
      expect(component.sortBy()).toBeUndefined();
      expect(component.sortOrder()).toBeUndefined();
    });

    it('sortStateForColumn reflects current sort state', () => {
      const dateCol = ALL_EVENT_COLUMNS.find((c) => c.key === 'date')!;
      expect(component.sortStateForColumn(dateCol)).toBe('none');
      component.onSortColumn(dateCol);
      expect(component.sortStateForColumn(dateCol)).toBe('asc');
      component.onSortColumn(dateCol);
      expect(component.sortStateForColumn(dateCol)).toBe('desc');
    });

    it('does nothing for non-sortable columns', () => {
      const startTimeCol = ALL_EVENT_COLUMNS.find((c) => c.key === 'startTime')!;
      component.onSortColumn(startTimeCol);
      expect(component.sortBy()).toBeUndefined();
    });
  });

  describe('time filter', () => {
    it('defaults to all', () => {
      expect(component.timeFilter()).toBe('all');
    });

    it('onTimeFilterChange updates and reloads', () => {
      component.onTimeFilterChange('upcoming');
      expect(component.timeFilter()).toBe('upcoming');
      const lastCall = eventService.getAll.mock.calls.at(-1)![0];
      expect(lastCall.timeFilter).toBe('upcoming');
    });

    it('timeFilter=all does not pass timeFilter param to API', () => {
      component.onTimeFilterChange('all');
      const lastCall = eventService.getAll.mock.calls.at(-1)![0];
      expect(lastCall.timeFilter).toBeUndefined();
    });
  });

  describe('filter chips', () => {
    it('hasFilterChips is false by default (active season is selected but not a user chip)', () => {
      // Season selection does not currently drive hasFilterChips since it is auto-set
      component.selectedSeasonId.set(undefined);
      component.timeFilter.set('all');
      component.search.set('');
      component.selectedCountsForStats.set(undefined);
      expect(component.hasFilterChips()).toBe(false);
    });

    it('hasFilterChips is true when timeFilter is not all', () => {
      component.onTimeFilterChange('upcoming');
      expect(component.hasFilterChips()).toBe(true);
    });

    it('hasFilterChips is true when search is non-empty', () => {
      component.search.set('general');
      expect(component.hasFilterChips()).toBe(true);
    });

    it('clearFilters resets all signals', () => {
      component.onTimeFilterChange('past');
      component.clearFilters();
      expect(component.timeFilter()).toBe('all');
      expect(component.search()).toBe('');
      expect(component.selectedCountsForStats()).toBeUndefined();
    });
  });

  describe('search debounce', () => {
    it('debounces search by 300ms', async () => {
      vi.useFakeTimers();
      component.onSearchChange('general');
      expect(component.search()).toBe('');
      vi.advanceTimersByTime(300);
      expect(component.search()).toBe('general');
      vi.useRealTimers();
    });
  });

  describe('pagination', () => {
    it('starts on page 1', () => {
      expect(component.page()).toBe(1);
    });

    it('onLimitChange updates limit and resets to page 1', () => {
      component.page.set(3);
      component.onLimitChange(50);
      expect(component.limit()).toBe(50);
      expect(component.page()).toBe(1);
    });

    it('ignores invalid limit values', () => {
      component.onLimitChange(999);
      expect(component.limit()).toBe(25);
    });
  });

  describe('past/future detection', () => {
    it('isEventPast returns true for past date', () => {
      expect(component.isEventPast('2020-01-01', null)).toBe(true);
    });

    it('isEventPast returns false for future date', () => {
      expect(component.isEventPast('2099-01-01', null)).toBe(false);
    });

    it('uses startTime for precision', () => {
      const today = new Date();
      const pastTime = `${String(today.getHours() - 2).padStart(2, '0')}:00`;
      const dateStr = today.toISOString().slice(0, 10);
      expect(component.isEventPast(dateStr, pastTime)).toBe(true);
    });
  });

  describe('formatDate', () => {
    it('formats a date string correctly using ca-ES locale', () => {
      const result = component.formatDate('2026-03-26');
      expect(result).toMatch(/26/);
      expect(result).toMatch(/2026/);
    });

    it('returns empty string for falsy input', () => {
      expect(component.formatDate('')).toBe('');
    });
  });

  describe('getConfirmedCount / getDeclinedCount', () => {
    const summary = {
      confirmed: 10, declined: 5, pending: 3,
      attended: 20, noShow: 2, lateCancel: 1, children: 4, total: 40,
    };

    it('returns attended for past event (getConfirmedCount)', () => {
      expect(component.getConfirmedCount(summary, true)).toBe(20);
    });

    it('returns confirmed for future event (getConfirmedCount)', () => {
      expect(component.getConfirmedCount(summary, false)).toBe(10);
    });

    it('returns declined + noShow for past event (getDeclinedCount)', () => {
      expect(component.getDeclinedCount(summary, true)).toBe(7);
    });

    it('returns only declined for future event (getDeclinedCount)', () => {
      expect(component.getDeclinedCount(summary, false)).toBe(5);
    });
  });

  describe('navigation', () => {
    it('navigateToSync goes to /rehearsals/sync for ASSAIG', () => {
      component.navigateToSync();
      expect(router.navigate).toHaveBeenCalledWith(['/rehearsals', 'sync']);
    });

    it('navigateToEvent goes to /rehearsals/:id for ASSAIG', () => {
      component.navigateToEvent('event-123');
      expect(router.navigate).toHaveBeenCalledWith(['/rehearsals', 'event-123']);
    });
  });

  describe('ACTUACIO event type', () => {
    const iconProvider = {
      provide: LUCIDE_ICONS, multi: true,
      useFactory: () => new LucideIconProvider({
        AlertCircle, AlertTriangle, ArrowLeft, Calendar, Check, ChevronDown, ChevronUp,
        ChevronsUpDown, Clock, Construction, Eye, Home, Layers, Lock, Mail, Menu,
        MoreHorizontal, Plus, RefreshCw, Search, Settings, Star, UserX, Users,
      }),
    };

    it('sets page title to Actuacions for ACTUACIO type', async () => {
      const routeActuacio = { snapshot: { data: { eventType: EventType.ACTUACIO } } };
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EventListComponent],
        providers: [
          { provide: EventService, useValue: eventService },
          { provide: SeasonService, useValue: seasonService },
          { provide: ActivatedRoute, useValue: routeActuacio },
          { provide: Router, useValue: router },
          iconProvider,
        ],
      }).compileComponents();
      const f = TestBed.createComponent(EventListComponent);
      f.detectChanges();
      expect(f.componentInstance.pageTitle()).toBe('Actuacions');
      expect(f.componentInstance.eventType()).toBe(EventType.ACTUACIO);
    });

    it('navigateToSync goes to /performances/sync for ACTUACIO', async () => {
      const routeActuacio = { snapshot: { data: { eventType: EventType.ACTUACIO } } };
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [EventListComponent],
        providers: [
          { provide: EventService, useValue: eventService },
          { provide: SeasonService, useValue: seasonService },
          { provide: ActivatedRoute, useValue: routeActuacio },
          { provide: Router, useValue: router },
          iconProvider,
        ],
      }).compileComponents();
      const f = TestBed.createComponent(EventListComponent);
      f.detectChanges();
      f.componentInstance.navigateToSync();
      expect(router.navigate).toHaveBeenCalledWith(['/performances', 'sync']);
    });
  });
});
