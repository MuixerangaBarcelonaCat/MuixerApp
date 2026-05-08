import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CompositionTemplateService } from '../../services/composition-template.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { FigureCanvasComponent, CompositionSlotWithNodes } from '../figure-canvas/figure-canvas.component';
import {
  CompositionTemplateDetail,
  CompositionSlotItem,
  CreateCompositionSlotPayload,
  CreateCompositionTemplatePayload,
  UpdateCompositionTemplatePayload,
} from '../../models/composition.model';
import { FigureTemplateListItem } from '../../models/figure-template.model';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-composition-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, FigureCanvasComponent, RouterModule],
  templateUrl: './composition-editor.component.html',
})
export class CompositionEditorComponent implements OnInit, OnDestroy {
  private readonly compositionService = inject(CompositionTemplateService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly layoutService = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // State
  composition = signal<CompositionTemplateDetail | null>(null);
  selectedSlotId = signal<string | null>(null);
  availableTemplates = signal<FigureTemplateListItem[]>([]);
  figurePickerSearch = signal('');
  figurePickerSearchInput = '';
  saveStatus = signal<SaveStatus>('idle');
  isNew = signal(false);
  loading = signal(false);

  // Inline editing fields (local, synced to composition on save)
  nameValue = signal('');
  slugValue = signal('');
  descriptionValue = signal('');

  private saveDebounce: ReturnType<typeof setTimeout> | undefined;
  private figureSearchDebounce: ReturnType<typeof setTimeout> | undefined;
  private autoSlugEnabled = true;

  readonly compositionSlots = computed((): CompositionSlotWithNodes[] => {
    const comp = this.composition();
    if (!comp) return [];
    return comp.slots.map((slot) => ({
      slotId: slot.id,
      label: slot.label,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      sortOrder: slot.sortOrder,
      figureTemplate: {
        id: slot.figureTemplate.id,
        name: slot.figureTemplate.name,
        hasPinya: slot.figureTemplate.hasPinya,
        nodes: slot.figureTemplate.nodes,
      },
    }));
  });

  readonly selectedSlot = computed((): CompositionSlotItem | null => {
    const comp = this.composition();
    const id = this.selectedSlotId();
    if (!comp || !id) return null;
    return comp.slots.find((s) => s.id === id) ?? null;
  });

  readonly filteredTemplates = computed(() => {
    const search = this.figurePickerSearch().toLowerCase();
    if (!search) return this.availableTemplates();
    return this.availableTemplates().filter(
      (t) =>
        t.name.toLowerCase().includes(search) || t.slug.toLowerCase().includes(search),
    );
  });

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    this.canvasState.reset();

    const id = this.route.snapshot.paramMap.get('id');
    this.isNew.set(!id);

    if (id) {
      this.loading.set(true);
      this.compositionService.getOne(id).subscribe({
        next: (comp) => {
          this.composition.set(comp);
          this.nameValue.set(comp.name);
          this.slugValue.set(comp.slug);
          this.descriptionValue.set(comp.description ?? '');
          this.autoSlugEnabled = false;
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.router.navigate(['/pinyes'], { queryParams: { tab: 'compositions' } });
        },
      });
    } else {
      this.nameValue.set('');
      this.slugValue.set('');
      this.descriptionValue.set('');
    }

    this.loadAvailableTemplates();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
    clearTimeout(this.saveDebounce);
    clearTimeout(this.figureSearchDebounce);
  }

  // --- Name/slug/description changes ---

  onNameChange(value: string): void {
    this.nameValue.set(value);
    if (this.autoSlugEnabled) {
      this.slugValue.set(this.generateSlug(value));
    }
    this.scheduleSave();
  }

  onSlugChange(value: string): void {
    this.autoSlugEnabled = false;
    this.slugValue.set(value);
    this.scheduleSave();
  }

  onDescriptionChange(value: string): void {
    this.descriptionValue.set(value);
    this.scheduleSave();
  }

  // --- Figure picker ---

  onFigurePickerSearchChange(value: string): void {
    clearTimeout(this.figureSearchDebounce);
    this.figureSearchDebounce = setTimeout(() => {
      this.figurePickerSearch.set(value);
    }, 200);
  }

  addFigure(figureTemplate: FigureTemplateListItem): void {
    const comp = this.composition();
    if (!comp && this.isNew()) {
      if (!this.nameValue().trim()) {
        const defaultName = `Composició amb ${figureTemplate.name}`;
        this.nameValue.set(defaultName);
        this.slugValue.set(this.generateSlug(defaultName));
      }
      this.saveImmediately(() => this.doAddFigure(figureTemplate));
      return;
    }
    this.doAddFigure(figureTemplate);
  }

  private doAddFigure(figureTemplate: FigureTemplateListItem): void {
    const comp = this.composition();
    if (!comp) return;

    const newSlot: CompositionSlotItem = {
      id: `temp-${Date.now()}`,
      label: null,
      offsetX: 0,
      offsetY: 0,
      sortOrder: comp.slots.length,
      figureTemplate: {
        ...figureTemplate,
        nodes: [],
        metadata: {},
        direction: 0,
      },
    };

    this.composition.set({ ...comp, slots: [...comp.slots, newSlot] });
    this.scheduleSave();
  }

