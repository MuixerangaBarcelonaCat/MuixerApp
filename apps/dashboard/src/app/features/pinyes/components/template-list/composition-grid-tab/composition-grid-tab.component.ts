import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, Search } from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../../shared/constants/domain-icons';
import { ButtonComponent, BadgeComponent, CardComponent, InputComponent, ModalComponent, EmptyStateComponent } from '@muixer/ui';
import { CompositionService } from '../../../services/composition.service';
import { CompositionFilterParams, CompositionListItem } from '../../../models/composition.model';
import { TemplatePreviewDrawingComponent } from '../../template-preview-drawing/template-preview-drawing.component';

@Component({
  selector: 'app-composition-grid-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    BadgeComponent,
    CardComponent,
    InputComponent,
    ModalComponent,
    EmptyStateComponent,
    TemplatePreviewDrawingComponent,
  ],
  templateUrl: './composition-grid-tab.component.html',
})
export class CompositionGridTabComponent implements OnInit {
  readonly DOMAIN_ICONS = DOMAIN_ICONS;
  readonly SearchIcon = Search;

  private readonly compositionService = inject(CompositionService);
  private readonly router = inject(Router);

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  compositions = signal<CompositionListItem[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(25);
  loading = signal(false);
  search = signal('');
  searchInput = '';
  deletingId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  duplicatingId = signal<string | null>(null);

  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()));
  readonly confirmDeleteComposition = computed(
    () => this.compositions().find((c) => c.id === this.confirmDeleteId()) ?? null,
  );

  ngOnInit(): void {
    this.loadCompositions();
  }

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadCompositions();
    }, 300);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadCompositions();
  }

  navigateToCreate(): void {
    this.router.navigate(['/pinyes/compositions/new']);
  }

  navigateToEdit(id: string): void {
    this.router.navigate(['/pinyes/compositions', id, 'edit']);
  }

  requestDelete(id: string): void {
    this.confirmDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(id: string): void {
    this.deletingId.set(id);
    this.compositionService.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.confirmDeleteId.set(null);
        this.loadCompositions();
      },
      error: () => {
        this.deletingId.set(null);
        this.confirmDeleteId.set(null);
      },
    });
  }

  duplicate(id: string): void {
    this.duplicatingId.set(id);
    this.compositionService.duplicate(id).subscribe({
      next: (copy) => {
        this.duplicatingId.set(null);
        this.router.navigate(['/pinyes/compositions', copy.id, 'edit']);
      },
      error: () => this.duplicatingId.set(null),
    });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private loadCompositions(): void {
    this.loading.set(true);
    const filters: CompositionFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
    this.compositionService.getAll(filters).subscribe({
      next: (resp) => {
        this.compositions.set(resp.data);
        this.total.set(resp.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
