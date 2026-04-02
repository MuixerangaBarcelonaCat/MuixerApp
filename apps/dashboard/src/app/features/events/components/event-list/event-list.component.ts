import { Component, ChangeDetectionStrategy, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { EventListItem, EventFilterParams, Season, EventType } from '../../models/event.model';
import { AttendanceSummary } from '@muixer/shared';

@Component({
  selector: 'app-event-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
})
export class EventListComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly seasonService = inject(SeasonService);
  private readonly router = inject(Router);

  readonly EventType = EventType;
  Math = Math;

  searchInput = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  activeTab = signal<EventType>(EventType.ASSAIG);
  selectedSeasonId = signal<string | undefined>(undefined);
  selectedCountsForStats = signal<boolean | undefined>(undefined);

  sortBy = signal<'date' | 'eventType' | 'title' | undefined>(undefined);
  sortOrder = signal<'ASC' | 'DESC' | undefined>(undefined);

  search = signal('');
  page = signal(1);
  limit = signal(25);

  events = signal<EventListItem[]>([]);
  totalEvents = signal(0);
  seasons = signal<Season[]>([]);
  loading = signal(false);

  totalPages = computed(() => Math.ceil(this.totalEvents() / this.limit()));

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

  switchTab(tab: EventType) {
    this.activeTab.set(tab);
    this.page.set(1);
    this.loadEvents();
  }

  onSeasonChange(seasonId: string) {
    this.selectedSeasonId.set(seasonId || undefined);
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

  onSortColumn(field: 'date' | 'eventType' | 'title') {
    const current = this.sortBy();
    const currentOrder = this.sortOrder();

    if (current !== field) {
      this.sortBy.set(field);
      this.sortOrder.set('ASC');
    } else if (currentOrder === 'ASC') {
      this.sortOrder.set('DESC');
    } else if (currentOrder === 'DESC') {
      this.sortBy.set(undefined);
      this.sortOrder.set(undefined);
    } else {
      this.sortBy.set(field);
      this.sortOrder.set('ASC');
    }
    this.page.set(1);
    this.loadEvents();
  }

  getSortIcon(field: string): string {
    if (this.sortBy() !== field) return '↕';
    return this.sortOrder() === 'ASC' ? '↑' : '↓';
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

  onLimitChange(value: number) {
    this.limit.set(value);
    this.page.set(1);
    this.loadEvents();
  }

  navigateToEvent(id: string) {
    this.router.navigate(['/events', id]);
  }

  navigateToSync() {
    this.router.navigate(['/events', 'sync']);
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

  private loadSeasons() {
    this.seasonService.getAll().subscribe({
      next: (resp) => this.seasons.set(resp.data),
    });
  }

  private loadEvents() {
    this.loading.set(true);

    const sortBy = this.sortBy();
    const sortOrder = this.sortOrder();

    const filters: EventFilterParams = {
      eventType: this.activeTab(),
      search: this.search() || undefined,
      seasonId: this.selectedSeasonId(),
      countsForStatistics: this.selectedCountsForStats(),
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
}
