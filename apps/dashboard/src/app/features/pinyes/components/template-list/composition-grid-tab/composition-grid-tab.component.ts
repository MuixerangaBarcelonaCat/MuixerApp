import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CompositionTemplateService } from '../../../services/composition-template.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import {
  CompositionTemplateListItem,
  CompositionTemplateFilterParams,
} from '../../../models/composition.model';
import { EmptyStateComponent } from '../../../../../shared/components/data/empty-state/empty-state.component';

@Component({
  selector: 'app-composition-grid-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, EmptyStateComponent],
  templateUrl: './composition-grid-tab.component.html',
})
export class CompositionGridTabComponent implements OnInit {
  private readonly compositionTemplateService = inject(CompositionTemplateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly compositions = signal<CompositionTemplateListItem[]>([]);
  readonly compositionsTotal = signal(0);
  readonly compositionsPage = signal(1);
  readonly compositionsLimit = signal(25);
  readonly compositionsLoading = signal(false);
  readonly compositionsSearch = signal('');
  compositionsSearchInput = '';
  readonly compositionsDeletingId = signal<string | null>(null);
  readonly compositionsConfirmDeleteId = signal<string | null>(null);
  readonly compositionsTotalPages = computed(() =>
    Math.ceil(this.compositionsTotal() / this.compositionsLimit()),
  );

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.loadCompositions();
  }

  onCompositionsSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.compositionsSearch.set(value);
      this.compositionsPage.set(1);
      this.loadCompositions();
    }, 300);
  }

  goToCompositionsPage(p: number): void {
    if (p < 1 || p > this.compositionsTotalPages()) return;
    this.compositionsPage.set(p);
    this.loadCompositions();
  }

  navigateToCreateComposition(): void {
    this.router.navigate(['/pinyes/compositions/new']);
  }

  navigateToEditComposition(id: string): void {
    this.router.navigate(['/pinyes/compositions', id, 'edit']);
  }

  requestDeleteComposition(id: string): void {
    this.compositionsConfirmDeleteId.set(id);
  }

  cancelDeleteComposition(): void {
    this.compositionsConfirmDeleteId.set(null);
  }

  confirmDeleteComposition(id: string): void {
    this.compositionsConfirmDeleteId.set(null);
    this.compositionsDeletingId.set(id);
    this.compositionTemplateService.remove(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.compositionsDeletingId.set(null);
        this.loadCompositions();
      },
      error: () => {
        this.compositionsDeletingId.set(null);
        this.toast.error('No s\'ha pogut eliminar la composició.');
      },
    });
  }

  duplicateComposition(id: string): void {
    this.compositionsLoading.set(true);
    this.compositionTemplateService.duplicate(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (copy) => {
        this.compositionsLoading.set(false);
        this.router.navigate(['/pinyes/compositions', copy.id, 'edit']);
      },
      error: () => this.compositionsLoading.set(false),
    });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private loadCompositions(): void {
    this.compositionsLoading.set(true);
    const filters: CompositionTemplateFilterParams = {
      search: this.compositionsSearch() || undefined,
      page: this.compositionsPage(),
      limit: this.compositionsLimit(),
    };
    this.compositionTemplateService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.compositions.set(resp.data);
        this.compositionsTotal.set(resp.meta.total);
        this.compositionsLoading.set(false);
      },
      error: () => this.compositionsLoading.set(false),
    });
  }
}
