import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { EventFormModalComponent } from '../event-form-modal/event-form-modal.component';
import {
  EventListItem,
  EventDetail,
  EventFilterParams,
  Season,
  EventType,
  ColumnDef,
  EventTimeFilter,
} from '../../models/event.model';
import { AttendanceSummary } from '@muixer/shared';

export const ALL_EVENT_COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Data', defaultVisible: true, sortField: 'date' },
  { key: 'title', label: 'Títol', defaultVisible: true, sortField: 'title' },
  { key: 'location', label: 'Lloc', defaultVisible: true, sortField: 'location' },
  { key: 'startTime', label: 'Hora inici', defaultVisible: true },
  { key: 'attendance', label: 'Assistència', defaultVisible: true },
  { key: 'season', label: 'Temporada', defaultVisible: false },
  { key: 'countsForStatistics', label: 'Estadístiques', defaultVisible: false },
  { key: 'createdAt', label: 'Creat', defaultVisible: false, sortField: 'createdAt' },
];

function storageKey(eventType: EventType): string {
  return `event-list-${eventType}-visible-columns`;
}

@Component({
  selector: 'app-event-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, EventFormModalComponent],
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
})
export class EventListComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly seasonService = inject(SeasonService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly EventType = EventType;
  readonly ALL_EVENT_COLUMNS = ALL_EVENT_COLUMNS;
  Math = Math;

  searchInput = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  eventType = signal<EventType>(EventType.ASSAIG);
  selectedSeasonId = signal<string | undefined>(undefined);
  timeFilter = signal<EventTimeFilter>('all');
  selectedCountsForStats = signal<boolean | undefined>(undefined);

  sortBy = signal<EventFilterParams['sortBy'] | undefined>(undefined);
  sortOrder = signal<'ASC' | 'DESC' | undefined>(undefined);

  search = signal('');
  page = signal(1);
  limit = signal(25);

  events = signal<EventListItem[]>([]);
  totalEvents = signal(0);
  seasons = signal<Season[]>([]);
  loading = signal(false);
  showCreateModal = signal(false);

  visibleColumnKeys = signal<string[]>([]);

  visibleColumns = computed(() => {
    const keys = this.visibleColumnKeys();
    return ALL_EVENT_COLUMNS.filter((c) => keys.includes(c.key));
  });

  totalPages = computed(() => Math.ceil(this.totalEvents() / this.limit()));

  pageTitle = computed(() =>
    this.eventType() === EventType.ASSAIG ? 'Assajos' : 'Actuacions',
  );

  hasFilterChips = computed(() => {
    const s = this.search().trim();
    const tf = this.timeFilter() !== 'all';
    const season = this.selectedSeasonId() !== undefined;
    const stats = this.selectedCountsForStats() !== undefined;
    return Boolean(s || tf || season || stats);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 12) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | 'ellipsis')[] = [1];
    const rangeStart = Math.max(2, current - 2);
    const rangeEnd = Math.min(total - 1, current + 2);

    if (rangeStart > 2) pages.push('ellipsis');
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < total - 1) pages.push('ellipsis');
    if (total > 1) pages.push(total);
    return pages;
  });

  ngOnInit() {
    const type = this.route.snapshot.data['eventType'] as EventType;
    if (type) {
      this.eventType.set(type);
    }
    this.visibleColumnKeys.set(this.loadVisibleColumns(this.eventType()));
    this.loadSeasons();
    this.loadEvents();
  }

  onSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadEvents();
    }, 300);
  }

  onSeasonChange(seasonId: string) {
    this.selectedSeasonId.set(seasonId || undefined);
    this.page.set(1);
    this.loadEvents();
  }

  onTimeFilterChange(value: EventTimeFilter) {
    this.timeFilter.set(value);
    this.page.set(1);
    this.loadEvents();
  }

  onCountsForStatsChange(value: string) {
    if (value === 'true') this.selectedCountsForStats.set(true);
    else if (value === 'false') this.selectedCountsForStats.set(false);
    else this.selectedCountsForStats.set(undefined);
    this.page.set(1);
    this.loadEvents();
  }

  onSortColumn(col: ColumnDef) {
    if (!col.sortField) return;
    const field = col.sortField as EventFilterParams['sortBy'];
    const currentField = this.sortBy();
    const currentOrder = this.sortOrder();

    if (currentField !== field) {
      this.sortBy.set(field);
      this.sortOrder.set('ASC');
    } else if (currentOrder === 'ASC') {
      this.sortOrder.set('DESC');
    } else {
      this.sortBy.set(undefined);
      this.sortOrder.set(undefined);
    }
    this.page.set(1);
    this.loadEvents();
  }

  sortStateForColumn(col: ColumnDef): 'none' | 'asc' | 'desc' {
    if (!col.sortField || this.sortBy() !== col.sortField) return 'none';
    return this.sortOrder() === 'DESC' ? 'desc' : 'asc';
  }

  clearFilters() {
    this.searchInput = '';
    this.search.set('');
    this.selectedSeasonId.set(undefined);
    this.timeFilter.set('all');
    this.selectedCountsForStats.set(undefined);
    this.page.set(1);
    this.loadEvents();
  }

  clearSearchChip() {
    this.searchInput = '';
    this.search.set('');
    this.page.set(1);
    this.loadEvents();
  }

  clearTimeFilterChip() {
    this.timeFilter.set('all');
    this.page.set(1);
    this.loadEvents();
  }

  clearSeasonChip() {
    this.selectedSeasonId.set(undefined);
    this.page.set(1);
    this.loadEvents();
  }

  clearStatsChip() {
    this.selectedCountsForStats.set(undefined);
    this.page.set(1);
    this.loadEvents();
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadEvents();
  }

  previousPage() {
    this.goToPage(this.page() - 1);
  }

  nextPage() {
    this.goToPage(this.page() + 1);
  }

  onLimitChange(raw: string | number) {
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (![25, 50, 100].includes(n)) return;
    this.limit.set(n);
    this.page.set(1);
    this.loadEvents();
  }

  navigateToEvent(id: string) {
    const base = this.eventType() === EventType.ASSAIG ? '/rehearsals' : '/performances';
    this.router.navigate([base, id]);
  }

  navigateToSync() {
    const base = this.eventType() === EventType.ASSAIG ? '/rehearsals' : '/performances';
    this.router.navigate([base, 'sync']);
  }

  onEventCreated(event: EventDetail) {
    this.showCreateModal.set(false);
    const base = this.eventType() === EventType.ASSAIG ? '/rehearsals' : '/performances';
    this.router.navigate([base, event.id]);
  }

  toggleColumn(key: string) {
    const current = this.visibleColumnKeys();
    const updated = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    this.visibleColumnKeys.set(updated);
    this.saveVisibleColumns(this.eventType(), updated);
  }

  isColumnVisible(key: string): boolean {
    return this.visibleColumnKeys().includes(key);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  isEventPast(dateStr: string, startTime: string | null): boolean {
    const timeStr = startTime ?? '23:59';
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    return dt < new Date();
  }

  getConfirmedCount(summary: AttendanceSummary, isPast: boolean): number {
    return isPast ? summary.attended : summary.confirmed;
  }

  getDeclinedCount(summary: AttendanceSummary, isPast: boolean): number {
    return isPast ? summary.declined + summary.noShow : summary.declined;
  }

  getSeasonLabel(id: string | undefined): string {
    if (!id) return '';
    return this.seasons().find((s) => s.id === id)?.name ?? '';
  }

  timeFilterLabel(tf: EventTimeFilter): string {
    if (tf === 'upcoming') return 'Propers';
    if (tf === 'past') return 'Passats';
    return 'Tots';
  }

  private loadSeasons() {
    this.seasonService.getAll().subscribe({
      next: (resp) => {
        this.seasons.set(resp.data);
        this.selectActiveSeason(resp.data);
        this.loadEvents();
      },
    });
  }

  private selectActiveSeason(seasons: Season[]) {
    const today = new Date().toISOString().slice(0, 10);
    const active = seasons.find(
      (s) => s.startDate <= today && s.endDate >= today,
    );
    if (active) {
      this.selectedSeasonId.set(active.id);
    }
  }

  private loadEvents() {
    this.loading.set(true);

    const sortBy = this.sortBy();
    const sortOrder = this.sortOrder();
    const timeFilter = this.timeFilter();

    const filters: EventFilterParams = {
      eventType: this.eventType(),
      search: this.search() || undefined,
      seasonId: this.selectedSeasonId(),
      countsForStatistics: this.selectedCountsForStats(),
      timeFilter: timeFilter !== 'all' ? timeFilter : undefined,
      page: this.page(),
      limit: this.limit(),
      ...(sortBy && sortOrder ? { sortBy, sortOrder } : {}),
    };

    this.eventService.getAll(filters).subscribe({
      next: (resp) => {
        this.events.set(resp.data);
        this.totalEvents.set(resp.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadVisibleColumns(eventType: EventType): string[] {
    try {
      const stored = localStorage.getItem(storageKey(eventType));
      if (stored) return JSON.parse(stored) as string[];
    } catch {
      // noop
    }
    return ALL_EVENT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  }

  private saveVisibleColumns(eventType: EventType, keys: string[]) {
    localStorage.setItem(storageKey(eventType), JSON.stringify(keys));
  }
}