  // --- Canvas events ---

  onSlotSelected(slotId: string | null): void {
    this.selectedSlotId.set(slotId);
  }

  onSlotMoved(event: { slotId: string; offsetX: number; offsetY: number }): void {
    const comp = this.composition();
    if (!comp) return;

    const updatedSlots = comp.slots.map((s) =>
      s.id === event.slotId
        ? { ...s, offsetX: event.offsetX, offsetY: event.offsetY }
        : s,
    );
    this.composition.set({ ...comp, slots: updatedSlots });

    if (this.selectedSlotId() === event.slotId) {
      // Force computed re-run
      this.selectedSlotId.set(event.slotId);
    }

    this.scheduleSave();
  }

  // --- Slot property panel ---

  onSlotLabelChange(value: string): void {
    this.updateSelectedSlot({ label: value || null });
    this.scheduleSave();
  }

  onSlotOffsetXChange(value: number): void {
    this.updateSelectedSlot({ offsetX: value });
    this.scheduleSave();
  }

  onSlotOffsetYChange(value: number): void {
    this.updateSelectedSlot({ offsetY: value });
    this.scheduleSave();
  }

  deleteSelectedSlot(): void {
    const slot = this.selectedSlot();
    const comp = this.composition();
    if (!slot || !comp) return;

    this.composition.set({
      ...comp,
      slots: comp.slots.filter((s) => s.id !== slot.id),
    });
    this.selectedSlotId.set(null);
    this.scheduleSave();
  }

  // --- Navigation ---

  goBack(): void {
    this.router.navigate(['/pinyes'], { queryParams: { tab: 'compositions' } });
  }

  get gridEnabled(): boolean {
    return this.canvasState.gridEnabled();
  }

  get gridSpacing(): number {
    return this.canvasState.gridSpacing();
  }

  get snapToGrid(): boolean {
    return this.canvasState.snapToGrid();
  }

  toggleGrid(): void {
    this.canvasState.gridEnabled.set(!this.canvasState.gridEnabled());
  }

  toggleSnap(): void {
    this.canvasState.snapToGrid.set(!this.canvasState.snapToGrid());
  }

  // --- Save logic ---

  private scheduleSave(): void {
    clearTimeout(this.saveDebounce);
    this.saveStatus.set('saving');
    this.saveDebounce = setTimeout(() => this.saveImmediately(), 2000);
  }

  private saveImmediately(afterSave?: () => void): void {
    clearTimeout(this.saveDebounce);

    const comp = this.composition();
    const name = this.nameValue().trim();
    const slug = this.slugValue().trim();

    if (!name || !slug) {
      this.saveStatus.set('error');
      return;
    }

    const slots: CreateCompositionSlotPayload[] = (comp?.slots ?? []).map((s) => ({
      figureTemplateId: s.figureTemplate.id,
      label: s.label ?? undefined,
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      sortOrder: s.sortOrder,
    }));

    this.saveStatus.set('saving');

    if (!comp) {
      const payload: CreateCompositionTemplatePayload = {
        name,
        slug,
        description: this.descriptionValue() || undefined,
        slots,
      };

      this.compositionService.create(payload).subscribe({
        next: (created) => {
          this.composition.set(created);
          this.autoSlugEnabled = false;
          this.saveStatus.set('saved');
          this.router.navigate(['/pinyes/compositions', created.id, 'edit'], {
            replaceUrl: true,
          });
          afterSave?.();
        },
        error: () => this.saveStatus.set('error'),
      });
    } else {
      const payload: UpdateCompositionTemplatePayload = {
        name,
        slug,
        description: this.descriptionValue() || undefined,
        slots,
      };

      this.compositionService.update(comp.id, payload).subscribe({
        next: (updated) => {
          this.composition.set(updated);
          this.saveStatus.set('saved');
          afterSave?.();
        },
        error: () => this.saveStatus.set('error'),
      });
    }
  }

  get saveStatusLabel(): string {
    switch (this.saveStatus()) {
      case 'saving': return 'Guardant...';
      case 'saved': return 'Guardat ✓';
      case 'error': return 'Error en guardar';
      default: return '';
    }
  }

  get saveStatusClass(): string {
    switch (this.saveStatus()) {
      case 'saving': return 'text-base-content/50';
      case 'saved': return 'text-success';
      case 'error': return 'text-error';
      default: return 'text-base-content/30';
    }
  }

  // --- Helpers ---

  private updateSelectedSlot(patch: Partial<CompositionSlotItem>): void {
    const comp = this.composition();
    const slotId = this.selectedSlotId();
    if (!comp || !slotId) return;

    const updatedSlots = comp.slots.map((s) =>
      s.id === slotId ? { ...s, ...patch } : s,
    );
    this.composition.set({ ...comp, slots: updatedSlots });
  }

  private loadAvailableTemplates(): void {
    this.figureTemplateService.getAll({ limit: 100 }).subscribe({
      next: (resp) => this.availableTemplates.set(resp.data),
      error: () => {},
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
