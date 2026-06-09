import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FigureTemplateService } from '../../services/figure-template.service';
import { FigureFamilyService } from '../../services/figure-family.service';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { FigureTemplateListItem } from '../../models/figure-template.model';
import { FigureFamilyDetail } from '../../models/figure-family.model';
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
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './figure-picker-modal.component.html',
})
export class FigurePickerModalComponent implements OnInit {
  open = input.required<boolean>();
  segmentId = input.required<string>();

  selected = output<InstanceSelection>();
  closed = output<void>();

  private readonly figureService = inject(FigureTemplateService);
  private readonly familyService = inject(FigureFamilyService);
  private readonly compositionService = inject(CompositionTemplateService);

  activeTab = signal<PickerTab>('figures');
  search = signal('');
  loadingFigures = signal(false);
  loadingCompositions = signal(false);

  families = signal<FigureFamilyDetail[]>([]);
  figures = signal<FigureTemplateListItem[]>([]);
  compositions = signal<CompositionTemplateListItem[]>([]);

  // Figures grouped by family, filtered by search
  readonly familyGroups = computed<FamilyGroup[]>(() => {
    const q = this.search().toLowerCase();
    return this.families()
      .map((f) => {
        const variants = f.variants
          .map((v) => this.figures().find((fig) => fig.id === v.id))
          .filter((fig): fig is FigureTemplateListItem => !!fig)
          .filter((fig) => !q || fig.name.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
        return { familyId: f.id, familyName: f.name, variants };
      })
      .filter((g) => g.variants.length > 0);
  });

  readonly legacyFigures = computed<FigureTemplateListItem[]>(() => {
    const q = this.search().toLowerCase();
    const all = this.figures();
    if (!q) return all;
    return all.filter((f) => f.name.toLowerCase().includes(q));
  });

  readonly filteredCompositions = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.compositions();
    return this.compositions().filter((c) => c.name.toLowerCase().includes(q));
  });

  readonly hasAnyFigure = computed(
    () => this.familyGroups().length > 0 || this.legacyFigures().length > 0,
  );

  ngOnInit() {
    this.loadFigures();
    this.loadCompositions();
  }

  private loadFigures() {
    this.loadingFigures.set(true);
    this.figureService.getAll({ limit: 200 }).subscribe({
      next: (resp) => {
        this.figures.set(resp.data);
        this.loadFamilies();
      },
      error: () => this.loadingFigures.set(false),
    });
  }

  private loadFamilies() {
    this.familyService.getAll({ limit: 100 }).subscribe({
      next: (resp) => {
        const listItems = resp.data;
        if (listItems.length === 0) {
          this.families.set([]);
          this.loadingFigures.set(false);
          return;
        }
        let completed = 0;
        const details: FigureFamilyDetail[] = new Array(listItems.length);
        listItems.forEach((item, idx) => {
          this.familyService.getOne(item.id).subscribe({
            next: (detail) => {
              details[idx] = detail;
              completed++;
              if (completed === listItems.length) {
                this.families.set(details);
                this.loadingFigures.set(false);
              }
            },
            error: () => {
              details[idx] = { ...item, metadata: {}, variants: [] };
              completed++;
              if (completed === listItems.length) {
                this.families.set(details);
                this.loadingFigures.set(false);
              }
            },
          });
        });
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
