import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { PositionService } from '../../services/position.service';
import { PositionWithCount } from '../../models/position.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { PositionFormModalComponent } from '../position-form-modal/position-form-modal.component';
import { getContrastColor } from '../../../../shared/utils';

@Component({
  selector: 'app-position-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    PositionFormModalComponent,
  ],
  templateUrl: './position-list.component.html',
})
export class PositionListComponent {
  private readonly positionService = inject(PositionService);
  private readonly toast = inject(ToastService);

  readonly positions = signal<PositionWithCount[]>([]);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly selectedPosition = signal<PositionWithCount | null>(null);
  readonly confirmDeleteTarget = signal<PositionWithCount | null>(null);
  readonly deleting = signal(false);

  readonly getContrastColor = getContrastColor;

  constructor() {
    this.loadPositions();
  }

  openCreateModal(): void {
    this.selectedPosition.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(position: PositionWithCount): void {
    this.selectedPosition.set(position);
    this.modalOpen.set(true);
  }

  onModalSaved(): void {
    this.modalOpen.set(false);
    this.selectedPosition.set(null);
    this.loadPositions();
  }

  onModalCancelled(): void {
    this.modalOpen.set(false);
    this.selectedPosition.set(null);
  }

  confirmDelete(position: PositionWithCount): void {
    this.confirmDeleteTarget.set(position);
  }

  cancelDelete(): void {
    this.confirmDeleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.confirmDeleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    this.positionService.remove(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        this.toast.success(`Posició "${target.name}" eliminada.`);
        this.loadPositions();
      },
      error: (err) => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        const msg = err?.error?.message ?? "Error en eliminar la posició.";
        this.toast.error(msg);
      },
    });
  }

  private loadPositions(): void {
    this.loading.set(true);
    this.positionService.getAll().subscribe({
      next: (positions) => {
        this.positions.set(positions);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Error en carregar les posicions.");
      },
    });
  }
}
