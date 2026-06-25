import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { TagFormModalComponent } from '../tag-form-modal/tag-form-modal.component';
import { getContrastColor } from '../../../../shared/utils';

@Component({
  selector: 'app-tags-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    TagFormModalComponent,
  ],
  templateUrl: './tags-list.component.html',
})
export class TagsListComponent {
  private readonly tagService = inject(TagService);
  private readonly toast = inject(ToastService);

  readonly tags = signal<TagWithCount[]>([]);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly selectedTag = signal<TagWithCount | null>(null);
  readonly confirmDeleteTarget = signal<TagWithCount | null>(null);
  readonly deleting = signal(false);

  readonly getContrastColor = getContrastColor;

  constructor() {
    this.loadTags();
  }

  openCreateModal(): void {
    this.selectedTag.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(tag: TagWithCount): void {
    this.selectedTag.set(tag);
    this.modalOpen.set(true);
  }

  onModalSaved(): void {
    this.modalOpen.set(false);
    this.selectedTag.set(null);
    this.loadTags();
  }

  onModalCancelled(): void {
    this.modalOpen.set(false);
    this.selectedTag.set(null);
  }

  confirmDelete(tag: TagWithCount): void {
    this.confirmDeleteTarget.set(tag);
  }

  cancelDelete(): void {
    this.confirmDeleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.confirmDeleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    this.tagService.remove(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        this.toast.success(`Etiqueta "${target.name}" eliminada.`);
        this.loadTags();
      },
      error: (err) => {
        this.deleting.set(false);
        this.confirmDeleteTarget.set(null);
        const msg = err?.error?.message ?? "Error en eliminar l'etiqueta.";
        this.toast.error(msg);
      },
    });
  }

  private loadTags(): void {
    this.loading.set(true);
    this.tagService.getAll().subscribe({
      next: (tags) => {
        this.tags.set(tags);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Error en carregar les etiquetes.");
      },
    });
  }
}
