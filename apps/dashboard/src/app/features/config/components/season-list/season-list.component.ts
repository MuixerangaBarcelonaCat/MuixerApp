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
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { SeasonFormModalComponent } from '../season-form-modal/season-form-modal.component';

@Component({
  selector: 'app-season-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    SeasonFormModalComponent,
  ],
  templateUrl: './season-list.component.html',
})
export class SeasonListComponent {
  private readonly seasonService = inject(SeasonService);
  private readonly toast = inject(ToastService);

  readonly seasons = signal<Season[]>([]);
  readonly currentSeasonId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly selectedSeason = signal<Season | null>(null);
  readonly confirmDeleteTarget = signal<Season | null>(null);
  readonly deleting = signal(false);

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
    this.seasonService.remove(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        this.toast.success(`Temporada "${target.name}" eliminada.`);
        this.loadSeasons();
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

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
