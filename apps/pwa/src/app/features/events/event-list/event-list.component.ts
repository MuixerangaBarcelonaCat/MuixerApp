import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
  computed,
  OnInit,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, catchError, EMPTY, tap } from 'rxjs';
import { AttendanceStatus, MeEvent } from '@muixer/shared';
import { LucideAngularModule, CalendarDays, List } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PullToRefreshComponent } from '../../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { EventCardComponent } from '../components/event-card/event-card.component';
import { CalendarViewComponent } from '../components/calendar-view/calendar-view.component';
import { EventService, MeEventFilters } from '../services/event.service';
import { formatEventDate } from '../../../shared/pipes/format-event-date.pipe';

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
export class EventListComponent implements OnInit {
  private readonly pullToRefresh = viewChild<PullToRefreshComponent>('pullRef');

  private readonly eventService = inject(EventService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly filterTrigger$ = new Subject<MeEventFilters>();

  protected readonly CalendarIcon = CalendarDays;
  protected readonly ListIcon = List;

  protected readonly tabs = TABS;
  protected readonly viewMode = signal<ViewMode>('list');
  protected readonly activeFilter = signal<TimeFilter>('upcoming');
  protected readonly events = signal<MeEvent[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly allSeasonEvents = signal<MeEvent[]>([]);
  protected readonly isCalendarLoading = signal(false);
  protected readonly selectedDate = signal<string | null>(null);
  private readonly calendarDataLoaded = signal(false);

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
    if (f === 'upcoming') return 'No hi ha events propers programats.';
    if (f === 'past') return 'No hi ha events passats aquesta temporada.';
    return 'No hi ha events aquesta temporada.';
  });

  ngOnInit(): void {
    this.filterTrigger$
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.hasError.set(false);
        }),
        switchMap((filters) =>
          this.eventService.findAll(filters).pipe(
            catchError(() => {
              this.hasError.set(true);
              this.isLoading.set(false);
              this.pullToRefresh()?.complete();
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.events.set(res.data);
        this.isLoading.set(false);
        this.pullToRefresh()?.complete();
      });

    this.loadEvents();
  }

  toggleView(): void {
    const next: ViewMode = this.viewMode() === 'list' ? 'calendar' : 'list';
    this.viewMode.set(next);
    if (next === 'calendar' && !this.calendarDataLoaded()) {
      this.loadAllSeasonEvents();
    }
  }

  setFilter(filter: TimeFilter): void {
    if (filter === this.activeFilter()) return;
    this.activeFilter.set(filter);
    this.loadEvents();
  }

  onRefresh(): void {
    if (this.viewMode() === 'calendar') {
      this.selectedDate.set(null);
      this.loadAllSeasonEvents();
    } else {
      this.loadEvents();
    }
  }

  onSelectedDateChange(date: string | null): void {
    this.selectedDate.set(date);
  }

  onAttendanceChanged(change: { eventId: string; status: AttendanceStatus }): void {
    const patchAttendance = (events: MeEvent[]): MeEvent[] =>
      events.map((e) =>
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
      );

    this.allSeasonEvents.update(patchAttendance);
    this.events.update(patchAttendance);
  }

  private loadEvents(): void {
    this.filterTrigger$.next({
      timeFilter: this.activeFilter(),
      limit: 50,
    });
  }

  private loadAllSeasonEvents(): void {
    this.isCalendarLoading.set(true);
    this.eventService
      .findAll({ timeFilter: 'all', limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.allSeasonEvents.set(res.data);
          this.isCalendarLoading.set(false);
          this.calendarDataLoaded.set(true);
          this.pullToRefresh()?.complete();
        },
        error: () => {
          this.isCalendarLoading.set(false);
          this.pullToRefresh()?.complete();
        },
      });
  }
}
