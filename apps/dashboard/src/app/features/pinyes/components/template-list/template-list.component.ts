import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import {
  FigureTemplateListItem,
  FigureTemplateFilterParams,
} from '../../models/figure-template.model';
import {
  CompositionTemplateListItem,
  CompositionTemplateFilterParams,
} from '../../models/composition.model';
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
  private readonly compositionTemplateService = inject(CompositionTemplateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  activeTab = signal<ActiveTab>('figures');
  searchInput = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  // Figures tab state
  templates = signal<FigureTemplateListItem[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(25);
  loading = signal(false);
  search = signal('');
  deletingId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()));

  // Compositions tab state
  compositions = signal<CompositionTemplateListItem[]>([]);
  compositionsTotal = signal(0);
  compositionsPage = signal(1);
  compositionsLimit = signal(25);
  compositionsLoading = signal(false);
  compositionsSearch = signal('');
  compositionsSearchInput = '';
  compositionsDeletingId = signal<string | null>(null);
  compositionsConfirmDeleteId = signal<string | null>(null);
  readonly compositionsTotalPages = computed(() =>
    Math.ceil(this.compositionsTotal() / this.compositionsLimit()),
  );

  ngOnInit() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ActiveTab | null;
    if (tab === 'compositions') {
      this.setTab('compositions');
    }
    this.loadTemplates();
  }

  setTab(tab: ActiveTab) {
    this.activeTab.set(tab);
    if (tab === 'compositions' && this.compositions().length === 0) {
      this.loadCompositions();
    }
  }

  // --- Figure actions ---

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

  // --- Composition actions ---

  onCompositionsSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.compositionsSearch.set(value);
      this.compositionsPage.set(1);
      this.loadCompositions();
    }, 300);
  }

  goToCompositionsPage(p: number) {
    if (p < 1 || p > this.compositionsTotalPages()) return;
    this.compositionsPage.set(p);
    this.loadCompositions();
  }

  navigateToCreateComposition() {
    this.router.navigate(['/pinyes/compositions/new']);
  }

  navigateToEditComposition(id: string) {
    this.router.navigate(['/pinyes/compositions', id, 'edit']);
  }

  requestDeleteComposition(id: string) {
    this.compositionsConfirmDeleteId.set(id);
  }

  cancelDeleteComposition() {
    this.compositionsConfirmDeleteId.set(null);
  }

  confirmDeleteComposition(id: string) {
    this.compositionsConfirmDeleteId.set(null);
    this.compositionsDeletingId.set(id);
    this.compositionTemplateService.remove(id).subscribe({
      next: () => {
        this.compositionsDeletingId.set(null);
        this.loadCompositions();
      },
      error: () => {
        this.compositionsDeletingId.set(null);
      },
    });
  }

  duplicateComposition(id: string) {
    this.compositionsLoading.set(true);
    this.compositionTemplateService.duplicate(id).subscribe({
      next: (copy) => {
        this.compositionsLoading.set(false);
        this.router.navigate(['/pinyes/compositions', copy.id, 'edit']);
      },
      error: () => this.compositionsLoading.set(false),
    });
  }

  // --- Private loaders ---

  private loadTemplates() {
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

  private loadCompositions() {
    this.compositionsLoading.set(true);
    const filters: CompositionTemplateFilterParams = {
      search: this.compositionsSearch() || undefined,
      page: this.compositionsPage(),
      limit: this.compositionsLimit(),
    };

    this.compositionTemplateService.getAll(filters).subscribe({
      next: (resp) => {
        this.compositions.set(resp.data);
        this.compositionsTotal.set(resp.meta.total);
        this.compositionsLoading.set(false);
      },
      error: () => this.compositionsLoading.set(false),
    });
  }
}
