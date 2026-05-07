import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureTemplateService } from '../../services/figure-template.service';
import {
  FigureTemplateListItem,
  FigureTemplateFilterParams,
} from '../../models/figure-template.model';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';

type ActiveTab = 'figures' | 'compositions';

@Component({
  selector: 'app-template-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, EmptyStateComponent],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class TemplateListComponent implements OnInit {
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly router = inject(Router);

  activeTab = signal<ActiveTab>('figures');
  searchInput = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  templates = signal<FigureTemplateListItem[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(25);
  loading = signal(false);
  search = signal('');

  deletingId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);

  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()));

  readonly filteredTemplates = computed(() => {
    const tab = this.activeTab();
    return this.templates().filter((t) =>
      tab === 'figures' ? t.hasPinya !== false || tab === 'figures' : false,
    );
  });

  ngOnInit() {
    this.loadTemplates();
  }

  setTab(tab: ActiveTab) {
    this.activeTab.set(tab);
  }

  onSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.page.set(1);
      this.loadTemplates();
    }, 300);
  }

  goToPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadTemplates();
  }

  navigateToCreate() {
    this.router.navigate(['/pinyes/templates/new']);
  }

  navigateToEdit(id: string) {
    this.router.navigate(['/pinyes/templates', id, 'edit']);
  }

  requestDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(id: string) {
    this.confirmDeleteId.set(null);
    this.deletingId.set(id);
    this.figureTemplateService.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadTemplates();
      },
      error: () => {
        this.deletingId.set(null);
      },
    });
  }

  duplicate(id: string) {
    this.loading.set(true);
    this.figureTemplateService.duplicate(id).subscribe({
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

  private loadTemplates() {
    if (this.activeTab() === 'compositions') return;

    this.loading.set(true);
    const filters: FigureTemplateFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
    };

    this.figureTemplateService.getAll(filters).subscribe({
      next: (resp) => {
        this.templates.set(resp.data);
        this.total.set(resp.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
