import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureTemplateListItem } from '@muixer/shared';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import { EmptyStateComponent } from '../../../../../shared/components/data/empty-state/empty-state.component';

@Component({
  selector: 'app-figure-list-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, EmptyStateComponent],
  templateUrl: './figure-list-tab.component.html',
})
export class FigureListTabComponent implements OnInit {
  readonly openHelpModal = output<void>();

  private readonly figureService = inject(FigureTemplateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly figures = signal<FigureTemplateListItem[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');

  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteTargetName = signal<string>('');
  readonly deleteConfirmOpen = signal(false);

  readonly filteredFigures = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.figures();
    return this.figures().filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.description ?? '').toLowerCase().includes(q),
    );
  });

  private readonly destroy$ = takeUntilDestroyed();

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.figureService.getAll({ limit: 200 }).subscribe({
      next: (res) => {
        this.figures.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error carregant les figures.');
        this.loading.set(false);
      },
    });
  }

  openNewFigure(): void {
    this.router.navigate(['/pinyes/templates/new']);
  }

  openEdit(id: string): void {
    this.router.navigate([`/pinyes/templates/${id}/edit`]);
  }

  confirmDelete(figure: FigureTemplateListItem): void {
    this.deleteTargetId.set(figure.id);
    this.deleteTargetName.set(figure.name);
    this.deleteConfirmOpen.set(true);
  }

  onDeleteConfirmed(): void {
    const id = this.deleteTargetId();
    if (!id) return;
    this.figureService.remove(id).subscribe({
      next: () => {
        this.figures.update((list) => list.filter((f) => f.id !== id));
        this.toast.success('Figura eliminada correctament.');
        this.deleteConfirmOpen.set(false);
        this.deleteTargetId.set(null);
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Error eliminant la figura.';
        this.toast.error(msg);
        this.deleteConfirmOpen.set(false);
      },
    });
  }

  onDeleteCancelled(): void {
    this.deleteConfirmOpen.set(false);
    this.deleteTargetId.set(null);
  }
}
