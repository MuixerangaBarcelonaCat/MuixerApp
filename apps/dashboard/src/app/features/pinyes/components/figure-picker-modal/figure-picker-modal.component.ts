import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_TEMPLATE, ICON_COMPOSITION } from '../../../../shared/constants/domain-icons';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureTemplateListItem } from '../../models/figure-template.model';

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
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './figure-picker-modal.component.html',
})
export class FigurePickerModalComponent implements OnInit, AfterViewInit {
  readonly ICON_TEMPLATE = ICON_TEMPLATE;
  readonly ICON_COMPOSITION = ICON_COMPOSITION;
  open = input.required<boolean>();
  segmentId = input.required<string>();

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  confirmed = output<InstanceSelection[]>();
  closed = output<void>();

  private readonly figureService = inject(FigureTemplateService);

  activeTab = signal<PickerTab>('figures');
  search = signal('');
  loadingFigures = signal(false);

  figures = signal<FigureTemplateListItem[]>([]);
  selections = signal<PickerSelectionItem[]>([]);

  readonly selectionCount = computed(() => this.selections().length);
  readonly canConfirm = computed(() => this.selectionCount() > 0);

  readonly filteredFigures = computed<FigureTemplateListItem[]>(() => {
    const q = this.search().toLowerCase();
    const all = this.figures();
    if (!q) return all;
    return all.filter((f) => f.name.toLowerCase().includes(q));
  });

  readonly hasAnyFigure = computed(() => this.filteredFigures().length > 0);

  ngOnInit() {
    this.loadFigures();
  }

  ngAfterViewInit() {
    this.searchInputRef?.nativeElement.focus();
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
    this.selections.set([]);
    this.search.set('');
    this.activeTab.set('figures');
    this.closed.emit();
  }
}
