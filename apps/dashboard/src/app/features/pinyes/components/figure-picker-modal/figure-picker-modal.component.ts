import { FigureTemplateListItem } from '@muixer/pinyes-render';
import {
  BadgeComponent,
  ButtonComponent,
  EmptyStateComponent,
  InputComponent,
  ModalComponent,
  TabsComponent,
  type TabDef,
} from '@muixer/ui';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CompositionService } from '../../services/composition.service';
import { CompositionListItem } from '../../models/composition.model';

export type PickerTab = 'figures' | 'composicions';

export interface InstanceSelection {
  figureTemplateId: string;
}

export interface PickerSelectionItem {
  selection: InstanceSelection;
  name: string;
  hasPinya: boolean;
}

@Component({
  selector: 'app-figure-picker-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ModalComponent,
    TabsComponent,
    InputComponent,
    ButtonComponent,
    BadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './figure-picker-modal.component.html',
})
export class FigurePickerModalComponent implements OnInit {
  readonly SearchIcon = Search;
  readonly DOMAIN_ICONS = DOMAIN_ICONS;
  readonly tabDefs: TabDef[] = [
    { id: 'figures', label: 'Figures', icon: DOMAIN_ICONS.TEMPLATE },
    { id: 'composicions', label: 'Composicions', icon: DOMAIN_ICONS.COMPOSITION },
  ];

  open = input.required<boolean>();
  segmentId = input.required<string>();

  confirmed = output<InstanceSelection[]>();
  compositionSelected = output<{ compositionId: string; compositionName: string }>();
  closed = output<void>();

  private readonly figureService = inject(FigureTemplateService);
  private readonly compositionService = inject(CompositionService);

  activeTab = signal<PickerTab>('figures');
  search = signal('');
  loadingFigures = signal(false);
  loadingCompositions = signal(false);

  figures = signal<FigureTemplateListItem[]>([]);
  selections = signal<PickerSelectionItem[]>([]);

  compositions = signal<CompositionListItem[]>([]);
  selectedComposition = signal<CompositionListItem | null>(null);

  readonly selectionCount = computed(() => this.selections().length);
  readonly canConfirm = computed(() => this.selectionCount() > 0);
  readonly canApplyComposition = computed(() => this.selectedComposition() !== null);

  readonly filteredFigures = computed<FigureTemplateListItem[]>(() => {
    const q = this.normalizeForMatch(this.search());
    const all = this.figures();
    if (!q) return all;
    return all.filter((f) => this.normalizeForMatch(f.name).includes(q));
  });

  readonly hasAnyFigure = computed(() => this.filteredFigures().length > 0);

  readonly filteredCompositions = computed<CompositionListItem[]>(() => {
    const q = this.normalizeForMatch(this.search());
    const all = this.compositions();
    if (!q) return all;
    return all.filter((c) => this.normalizeForMatch(c.name).includes(q));
  });

  readonly hasAnyComposition = computed(() => this.filteredCompositions().length > 0);

  ngOnInit() {
    this.loadFigures();
    this.loadCompositions();
  }

  private loadFigures() {
    this.loadingFigures.set(true);
    this.figureService.getAll({ limit: 200 }).subscribe({
      next: (resp) => {
        this.figures.set(resp.data);
        this.loadingFigures.set(false);
      },
      error: () => this.loadingFigures.set(false),
    });
  }

  private loadCompositions() {
    this.loadingCompositions.set(true);
    this.compositionService.getAll({ limit: 200 }).subscribe({
      next: (resp) => {
        this.compositions.set(resp.data);
        this.loadingCompositions.set(false);
      },
      error: () => this.loadingCompositions.set(false),
    });
  }

  selectComposition(composition: CompositionListItem): void {
    this.selectedComposition.set(composition);
  }

  isCompositionSelected(composition: CompositionListItem): boolean {
    return this.selectedComposition()?.id === composition.id;
  }

  private normalizeForMatch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  applyComposition(): void {
    const composition = this.selectedComposition();
    if (!composition) return;
    this.compositionSelected.emit({ compositionId: composition.id, compositionName: composition.name });
    this.close();
  }

  addFirstResult(): void {
    if (!this.search()) {
      if (this.canConfirm()) this.confirm();
      return;
    }
    if (this.activeTab() === 'figures') {
      const first = this.filteredFigures()[0];
      if (first) {
        this.addFigure(first);
        this.search.set('');
      }
    }
  }

  addFigure(figure: FigureTemplateListItem): void {
    this.selections.update((list) => [
      ...list,
      {
        selection: { figureTemplateId: figure.id },
        name: figure.name,
        hasPinya: figure.hasPinya,
      },
    ]);
  }

  removeSelection(index: number): void {
    this.selections.update((list) => list.filter((_, i) => i !== index));
  }

  confirm(): void {
    this.confirmed.emit(this.selections().map((s) => s.selection));
    this.selections.set([]);
  }

  setTab(tab: string) {
    this.activeTab.set(tab as PickerTab);
    this.search.set('');
    this.selectedComposition.set(null);
  }

  close() {
    this.selections.set([]);
    this.selectedComposition.set(null);
    this.search.set('');
    this.activeTab.set('figures');
    this.closed.emit();
  }
}
