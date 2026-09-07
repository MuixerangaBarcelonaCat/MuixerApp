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
import { RouterLink } from '@angular/router';
import { AttendanceStatus, MeEvent, PaginatedResponse } from '@muixer/shared';
import { LucideAngularModule, CalendarDays, List, ChevronRight } from 'lucide-angular';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PullToRefreshComponent } from '../../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { EventCardComponent } from '../components/event-card/event-card.component';
import { CalendarViewComponent } from '../components/calendar-view/calendar-view.component';
import { EventFeedComponent } from '../components/event-feed/event-feed.component';
import { EventService } from '../services/event.service';
import { formatEventDate } from '../../../shared/pipes/format-event-date.pipe';
import { selectedDayHeading as computeDayHeading } from '../../../shared/utils/event-type-labels';

type ViewMode = 'list' | 'calendar';

@Component({
  selector: 'app-event-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    RouterLink,
    MobileHeaderComponent,
    EmptyStateComponent,
    PullToRefreshComponent,
    EventCardComponent,
    CalendarViewComponent,
    EventFeedComponent,
  ],
  templateUrl: './event-list.component.html',
})
export class EventListComponent {
  private readonly eventService = inject(EventService);
  private readonly calendarPullToRefresh = viewChild<PullToRefreshComponent>('calendarPullRef');

  protected readonly CalendarIcon = CalendarDays;
  protected readonly ListIcon = List;
  protected readonly ChevronRightIcon = ChevronRight;

  protected readonly viewMode = signal<ViewMode>('list');
  protected readonly selectedDate = signal<string | null>(null);
  private readonly calendarRequested = signal(false);

  protected readonly calendarResource = rxResource({
    params: () => (this.calendarRequested() ? {} : undefined),
    stream: () => this.eventService.findAll({ timeFilter: 'all', limit: 300 }),
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

  protected readonly selectedDayHeading = computed(() =>
    `${computeDayHeading(this.selectedDayEvents())} del`,
  );

  constructor() {
    effect(() => {
      if (!this.calendarResource.isLoading()) {
        this.calendarPullToRefresh()?.complete();
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

  onSelectedDateChange(date: string | null): void {
    this.selectedDate.set(date);
  }

  onCalendarRefresh(): void {
    this.selectedDate.set(null);
    this.calendarResource.reload();
  }

  /**
   * Patches the calendar view's own copy of an event — called both from its own event cards and,
   * via the feed's `attendanceChanged` re-emit, when the change came from the upcoming list, so
   * toggling to the calendar afterwards doesn't show stale data.
   */
  onAttendanceChanged(change: { eventId: string; personId: string; status: AttendanceStatus }): void {
    const patchList = (res: PaginatedResponse<MeEvent> | undefined) => {
      if (!res) return res;
      return {
        ...res,
        data: res.data.map((e) => {
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
        }),
      };
    };

    this.calendarResource.update(patchList);
  }

  protected loadCalendarEvents(): void {
    this.calendarRequested.set(true);
    this.calendarResource.reload();
  }
}
