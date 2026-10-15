import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeasonService } from '../../../events/services/season.service';
import { Season } from '../../../events/models/event.model';
import { AlertComponent, ButtonComponent, BadgeComponent, EmptyStateComponent, ModalComponent, ToastService } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { SeasonFormModalComponent } from '../season-form-modal/season-form-modal.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';

@Component({
  selector: 'app-season-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    SeasonFormModalComponent,
    AlertComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  templateUrl: './season-list.component.html',
})
export class SeasonListComponent {
  readonly ICON_ASSAIG = DOMAIN_ICONS.ASSAIG;

  private readonly seasonService = inject(SeasonService);
  private readonly toast = inject(ToastService);

  readonly seasons = signal<Season[]>([]);
  readonly currentSeasonId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly selectedSeason = signal<Season | null>(null);
  readonly confirmDeleteTarget = signal<Season | null>(null);
  readonly deleting = signal(false);
  /** Events whose date falls in no season («Sense temporada»). */
  readonly uncoveredEventCount = signal(0);

  readonly formattedSeasons = computed(() =>
    this.seasons().map((s) => ({
      ...s,
      isCurrent: s.id === this.currentSeasonId(),
      startDateFormatted: this.formatDate(s.startDate),
      endDateFormatted: this.formatDate(s.endDate),
    })),
  );

  constructor() {
    this.loadSeasons();
    this.loadCurrentSeason();
    this.loadUncoveredEventCount();
  }

  openCreateModal(): void {
    this.selectedSeason.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(season: Season): void {
    this.selectedSeason.set(season);
    this.modalOpen.set(true);
  }

  onModalSaved(): void {
    this.modalOpen.set(false);
    this.selectedSeason.set(null);
    this.loadSeasons();
    this.loadCurrentSeason();
    this.loadUncoveredEventCount();
  }

  onModalCancelled(): void {
    this.modalOpen.set(false);
    this.selectedSeason.set(null);
  }

  confirmDelete(season: Season): void {
    this.confirmDeleteTarget.set(season);
  }

  cancelDelete(): void {
    this.confirmDeleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.confirmDeleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    // The confirmation modal already warned that its events will be left without a season.
    const request$ =
      target.eventCount > 0
        ? this.seasonService.remove(target.id, { allowUncovered: true })
        : this.seasonService.remove(target.id);
    request$.subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        this.toast.success(`Temporada "${target.name}" eliminada.`);
        this.loadSeasons();
        this.loadUncoveredEventCount();
      },
      error: (err) => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        const msg = err?.error?.message ?? 'Error en eliminar la temporada.';
        this.toast.error(msg);
      },
    });
  }

  private loadSeasons(): void {
    this.loading.set(true);
    this.seasonService.getAll().subscribe({
      next: (resp) => {
        this.seasons.set(resp.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error en carregar les temporades.');
      },
    });
  }

  private loadCurrentSeason(): void {
    this.seasonService.getCurrent().subscribe({
      next: (season) => this.currentSeasonId.set(season.id),
      error: () => this.currentSeasonId.set(null),
    });
  }

  private loadUncoveredEventCount(): void {
    this.seasonService.getUncoveredEventCount().subscribe({
      next: ({ count }) => this.uncoveredEventCount.set(count),
      error: () => this.uncoveredEventCount.set(0),
    });
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
