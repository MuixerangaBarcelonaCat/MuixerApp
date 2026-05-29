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
import { HttpErrorResponse } from '@angular/common/http';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import {
  FigureTemplateListItem,
  FigureTemplateFilterParams,
} from '../../models/figure-template.model';
import {
  FigureFamilyDetail,
  FigureFamilyListItem,
  CreateFigureFamilyPayload,
} from '../../models/figure-family.model';
import {
  CompositionTemplateListItem,
  CompositionTemplateFilterParams,
} from '../../models/composition.model';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { PinyesOnboardingModalComponent } from '../pinyes-onboarding-modal/pinyes-onboarding-modal.component';
import { TemplateEditorHelpModalComponent } from '../template-editor-help-modal/template-editor-help-modal.component';
import { FamilyHistoryModalComponent } from '../family-history-modal/family-history-modal.component';
import { FigureZone } from '@muixer/shared';
import {
  validateBaseOrdering,
  BaseValidationResult,
} from '../../utils/base-ordering.util';

type ActiveTab = 'families' | 'figures' | 'compositions';

interface FamilyModal {
  mode: 'create' | 'edit';
  familyId: string | null;
  name: string;
  slug: string;
  description: string;
  saving: boolean;
}

@Component({
  selector: 'app-template-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    EmptyStateComponent,
    PinyesOnboardingModalComponent,
    TemplateEditorHelpModalComponent,
    FamilyHistoryModalComponent,
  ],
  templateUrl: './template-list.component.html',
  styleUrl: './template-list.component.scss',
})
export class TemplateListComponent implements OnInit {
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly figureFamilyService = inject(FigureFamilyService);
  private readonly compositionTemplateService = inject(CompositionTemplateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  activeTab = signal<ActiveTab>('families');
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  // Families tab state
  families = signal<FigureFamilyDetail[]>([]);
  familiesTotal = signal(0);
  familiesPage = signal(1);
  familiesLimit = signal(50);
  familiesLoading = signal(false);
  familiesSearch = signal('');
  familiesSearchInput = '';
  expandedFamilyId = signal<string | null>(null);
  historyFamilyId = signal<string | null>(null);
  historyFamilyName = signal('');
  deletingFamilyId = signal<string | null>(null);
  confirmDeleteFamilyId = signal<string | null>(null);
  deletingVariantId = signal<string | null>(null);
  confirmDeleteVariantId = signal<string | null>(null);
  readonly familiesTotalPages = computed(() =>
    Math.ceil(this.familiesTotal() / this.familiesLimit()),
  );

  /**
   * Map of familyId → BaseValidationResult.
   * Populated asynchronously after families load.
   * A missing key means validation is still pending.
   */
  readonly familyBaseValidation = signal<Map<string, BaseValidationResult>>(new Map());

  isFamilyBaseOrderingValid(familyId: string): boolean {
    const result = this.familyBaseValidation().get(familyId);
    return result?.isValid ?? true;
  }

  getRenglaCount(family: FigureFamilyDetail): number {
    if (!family.variants || family.variants.length === 0) return 0;
    return family.variants[0].renglaCount ?? 0;
  }

  // Family modal state
  familyModal = signal<FamilyModal | null>(null);

  // Figures tab state (legacy/no-family)
  templates = signal<FigureTemplateListItem[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(25);
  loading = signal(false);
  search = signal('');
  searchInput = '';
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
    if (tab === 'figures' || tab === 'compositions') {
      this.setTab(tab);
    } else {
      this.loadFamilies();
    }
  }

  setTab(tab: ActiveTab) {
    this.activeTab.set(tab);
    if (tab === 'families' && this.families().length === 0) {
      this.loadFamilies();
    } else if (tab === 'figures' && this.templates().length === 0) {
      this.loadTemplates();
    } else if (tab === 'compositions' && this.compositions().length === 0) {
      this.loadCompositions();
    }
  }

  // ── Families ──────────────────────────────────────────────────────────────

  onFamiliesSearchChange(value: string) {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.familiesSearch.set(value);
      this.familiesPage.set(1);
      this.loadFamilies();
    }, 300);
  }

  toggleFamily(id: string) {
    this.expandedFamilyId.update((curr) => (curr === id ? null : id));
  }

  isFamilyExpanded(id: string): boolean {
    return this.expandedFamilyId() === id;
  }

  openFamilyHistory(family: FigureFamilyDetail) {
    this.historyFamilyId.set(family.id);
    this.historyFamilyName.set(family.name);
  }

  closeFamilyHistory() {
    this.historyFamilyId.set(null);
    this.historyFamilyName.set('');
  }

  openCreateFamilyModal() {
    this.familyModal.set({
      mode: 'create',
      familyId: null,
      name: '',
      slug: '',
      description: '',
      saving: false,
    });
  }

  openEditFamilyModal(family: FigureFamilyListItem) {
    this.familyModal.set({
      mode: 'edit',
      familyId: family.id,
      name: family.name,
      slug: family.slug,
      description: family.description ?? '',
      saving: false,
    });
  }

  closeFamilyModal() {
    this.familyModal.set(null);
  }

  onFamilyNameChange(value: string) {
    const m = this.familyModal();
    if (!m) return;
    const slug = m.mode === 'create' && m.slug === this.slugify(m.name)
      ? this.slugify(value)
      : m.slug;
    this.familyModal.set({ ...m, name: value, slug });
  }

  onFamilySlugChange(value: string) {
    const m = this.familyModal();
    if (!m) return;
    this.familyModal.set({ ...m, slug: value });
  }

  onFamilyDescriptionChange(value: string) {
    const m = this.familyModal();
    if (!m) return;
    this.familyModal.set({ ...m, description: value });
  }

  submitFamilyModal() {
    const m = this.familyModal();
    if (!m || !m.name.trim() || !m.slug.trim() || m.saving) return;

    this.familyModal.set({ ...m, saving: true });

    const payload: CreateFigureFamilyPayload = {
      name: m.name.trim(),
      slug: m.slug.trim(),
      description: m.description.trim() || undefined,
    };

    const obs$ = m.mode === 'create'
      ? this.figureFamilyService.create(payload)
      : this.figureFamilyService.update(m.familyId!, payload);

    obs$.subscribe({
      next: () => {
        this.familyModal.set(null);
        this.loadFamilies();
      },
      error: (err: HttpErrorResponse) => {
        this.familyModal.update((prev) => prev ? { ...prev, saving: false } : null);
        const msg = err.error?.message as string | undefined;
        if (err.status === 409 || msg?.toLowerCase().includes('slug')) {
          this.toast.error(`L'identificador "${m.slug.trim()}" ja l'utilitza una altra família. Canvia'l.`);
        } else {
          this.toast.error('No s\'ha pogut desar la família. Torna-ho a intentar.');
        }
      },
    });
  }

  requestDeleteFamily(id: string) {
    this.confirmDeleteFamilyId.set(id);
  }

  cancelDeleteFamily() {
    this.confirmDeleteFamilyId.set(null);
  }

  confirmDeleteFamily(id: string) {
    this.confirmDeleteFamilyId.set(null);
    this.deletingFamilyId.set(id);
    this.figureFamilyService.remove(id).subscribe({
      next: () => {
        this.deletingFamilyId.set(null);
        if (this.expandedFamilyId() === id) this.expandedFamilyId.set(null);
        this.loadFamilies();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingFamilyId.set(null);
        const msg = err.error?.message as string | undefined;
        if (err.status === 409) {
          this.toast.error(msg ?? 'No es pot esborrar: la família té variants associades.');
        } else {
          this.toast.error('No s\'ha pogut eliminar la família.');
        }
      },
    });
  }

  // ── New variant navigation ─────────────────────────────────────────────────

  openNewVariant(family: FigureFamilyDetail) {
    this.router.navigate(['/pinyes/templates/new'], {
      queryParams: { familyId: family.id, familyName: family.name },
    });
  }

  navigateToEditVariant(templateId: string) {
    this.router.navigate(['/pinyes/templates', templateId, 'edit']);
  }

  requestDeleteVariant(variantId: string) {
    this.confirmDeleteVariantId.set(variantId);
  }

  cancelDeleteVariant() {
    this.confirmDeleteVariantId.set(null);
  }

  confirmDeleteVariant(variantId: string, familyId: string) {
    this.confirmDeleteVariantId.set(null);
    this.deletingVariantId.set(variantId);
    this.figureTemplateService.remove(variantId).subscribe({
      next: () => {
        this.deletingVariantId.set(null);
        this.families.update((list) =>
          list.map((f) =>
            f.id === familyId
              ? { ...f, variants: f.variants.filter((v) => v.id !== variantId), variantCount: f.variantCount - 1 }
              : f,
          ),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.deletingVariantId.set(null);
        const msg = err.error?.message as string | undefined;
        if (err.status === 409) {
          this.toast.error(msg ?? 'No es pot esborrar: hi ha instàncies o composicions que fan servir aquesta variant. Elimina-les primer des de l\'event.');
        } else {
          this.toast.error('No s\'ha pogut eliminar la variant.');
        }
      },
    });
  }

  // ── Figures (legacy / no-family) ──────────────────────────────────────────

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

  // ── Compositions ──────────────────────────────────────────────────────────

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

  // ── Private loaders ───────────────────────────────────────────────────────

  private loadFamilies() {
    this.familiesLoading.set(true);
    this.figureFamilyService
      .getAll({
        search: this.familiesSearch() || undefined,
        page: this.familiesPage(),
        limit: this.familiesLimit(),
      })
      .subscribe({
        next: (resp) => {
          // getAll returns list items; we need detail for each to get variants
          // We use a parallel approach: load details for all families returned
          const listItems = resp.data;
          this.familiesTotal.set(resp.meta.total);
          if (listItems.length === 0) {
            this.families.set([]);
            this.familiesLoading.set(false);
            return;
          }
          let completed = 0;
          const details: FigureFamilyDetail[] = new Array(listItems.length);
          listItems.forEach((item, idx) => {
            this.figureFamilyService.getOne(item.id).subscribe({
              next: (detail) => {
                details[idx] = detail;
                completed++;
                if (completed === listItems.length) {
                  this.families.set(details);
                  this.familiesLoading.set(false);
                  this.validateFamilyBaseOrdering(details);
                }
              },
              error: () => {
                details[idx] = { ...item, metadata: {}, variants: [] };
                completed++;
                if (completed === listItems.length) {
                  this.families.set(details);
                  this.familiesLoading.set(false);
                  this.validateFamilyBaseOrdering(details);
                }
              },
            });
          });
        },
        error: () => this.familiesLoading.set(false),
      });
  }

  private validateFamilyBaseOrdering(families: FigureFamilyDetail[]): void {
    // Reset validation map so stale results from previous loads are cleared
    this.familyBaseValidation.set(new Map());

    for (const family of families) {
      if (family.variants.length === 0) continue;

      const firstVariant = [...family.variants].sort(
        (a, b) => a.variantOrder - b.variantOrder,
      )[0];

      this.figureTemplateService.getOne(firstVariant.id).subscribe({
        next: (tmpl) => {
          const baseNodes = tmpl.nodes.filter((n) => n.zone === FigureZone.BASE);
          const result = validateBaseOrdering(
            baseNodes.map((n) => ({ sortOrder: n.sortOrder, x: n.x, y: n.y })),
          );
          this.familyBaseValidation.update((map) => {
            const next = new Map(map);
            next.set(family.id, result);
            return next;
          });
        },
        error: () => {
          // If we can't load the template, skip validation for this family
        },
      });
    }
  }

  private loadTemplates() {
    this.loading.set(true);
    const filters: FigureTemplateFilterParams = {
      search: this.search() || undefined,
      page: this.page(),
      limit: this.limit(),
    };
    this.figureTemplateService.getAll(filters).subscribe({
      next: (resp) => {
        // Show only templates without a family (legacy data)
        this.templates.set(resp.data.filter((t) => !t.familyId));
        this.total.set(resp.data.filter((t) => !t.familyId).length);
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

  slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }
}
