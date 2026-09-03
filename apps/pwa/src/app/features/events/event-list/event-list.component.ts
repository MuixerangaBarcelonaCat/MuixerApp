import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AttendanceStatus, MeEvent, PaginatedResponse } from '@muixer/shared';
import { LucideAngularModule, CalendarDays, List } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PullToRefreshComponent } from '../../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { EventCardComponent } from '../components/event-card/event-card.component';
import { CalendarViewComponent } from '../components/calendar-view/calendar-view.component';
import { EventService } from '../services/event.service';
import { formatEventDate } from '../../../shared/pipes/format-event-date.pipe';
import { selectedDayHeading as computeDayHeading } from '../../../shared/utils/event-type-labels';

type TimeFilter = 'upcoming' | 'past' | 'all';
type ViewMode = 'list' | 'calendar';

interface FilterTab {
  key: TimeFilter;
  label: string;
}

const TABS: FilterTab[] = [
  { key: 'upcoming', label: 'Propers' },
  { key: 'past', label: 'Passats' },
];

const PAGE_SIZE = 50;

@Component({
  selector: 'app-event-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    PullToRefreshComponent,
    InfiniteScrollDirective,
    EventCardComponent,
    CalendarViewComponent,
  ],
  templateUrl: './event-list.component.html',
})
export class EventListComponent {
  private readonly pullToRefresh = viewChild<PullToRefreshComponent>('pullRef');
  private readonly eventService = inject(EventService);

  protected readonly CalendarIcon = CalendarDays;
  protected readonly ListIcon = List;

  protected readonly tabs = TABS;
  protected readonly viewMode = signal<ViewMode>('list');
  protected readonly activeFilter = signal<TimeFilter>('upcoming');
  protected readonly selectedDate = signal<string | null>(null);
  private readonly calendarRequested = signal(false);

  // Infinite scroll for the list view: `listResource` always holds page 1 for the active
  // filter; further pages are fetched imperatively and appended to `extraEvents`. A generation
  // counter discards a page that resolves after the filter changed from under it.
  private readonly page = signal(1);
  private readonly extraEvents = signal<MeEvent[]>([]);
  protected readonly isLoadingMore = signal(false);
  private filterGeneration = 0;

  protected readonly listResource = rxResource({
    params: () => ({ timeFilter: this.activeFilter() }),
    stream: ({ params }) => this.eventService.findAll({ ...params, page: 1, limit: PAGE_SIZE }),
  });

  protected readonly calendarResource = rxResource({
    params: () => (this.calendarRequested() ? {} : undefined),
    stream: () => this.eventService.findAll({ timeFilter: 'all', limit: 300 }),
  });

  protected readonly events = computed(() => {
    const base = this.listResource.error() ? [] : (this.listResource.value()?.data ?? []);
    return [...base, ...this.extraEvents()];
  });
  protected readonly isLoading = this.listResource.isLoading;
  protected readonly hasError = computed(() => !!this.listResource.error());
  protected readonly hasMore = computed(() => {
    if (this.listResource.error()) return false;
    const total = this.listResource.value()?.meta.total ?? 0;
    return this.events().length < total;
  });

  protected readonly allEvents = computed(() =>
    this.calendarResource.error() ? [] : (this.calendarResource.value()?.data ?? []),
  );
  protected readonly isCalendarLoading = this.calendarResource.isLoading;
  protected readonly hasCalendarError = computed(() => !!this.calendarResource.error());
  protected readonly isCalendarTruncated = computed(() => {
    if (this.calendarResource.error()) return false;
    const res = this.calendarResource.value();
    return res ? res.meta.total > res.data.length : false;
  });

