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

  readonly filteredFigures = computed<FigureTemplateListItem[]>(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.figures();
    return this.figures().filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.description ?? '').toLowerCase().includes(q),
    );
  });

  readonly filteredCompositions = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.compositions();
    return this.compositions().filter((c) => c.name.toLowerCase().includes(q));
  });

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
