import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MeEvent } from '@muixer/shared';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PullToRefreshComponent } from '../../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { EventCardComponent } from '../components/event-card/event-card.component';
import { EventService, MeEventFilters } from '../services/event.service';

type TimeFilter = 'upcoming' | 'past' | 'all';

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
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    PullToRefreshComponent,
    EventCardComponent,
  ],
  templateUrl: './event-list.component.html',
})
export class EventListComponent implements OnInit {
  @ViewChild(PullToRefreshComponent) pullToRefresh?: PullToRefreshComponent;

  private readonly eventService = inject(EventService);

  protected readonly tabs = TABS;
  protected readonly activeFilter = signal<TimeFilter>('upcoming');
  protected readonly events = signal<MeEvent[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly emptyMessage = computed(() => {
    const f = this.activeFilter();
    if (f === 'upcoming') return 'No hi ha events propers programats.';
    if (f === 'past') return 'No hi ha events passats aquesta temporada.';
    return 'No hi ha events aquesta temporada.';
  });

  ngOnInit(): void {
    this.loadEvents();
  }

  setFilter(filter: TimeFilter): void {
    if (filter === this.activeFilter()) return;
    this.activeFilter.set(filter);
    this.loadEvents();
  }

  onRefresh(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    const filters: MeEventFilters = {
      timeFilter: this.activeFilter(),
      limit: 50,
    };

    this.eventService.findAll(filters).subscribe({
      next: (res) => {
        this.events.set(res.data);
        this.isLoading.set(false);
        this.pullToRefresh?.complete();
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
        this.pullToRefresh?.complete();
      },
    });
  }
}
