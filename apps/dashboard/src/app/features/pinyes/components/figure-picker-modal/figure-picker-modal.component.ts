import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { FigureTemplateListItem } from '../../models/figure-template.model';
import { CompositionTemplateListItem } from '../../models/composition.model';

export type PickerTab = 'figures' | 'composicions';

export interface InstanceSelection {
  figureTemplateId?: string;
  compositionTemplateId?: string;
}

export interface FamilyGroup {
  familyId: string;
  familyName: string;
  variants: FigureTemplateListItem[];
}

@Component({
  selector: 'app-figure-picker-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, CdkTrapFocus],
  templateUrl: './figure-picker-modal.component.html',
})
export class FigurePickerModalComponent {
  open = input.required<boolean>();
  segmentId = input.required<string>();

  selected = output<InstanceSelection>();
  closed = output<void>();

  private readonly figureService = inject(FigureTemplateService);
  private readonly compositionService = inject(CompositionTemplateService);
  private readonly destroyRef = inject(DestroyRef);

  activeTab = signal<PickerTab>('figures');
  search = signal('');
  loadingFigures = signal(false);
  loadingCompositions = signal(false);

  figures = signal<FigureTemplateListItem[]>([]);
  compositions = signal<CompositionTemplateListItem[]>([]);

  // Figures grouped by family, derived client-side from the figure list (no extra HTTP calls)
  readonly familyGroups = computed<FamilyGroup[]>(() => {
    const q = this.search().toLowerCase();
    const withFamily = this.figures().filter((f) => !!f.familyId);

    const byFamily = new Map<string, { name: string; variants: FigureTemplateListItem[] }>();
    for (const fig of withFamily) {
      const fid = fig.familyId!;
      if (!byFamily.has(fid)) {
        byFamily.set(fid, { name: fig.familyName ?? fid, variants: [] });
      }
      byFamily.get(fid)!.variants.push(fig);
    }

    return Array.from(byFamily.entries())
      .map(([familyId, { name, variants }]) => {
        const sorted = [...variants].sort((a, b) => a.variantOrder - b.variantOrder);
        const filtered = q
          ? sorted.filter((f) => f.name.toLowerCase().includes(q) || name.toLowerCase().includes(q))
          : sorted;
        return { familyId, familyName: name, variants: filtered };
      })
      .filter((g) => g.variants.length > 0)
      .sort((a, b) => a.familyName.localeCompare(b.familyName));
  });

  // Legacy (no-family) figures filtered by search
  readonly legacyFigures = computed<FigureTemplateListItem[]>(() => {
    const q = this.search().toLowerCase();
    const noFamily = this.figures().filter((f) => !f.familyId);
    if (!q) return noFamily;
    return noFamily.filter((f) => f.name.toLowerCase().includes(q));
  });

  readonly filteredCompositions = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.compositions();
    return this.compositions().filter((c) => c.name.toLowerCase().includes(q));
  });

  readonly hasAnyFigure = computed(
    () => this.familyGroups().length > 0 || this.legacyFigures().length > 0,
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.loadFigures();
        this.loadCompositions();
      }
    });
  }

  private loadFigures() {
    this.loadingFigures.set(true);
    this.figureService.getAll({ limit: 200 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.figures.set(resp.data);
        this.loadingFigures.set(false);
      },
      error: () => this.loadingFigures.set(false),
    });
  }

  private loadCompositions() {
    this.loadingCompositions.set(true);
    this.compositionService.getAll({ limit: 200 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.compositions.set(resp.data);
        this.loadingCompositions.set(false);
      },
      error: () => this.loadingCompositions.set(false),
    });
  }

  selectFigure(figure: FigureTemplateListItem) {
    this.selected.emit({ figureTemplateId: figure.id });
  }

  selectComposition(composition: CompositionTemplateListItem) {
    this.selected.emit({ compositionTemplateId: composition.id });
  }

  setTab(tab: PickerTab) {
    this.activeTab.set(tab);
    this.search.set('');
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close() {
    this.closed.emit();
  }
}
