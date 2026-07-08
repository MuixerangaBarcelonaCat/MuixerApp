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
  { key: 'all', label: 'Tots' },
];

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

  protected readonly listResource = rxResource({
    params: () => this.activeFilter(),
    stream: ({ params: timeFilter }) =>
      this.eventService.findAll({ timeFilter, limit: 50 }),
  });

  protected readonly calendarResource = rxResource({
    params: () => (this.calendarRequested() ? ({} as const) : undefined),
    stream: () => this.eventService.findAll({ timeFilter: 'all', limit: 300 }),
  });

  protected readonly events = computed(() =>
    this.listResource.error() ? [] : (this.listResource.value()?.data ?? []),
  );
  protected readonly isLoading = this.listResource.isLoading;
  protected readonly hasError = computed(() => !!this.listResource.error());
  protected readonly isTruncated = computed(() => {
    if (this.listResource.error()) return false;
    const res = this.listResource.value();
    return res ? res.meta.total > res.data.length : false;
  });

  protected readonly allSeasonEvents = computed(() =>
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
    return this.allSeasonEvents().filter((e) => e.date === date);
  });

  protected readonly selectedDateLabel = computed(() =>
    formatEventDate(this.selectedDate()),
  );

  protected readonly emptyMessage = computed(() => {
    const f = this.activeFilter();
    if (f === 'upcoming') return 'No hi ha assajos ni actuacions propers programats.';
    if (f === 'past') return 'No hi ha assajos ni actuacions passats aquesta temporada.';
    return 'No hi ha assajos ni actuacions aquesta temporada.';
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
      this.listResource.reload();
    }
  }

  onSelectedDateChange(date: string | null): void {
    this.selectedDate.set(date);
  }

  onAttendanceChanged(change: { eventId: string; status: AttendanceStatus }): void {
    const patchList = (res: PaginatedResponse<MeEvent> | undefined) => {
      if (!res) return res;
      return {
        ...res,
        data: res.data.map((e) =>
          e.id === change.eventId
            ? {
                ...e,
                myAttendance: {
                  id: e.myAttendance?.id ?? '',
                  status: change.status,
                  respondedAt: new Date().toISOString(),
                },
              }
            : e,
        ),
      };
    };

    this.listResource.update(patchList);
    this.calendarResource.update(patchList);
  }

  protected loadAllSeasonEvents(): void {
    this.calendarRequested.set(true);
    this.calendarResource.reload();
  }
}
