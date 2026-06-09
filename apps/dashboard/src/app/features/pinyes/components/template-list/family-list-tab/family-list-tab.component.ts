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
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FigureFamilyService } from '../../../services/figure-family.service';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import {
  FigureFamilyDetail,
  FigureFamilyListItem,
  CreateFigureFamilyPayload,
} from '../../../models/figure-family.model';
import { EmptyStateComponent } from '../../../../../shared/components/data/empty-state/empty-state.component';
import { FamilyHistoryModalComponent } from '../../family-history-modal/family-history-modal.component';
import { FigureZone } from '@muixer/shared';
import { validateBaseOrdering, BaseValidationResult } from '../../../utils/base-ordering.util';
import { slugify } from '../../../utils/slugify.util';

interface FamilyModal {
  mode: 'create' | 'edit';
  familyId: string | null;
  name: string;
  slug: string;
  description: string;
  saving: boolean;
}

@Component({
  selector: 'app-family-list-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, EmptyStateComponent, FamilyHistoryModalComponent, CdkTrapFocus],
  templateUrl: './family-list-tab.component.html',
})
export class FamilyListTabComponent implements OnInit {
  private readonly figureFamilyService = inject(FigureFamilyService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Emitted when user clicks the "Bases desordenades" badge (opens help modal in parent). */
  readonly openHelpModal = output<void>();

  readonly families = signal<FigureFamilyDetail[]>([]);
  readonly familiesTotal = signal(0);
  readonly familiesPage = signal(1);
  readonly familiesLimit = signal(50);
  readonly familiesLoading = signal(false);
  readonly familiesSearch = signal('');
  familiesSearchInput = '';
  readonly expandedFamilyId = signal<string | null>(null);
  readonly historyFamilyId = signal<string | null>(null);
  readonly historyFamilyName = signal('');
  readonly deletingFamilyId = signal<string | null>(null);
  readonly confirmDeleteFamilyId = signal<string | null>(null);
  readonly deletingVariantId = signal<string | null>(null);
  readonly confirmDeleteVariantId = signal<string | null>(null);
  readonly familyModal = signal<FamilyModal | null>(null);
  readonly familyBaseValidation = signal<Map<string, BaseValidationResult>>(new Map());

  readonly familiesTotalPages = computed(() =>
    Math.ceil(this.familiesTotal() / this.familiesLimit()),
  );

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.loadFamilies();
  }

  isFamilyBaseOrderingValid(familyId: string): boolean {
    const result = this.familyBaseValidation().get(familyId);
    return result?.isValid ?? true;
  }

  getRenglaCount(family: FigureFamilyDetail): number {
    if (!family.variants || family.variants.length === 0) return 0;
    return family.variants[0].renglaCount ?? 0;
  }

  onFamiliesSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.familiesSearch.set(value);
      this.familiesPage.set(1);
      this.loadFamilies();
    }, 300);
  }

  toggleFamily(id: string): void {
    this.expandedFamilyId.update((curr) => (curr === id ? null : id));
  }

  isFamilyExpanded(id: string): boolean {
    return this.expandedFamilyId() === id;
  }

  openFamilyHistory(family: FigureFamilyDetail): void {
    this.historyFamilyId.set(family.id);
    this.historyFamilyName.set(family.name);
  }

  closeFamilyHistory(): void {
    this.historyFamilyId.set(null);
    this.historyFamilyName.set('');
  }

  openCreateFamilyModal(): void {
    this.familyModal.set({ mode: 'create', familyId: null, name: '', slug: '', description: '', saving: false });
  }

  openEditFamilyModal(family: FigureFamilyListItem): void {
    this.familyModal.set({
      mode: 'edit',
      familyId: family.id,
      name: family.name,
      slug: family.slug,
      description: family.description ?? '',
      saving: false,
    });
  }

  closeFamilyModal(): void {
    this.familyModal.set(null);
  }

  onFamilyNameChange(value: string): void {
    const m = this.familyModal();
    if (!m) return;
    const slug = m.mode === 'create' && m.slug === slugify(m.name) ? slugify(value) : m.slug;
    this.familyModal.set({ ...m, name: value, slug });
  }

  onFamilySlugChange(value: string): void {
    const m = this.familyModal();
    if (!m) return;
    this.familyModal.set({ ...m, slug: value });
  }

  onFamilyDescriptionChange(value: string): void {
    const m = this.familyModal();
    if (!m) return;
    this.familyModal.set({ ...m, description: value });
  }

  submitFamilyModal(): void {
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

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
          this.toast.error("No s'ha pogut desar la família. Torna-ho a intentar.");
        }
      },
    });
  }

  requestDeleteFamily(id: string): void {
    this.confirmDeleteFamilyId.set(id);
  }

  cancelDeleteFamily(): void {
    this.confirmDeleteFamilyId.set(null);
  }

  confirmDeleteFamily(id: string): void {
    this.confirmDeleteFamilyId.set(null);
    this.deletingFamilyId.set(id);
    this.figureFamilyService.remove(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
          this.toast.error("No s'ha pogut eliminar la família.");
        }
      },
    });
  }

  openNewVariant(family: FigureFamilyDetail): void {
    this.router.navigate(['/pinyes/templates/new'], {
      queryParams: { familyId: family.id, familyName: family.name },
    });
  }

  navigateToEditVariant(templateId: string): void {
    this.router.navigate(['/pinyes/templates', templateId, 'edit']);
  }

  requestDeleteVariant(variantId: string): void {
    this.confirmDeleteVariantId.set(variantId);
  }

  cancelDeleteVariant(): void {
    this.confirmDeleteVariantId.set(null);
  }

  confirmDeleteVariant(variantId: string, familyId: string): void {
    this.confirmDeleteVariantId.set(null);
    this.deletingVariantId.set(variantId);
    this.figureTemplateService.remove(variantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
          this.toast.error(
            msg ?? "No es pot esborrar: hi ha instàncies o composicions que fan servir aquesta variant. Elimina-les primer des de l'event.",
          );
        } else {
          this.toast.error("No s'ha pogut eliminar la variant.");
        }
      },
    });
  }

  private loadFamilies(): void {
    this.familiesLoading.set(true);
    this.figureFamilyService
      .getAll({ search: this.familiesSearch() || undefined, page: this.familiesPage(), limit: this.familiesLimit(), includeVariants: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.familiesTotal.set(resp.meta.total);
          const details = resp.data as FigureFamilyDetail[];
          this.families.set(details);
          this.familiesLoading.set(false);
          this.validateFamilyBaseOrdering(details);
        },
        error: () => this.familiesLoading.set(false),
      });
  }

  private validateFamilyBaseOrdering(families: FigureFamilyDetail[]): void {
    this.familyBaseValidation.set(new Map());

    for (const family of families) {
      if (family.variants.length === 0) continue;

      const firstVariant = [...family.variants].sort((a, b) => a.variantOrder - b.variantOrder)[0];

      this.figureTemplateService
        .getOne(firstVariant.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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
        });
    }
  }
}
