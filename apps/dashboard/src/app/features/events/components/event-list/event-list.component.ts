import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { EventFormModalComponent } from '../event-form-modal/event-form-modal.component';
import {
  EventListItem,
  EventDetail,
  EventFilterParams,
  Season,
  EventType,
  EventTimeFilter,
  AttendanceSummary,
} from '../../models/event.model';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { FilterBarComponent } from '../../../../shared/components/data/filter-bar/filter-bar.component';
import { ActiveFiltersComponent } from '../../../../shared/components/data/active-filters/active-filters.component';
import { ColumnToggleComponent } from '../../../../shared/components/data/column-toggle/column-toggle.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { DataTableComponent, RowAction } from '../../../../shared/components/data/data-table/data-table.component';
import { ActiveFilter } from '../../../../shared/components/data/active-filters/active-filters.component';
import { ColumnDef, GroupSeparator } from '../../../../shared/models/column-def.model';

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
  imports: [
    FormsModule,
    LucideAngularModule,
    EventFormModalComponent,
    PageHeaderComponent,
    FilterBarComponent,
    ActiveFiltersComponent,
    ColumnToggleComponent,
    PaginationComponent,
    EmptyStateComponent,
    DataTableComponent,
  ],
  templateUrl: './event-list.component.html',
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

  /** Active filter chips for app-active-filters */
  readonly activeFilterChips = computed<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (this.search().trim()) chips.push({ key: 'search', label: `Cerca: "${this.search()}"` });
    if (this.timeFilter() !== 'all') chips.push({ key: 'timeFilter', label: this.timeFilterLabel(this.timeFilter()) });
    if (this.selectedSeasonId()) chips.push({ key: 'season', label: `Temporada: ${this.getSeasonLabel(this.selectedSeasonId())}` });
    if (this.selectedCountsForStats() !== undefined) chips.push({ key: 'stats', label: this.selectedCountsForStats() ? 'Compta estadística' : 'No compta' });
    return chips;
  });

  onRemoveFilterChip(key: string): void {
    if (key === 'search') this.clearSearchChip();
    else if (key === 'timeFilter') this.clearTimeFilterChip();
    else if (key === 'season') this.clearSeasonChip();
    else if (key === 'stats') this.clearStatsChip();
  }

  onSortChangeFromTable(event: { field: string; order: 'ASC' | 'DESC' | undefined }): void {
    this.sortBy.set(event.order ? event.field as EventFilterParams['sortBy'] : undefined);
    this.sortOrder.set(event.order);
    this.page.set(1);
    this.loadEvents();
  }

  onSortColumn(col: ColumnDef): void {
    if (!col.sortField) return;
    const field = col.sortField as EventFilterParams['sortBy'];
    if (this.sortBy() !== field) {
      this.sortBy.set(field);
      this.sortOrder.set('ASC');
    } else if (this.sortOrder() === 'ASC') {
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
    return this.sortOrder() === 'ASC' ? 'asc' : 'desc';
  }

  getConfirmedCount(summary: AttendanceSummary, isPast: boolean): number {
    return isPast ? summary.attended : summary.confirmed;
  }

  getDeclinedCount(summary: AttendanceSummary, isPast: boolean): number {
    return isPast ? summary.declined + summary.noShow : summary.declined;
  }

  /** Group separator to split upcoming vs past events */
  readonly groupSeparator = computed<GroupSeparator<EventListItem>>(() => ({
    predicate: (item: EventListItem) => this.isEventPast(item.date, item.startTime),
    label: 'Events passats',
  }));

  formatAttendance(item: EventListItem): string {
    const isPast = this.isEventPast(item.date, item.startTime);
    const s = item.attendanceSummary;
    const yes = isPast ? s.attended : s.confirmed;
    const no = isPast ? s.declined + s.noShow : s.declined;
    const pend = s.pending;
    return `✓${yes} ✗${no} ?${pend}`;
  }

  /** All columns with value extractors — data-table handles visibility via visibleColumns input */
  readonly tableColumns = computed<ColumnDef<EventListItem>[]>(() =>
    ALL_EVENT_COLUMNS.map(col => ({
      ...col,
      value: (item: EventListItem): string => {
        switch (col.key) {
          case 'date': return this.formatDate(item.date);
          case 'title': return item.title;
          case 'location': return item.location ?? '—';
          case 'startTime': return item.startTime?.slice(0, 5) ?? '—';
          case 'attendance': return this.formatAttendance(item);
          case 'season': return item.season?.name ?? '—';
          case 'countsForStatistics': return item.countsForStatistics ? 'Sí' : 'No';
          case 'createdAt': return this.formatDate(item.createdAt);
          default: return String((item as unknown as Record<string, unknown>)[col.key] ?? '—');
        }
      },
    }))
  );

  /** Row actions */
  readonly tableRowActions = computed<RowAction<EventListItem>[]>(() => [
    {
      label: 'Veure detall',
      icon: 'Eye',
      action: (item: EventListItem) => this.navigateToEvent(item.id),
    },
  ]);
}
