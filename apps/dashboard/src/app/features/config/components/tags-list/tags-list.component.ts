import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { ButtonComponent, BadgeComponent, EmptyStateComponent, ModalComponent, ToastService } from '@muixer/ui';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { TagFormModalComponent } from '../tag-form-modal/tag-form-modal.component';
import {
  TRONC_NODE_PRESETS,
  PINYA_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
  TagCategory,
  TAG_CATEGORY_LABELS,
} from '@muixer/shared';

const CATEGORY_ORDER: Record<TagCategory, number> = {
  [TagCategory.TRONC]: 0,
  [TagCategory.PINYA]: 1,
  [TagCategory.XICALLA]: 2,
  [TagCategory.ALTRES]: 2,
};

@Component({
  selector: 'app-tags-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    TagFormModalComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  templateUrl: './tags-list.component.html',
})
export class TagsListComponent {
  private readonly tagService = inject(TagService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly ICON_TAG = DOMAIN_ICONS.TAG;
  readonly categoryLabels = TAG_CATEGORY_LABELS;

  readonly tags = signal<TagWithCount[]>([]);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly selectedTag = signal<TagWithCount | null>(null);
  readonly confirmDeleteTarget = signal<TagWithCount | null>(null);
  readonly deleting = signal(false);

  readonly positionTypeMeta: Record<string, { label: string; color: string }> = [
    ...TRONC_NODE_PRESETS.map((p) => ({ positionType: p.positionType, label: p.label, color: p.color })),
    ...PINYA_NODE_PRESETS.map((p) => ({ positionType: p.positionType as string, label: p.label, color: p.color ?? '#64748b' })),
    ...DIRECTION_NODE_PRESETS.map((p) => ({ positionType: p.positionType as string, label: p.label, color: p.color ?? '#64748b' })),
    { positionType: 'base', label: 'Base', color: '#64748b' },
  ].reduce<Record<string, { label: string; color: string }>>((acc, p) => {
    acc[p.positionType] = { label: p.label, color: p.color };
    return acc;
  }, {});

  constructor() {
    this.loadTags();
  }

  onRowClick(tag: TagWithCount): void {
    this.router.navigate(['/config/tags', tag.id]);
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
        const sorted = [...tags].sort((a, b) => {
          const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
          return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
        });
        this.tags.set(sorted);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Error en carregar les etiquetes.");
      },
    });
  }
}
