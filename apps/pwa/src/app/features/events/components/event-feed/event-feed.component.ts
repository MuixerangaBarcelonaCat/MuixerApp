import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AttendanceStatus, MeEvent, PaginatedResponse } from '@muixer/shared';
import { SkeletonCardComponent } from '../../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { PullToRefreshComponent } from '../../../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { InfiniteScrollDirective } from '../../../../shared/directives/infinite-scroll.directive';
import { EventCardComponent } from '../event-card/event-card.component';
import { EventService } from '../../services/event.service';

const PAGE_SIZE = 50;

/**
 * Self-contained infinite-scroll list of events for one `timeFilter` — pull-to-refresh, skeleton/
 * error/empty states, and paging all included. Used both for the Agenda's default upcoming list
 * and the standalone past-events screen, so the two stay identical without sharing UI state:
 * each instance owns its own page/cache, only re-emitting `attendanceChanged` so a host that also
 * shows the same events elsewhere (the calendar view) can patch its own copy in sync.
 */
@Component({
  selector: 'app-event-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonCardComponent,
    EmptyStateComponent,
    PullToRefreshComponent,
    InfiniteScrollDirective,
    EventCardComponent,
  ],
  templateUrl: './event-feed.component.html',
})
export class EventFeedComponent {
  readonly timeFilter = input.required<'upcoming' | 'past'>();
  readonly emptyMessage = input.required<string>();
  readonly attendanceChanged = output<{ eventId: string; personId: string; status: AttendanceStatus }>();

  private readonly pullToRefresh = viewChild<PullToRefreshComponent>('pullRef');
  private readonly eventService = inject(EventService);

  // `listResource` always holds page 1; further pages are fetched imperatively and appended to
  // `extraEvents`. A generation counter discards a page that resolves after a reset (pull-to-
  // refresh, or `timeFilter` changing) invalidated it.
  private readonly page = signal(1);
  private readonly extraEvents = signal<MeEvent[]>([]);
  protected readonly isLoadingMore = signal(false);
  private generation = 0;

  protected readonly listResource = rxResource({
    params: () => ({ timeFilter: this.timeFilter() }),
    stream: ({ params }) => this.eventService.findAll({ ...params, page: 1, limit: PAGE_SIZE }),
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

  constructor() {
    effect(() => {
      if (!this.listResource.isLoading()) {
        this.pullToRefresh()?.complete();
      }
    });

    effect(() => {
      this.timeFilter();
      this.resetPaging();
    });
  }

  onRefresh(): void {
    this.resetPaging();
    this.listResource.reload();
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMore()) return;

    const generation = this.generation;
    const nextPage = this.page() + 1;
    this.isLoadingMore.set(true);

    this.eventService
      .findAll({ timeFilter: this.timeFilter(), page: nextPage, limit: PAGE_SIZE })
      .subscribe({
        next: (res) => {
          if (generation !== this.generation) return;
          this.extraEvents.update((list) => [...list, ...res.data]);
          this.page.set(nextPage);
          this.isLoadingMore.set(false);
        },
        error: () => {
          if (generation !== this.generation) return;
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
    this.extraEvents.update((list) => list.map(patchOne));
    this.attendanceChanged.emit(change);
  }

  private resetPaging(): void {
    this.generation++;
    this.page.set(1);
    this.extraEvents.set([]);
  }
}
