import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import { FigureTemplateListItem, FigureTemplateFilterParams } from '../../../models/figure-template.model';
import { EmptyStateComponent } from '../../../../../shared/components/data/empty-state/empty-state.component';

@Component({
  selector: 'app-figure-grid-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, EmptyStateComponent],
  templateUrl: './figure-grid-tab.component.html',
})
export class FigureGridTabComponent implements OnInit {
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Emitted when the user requests to switch to the families tab. */
  readonly switchToFamilies = output<void>();

  readonly templates = signal<FigureTemplateListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly loading = signal(false);
  readonly search = signal('');
  searchInput = '';
  readonly deletingId = signal<string | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);
  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()));

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.loadTemplates();
  }

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadTemplates();
    }, 300);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadTemplates();
  }

  navigateToEdit(id: string): void {
    this.router.navigate(['/pinyes/templates', id, 'edit']);
  }

  requestDelete(id: string): void {
    this.confirmDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(id: string): void {
    this.confirmDeleteId.set(null);
    this.deletingId.set(id);
    this.figureTemplateService.remove(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadTemplates();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        const msg = err.error?.message as string | undefined;
        if (err.status === 409) {
          this.toast.error(msg ?? 'No es pot esborrar: hi ha instàncies o composicions que fan servir aquesta figura.');
        } else {
          this.toast.error('No s\'ha pogut eliminar la figura.');
        }
      },
    });
  }

  duplicate(id: string): void {
    this.loading.set(true);
    this.figureTemplateService.duplicate(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (copy) => {
        this.loading.set(false);
        this.router.navigate(['/pinyes/templates', copy.id, 'edit']);
      },
      error: () => this.loading.set(false),
    });
  }

  hasPinyaLabel(hasPinya: boolean): string {
    return hasPinya ? 'Pinya + Tronc' : 'Només Tronc';
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private loadTemplates(): void {
    this.loading.set(true);
    const filters: FigureTemplateFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
    this.figureTemplateService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.templates.set(resp.data.filter((t) => !t.familyId));
        this.total.set(resp.data.filter((t) => !t.familyId).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