  protected readonly selectedDayEvents = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.allEvents().filter((e) => e.date === date);
  });

  protected readonly selectedDateLabel = computed(() =>
    formatEventDate(this.selectedDate()),
  );

  protected readonly emptyMessage = computed(() => {
    const f = this.activeFilter();
    if (f === 'upcoming') return 'No hi ha assajos ni actuacions propers programats.';
    if (f === 'past') return 'No hi ha assajos ni actuacions passats.';
    return 'No hi ha assajos ni actuacions.';
  });

  protected readonly selectedDayHeading = computed(() =>
    `${computeDayHeading(this.selectedDayEvents())} del`,
  );

  constructor() {
    effect(() => {
      const listDone = !this.listResource.isLoading();
      const calDone = !this.calendarResource.isLoading();
      if (listDone || calDone) {
        this.pullToRefresh()?.complete();
      }
    });

    // Switching tabs starts a fresh page 1 — drop whatever extra pages were appended for the
    // previous filter, and invalidate any of its loadMore() calls still in flight.
    effect(() => {
      this.activeFilter();
      this.filterGeneration++;
      this.page.set(1);
      this.extraEvents.set([]);
    });
  }

  toggleView(): void {
    const next: ViewMode = this.viewMode() === 'list' ? 'calendar' : 'list';
    this.viewMode.set(next);
    if (next === 'calendar') {
      this.calendarRequested.set(true);
    }
  }

  setFilter(filter: TimeFilter): void {
    if (filter === this.activeFilter()) return;
    this.activeFilter.set(filter);
  }

  onFilterKeydown(event: KeyboardEvent, index: number): void {
    const tabKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!tabKeys.includes(event.key)) return;
    event.preventDefault();

    let newIndex = index;
    if (event.key === 'ArrowRight') newIndex = (index + 1) % this.tabs.length;
    else if (event.key === 'ArrowLeft') newIndex = (index - 1 + this.tabs.length) % this.tabs.length;
    else if (event.key === 'Home') newIndex = 0;
    else if (event.key === 'End') newIndex = this.tabs.length - 1;

    this.setFilter(this.tabs[newIndex].key);
    const buttons = (event.target as HTMLElement)
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLElement>('[role="tab"]');
    buttons?.[newIndex]?.focus();
  }

  onRefresh(): void {
    if (this.viewMode() === 'calendar') {
      this.selectedDate.set(null);
      this.calendarResource.reload();
    } else {
      this.filterGeneration++;
      this.page.set(1);
      this.extraEvents.set([]);
      this.listResource.reload();
    }
  }

  onSelectedDateChange(date: string | null): void {
    this.selectedDate.set(date);
  }

  /** Fetches the next page and appends it — called by the sentinel at the bottom of the list. */
  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;

    const generation = this.filterGeneration;
    const nextPage = this.page() + 1;
    this.isLoadingMore.set(true);

    this.eventService
      .findAll({ timeFilter: this.activeFilter(), page: nextPage, limit: PAGE_SIZE })
      .subscribe({
        next: (res) => {
          if (generation !== this.filterGeneration) return;
          this.extraEvents.update((list) => [...list, ...res.data]);
          this.page.set(nextPage);
          this.isLoadingMore.set(false);
        },
        error: () => {
          if (generation !== this.filterGeneration) return;
          this.isLoadingMore.set(false);
        },
      });
  }

  onAttendanceChanged(change: { eventId: string; personId: string; status: AttendanceStatus }): void {
    const patchOne = (e: MeEvent): MeEvent => {
      if (e.id !== change.eventId) return e;
      const managedAttendances = e.managedAttendances.map((m) =>
        m.personId === change.personId
          ? {
              ...m,
              attendance: {
                id: m.attendance?.id ?? '',
                status: change.status,
                respondedAt: new Date().toISOString(),
              },
            }
          : m,
      );
      return {
        ...e,
        managedAttendances,
        myAttendance: managedAttendances.find((m) => m.isSelf)?.attendance ?? e.myAttendance,
      };
    };
    const patchList = (res: PaginatedResponse<MeEvent> | undefined) => {
      if (!res) return res;
      return { ...res, data: res.data.map(patchOne) };
    };

    this.listResource.update(patchList);
    this.calendarResource.update(patchList);
    this.extraEvents.update((list) => list.map(patchOne));
  }

  protected loadCalendarEvents(): void {
    this.calendarRequested.set(true);
    this.calendarResource.reload();
  }
}
