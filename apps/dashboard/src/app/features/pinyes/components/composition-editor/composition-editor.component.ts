import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CompositionService } from '../../services/composition.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { FigureCanvasComponent, CompositionSlotWithNodes } from '../figure-canvas/figure-canvas.component';
import { FigurePropertiesPanelComponent, FigurePropertiesEntry } from '../figure-properties-panel/figure-properties-panel.component';
import { computeMaxCordons, filterNodesByFigureMode } from '../../utils/figure-mode-filter.util';
import { repositionCordoObertNodes } from '../../utils/cordo-obert.util';
import {
  CompositionDetail,
  CompositionEntryItem,
  CreateCompositionEntryPayload,
} from '../../models/composition.model';
import { FigureMode } from '../../models/segment.model';
import { FigureTemplateListItem } from '../../models/figure-template.model';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const ADD_STAGGER_GAP = 24;
const ADD_STAGGER_COUNT = 5;

@Component({
  selector: 'app-composition-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, FigureCanvasComponent, FigurePropertiesPanelComponent, RouterModule],
  templateUrl: './composition-editor.component.html',
})
export class CompositionEditorComponent implements OnInit, OnDestroy {
  private readonly compositionService = inject(CompositionService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly layoutService = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly compositionId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly name = signal('');
  readonly entries = signal<CompositionEntryItem[]>([]);
  readonly selectedEntryId = signal<string | null>(null);
  readonly saveStatus = signal<SaveStatus>('idle');
  readonly loading = signal(true);
  readonly search = signal('');
  readonly figureTemplates = signal<FigureTemplateListItem[]>([]);

  readonly compositionSlots = computed<CompositionSlotWithNodes[]>(() =>
    this.entries().map((entry) => this.mapEntryToSlot(entry)),
  );

  readonly selectedEntry = computed(
    () => this.entries().find((e) => e.id === this.selectedEntryId()) ?? null,
  );

  readonly propertiesEntry = computed<FigurePropertiesEntry | null>(() => {
    const entry = this.selectedEntry();
    if (!entry) return null;
    return {
      id: entry.id,
      label: entry.label,
      figureTemplateName: entry.figureTemplate.name,
      figureMode: entry.figureMode,
      numberOfCordons: entry.numberOfCordons,
      maxCordons: computeMaxCordons(entry.figureTemplate.nodes),
      hasPinya: entry.figureTemplate.hasPinya,
      offsetX: entry.offsetX,
      offsetY: entry.offsetY,
      angle: entry.angle,
      cordonsObertsEnabled: entry.cordonsObertsEnabled,
      hasCordoObertNodes: entry.figureTemplate.nodes.some((n) => n.positionType === 'cordo-obert'),
    };
  });

  readonly filteredTemplates = computed<FigureTemplateListItem[]>(() => {
    const q = this.search().toLowerCase();
    const all = this.figureTemplates();
    if (!q) return all;
    return all.filter((t) => t.name.toLowerCase().includes(q));
  });

  // Queried by template ref (not by type) so tests can substitute a stub component for FigureCanvasComponent.
  @ViewChild('canvas') private canvasRef?: FigureCanvasComponent;

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    this.loadFigureTemplates();

    const id = this.compositionId();
    if (id) {
      this.loadComposition(id);
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
  }

  private loadComposition(id: string): void {
    this.compositionService.getOne(id).subscribe({
      next: (detail) => {
        this.applySavedDetail(detail);
        this.loading.set(false);
        this.scheduleInitialCenter();
      },
      error: () => {
        this.loading.set(false);
        this.goBack();
      },
    });
  }

  /** Runs once after the canvas has rendered the loaded content, to center the viewport on it. */
  private scheduleInitialCenter(): void {
    setTimeout(() => this.canvasRef?.centerOnContent());
  }

  private loadFigureTemplates(): void {
    this.figureTemplateService.getAll({ limit: 200 }).subscribe({
      next: (resp) => this.figureTemplates.set(resp.data),
      error: () => undefined,
    });
  }

  private mapEntryToSlot(entry: CompositionEntryItem): CompositionSlotWithNodes {
    const filteredNodes = filterNodesByFigureMode(
      entry.figureTemplate.nodes,
      entry.figureMode,
      entry.numberOfCordons,
      { keepCordoObert: true },
    );
    const positionedNodes = repositionCordoObertNodes(
      entry.figureTemplate.nodes,
      filteredNodes,
      entry.numberOfCordons,
    );
    const visibleNodes = entry.cordonsObertsEnabled
      ? positionedNodes
      : positionedNodes.filter((n) => n.positionType !== 'cordo-obert');

    return {
      slotId: entry.id,
      label: entry.label,
      offsetX: entry.offsetX,
      offsetY: entry.offsetY,
      angle: entry.angle,
      sortOrder: entry.sortOrder,
      troncGridCols: entry.troncGridCols,
      troncGridRows: entry.troncGridRows,
      troncPanelX: entry.troncPanelX,
      troncPanelY: entry.troncPanelY,
      figureTemplate: {
        id: entry.figureTemplate.id,
        name: entry.figureTemplate.name,
        hasPinya: visibleNodes.some((n) => n.zone === 'PINYA'),
        nodes: visibleNodes,
      },
    };
  }

  onSlotSelected(slotId: string | null): void {
    this.selectedEntryId.set(slotId);
  }

  onSlotMoved(event: { slotId: string; offsetX: number; offsetY: number; angle: number }): void {
    this.patchEntry(event.slotId, {
      offsetX: event.offsetX,
      offsetY: event.offsetY,
      angle: event.angle,
    });
  }

  onTroncMoved(event: { slotId: string; troncPanelX: number | null; troncPanelY: number | null }): void {
    this.patchEntry(event.slotId, {
      troncPanelX: event.troncPanelX,
      troncPanelY: event.troncPanelY,
    });
  }

  updateName(value: string): void {
    this.name.set(value);
    this.performSave();
  }

  updateLabel(id: string, value: string): void {
    this.patchEntry(id, { label: value.trim() ? value : null });
  }

  updateOffsetX(id: string, value: number): void {
    this.patchEntry(id, { offsetX: value });
  }

  updateOffsetY(id: string, value: number): void {
    this.patchEntry(id, { offsetY: value });
  }

  updateAngle(id: string, value: number): void {
    this.patchEntry(id, { angle: value });
  }

  updateFigureMode(id: string, figureMode: FigureMode): void {
    const patch: Partial<CompositionEntryItem> = { figureMode };
    if (figureMode === 'REMAT' || figureMode === 'NETA') {
      patch.numberOfCordons = null;
    }
    this.patchEntry(id, patch);
  }

  updateNumberOfCordons(id: string, value: number | null): void {
    this.patchEntry(id, { numberOfCordons: value });
  }

  updateCordonsObertsEnabled(id: string, value: boolean): void {
    this.patchEntry(id, { cordonsObertsEnabled: value });
  }

  addFigureTemplate(template: FigureTemplateListItem): void {
    const entry = this.buildNewEntry(template);
    this.entries.update((list) => [...list, entry]);

    if (!this.compositionId()) {
      if (!this.name().trim()) this.name.set(template.name);
      this.createComposition();
    } else {
      this.performSave();
    }
  }

  removeEntry(id: string): void {
    this.entries.update((list) => list.filter((e) => e.id !== id));
    if (this.selectedEntryId() === id) this.selectedEntryId.set(null);
    this.performSave();
  }

  goBack(): void {
    this.router.navigate(['/pinyes'], { queryParams: { tab: 'compositions' } });
  }

  get gridSpacing(): number { return this.canvasState.gridSpacing(); }
  get snapToGrid(): boolean { return this.canvasState.snapToGrid(); }

  toggleSnap(): void { this.canvasState.snapToGrid.set(!this.canvasState.snapToGrid()); }

  get saveStatusLabel(): string {
    switch (this.saveStatus()) {
      case 'saving': return "S'està alçant...";
      case 'saved': return 'Alçat ✓';
      case 'error': return "Error en alçar";
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

  private buildNewEntry(template: FigureTemplateListItem): CompositionEntryItem {
    const center = this.canvasRef?.getViewportCenter() ?? { x: 0, y: 0 };
    const stagger = (this.entries().length % ADD_STAGGER_COUNT) * ADD_STAGGER_GAP;
    return {
      id: `temp-${Date.now()}-${this.entries().length}`,
      label: null,
      offsetX: center.x + stagger,
      offsetY: center.y + stagger,
      angle: 0,
      troncPanelX: null,
      troncPanelY: null,
      figureMode: 'COMPLETA',
      numberOfCordons: null,
      cordonsObertsEnabled: true,
      sortOrder: this.entries().length,
      troncGridCols: 0,
      troncGridRows: 0,
      figureTemplate: {
        id: template.id,
        name: template.name,
        hasPinya: template.hasPinya,
        direction: template.direction,
        nodes: [],
      },
    };
  }

  private patchEntry(id: string, patch: Partial<CompositionEntryItem>): void {
    this.entries.update((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    this.performSave();
  }

  private buildEntriesPayload(): CreateCompositionEntryPayload[] {
    return this.entries().map((e, index) => ({
      figureTemplateId: e.figureTemplate.id,
      label: e.label ?? undefined,
      offsetX: e.offsetX,
      offsetY: e.offsetY,
      angle: e.angle,
      troncPanelX: e.troncPanelX ?? null,
      troncPanelY: e.troncPanelY ?? null,
      figureMode: e.figureMode,
      numberOfCordons: e.numberOfCordons ?? null,
      cordonsObertsEnabled: e.cordonsObertsEnabled,
      sortOrder: index,
    }));
  }

  private applySavedDetail(detail: CompositionDetail): void {
    this.name.set(detail.name);
    this.entries.set([...detail.entries].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  private createComposition(): void {
    this.saveStatus.set('saving');
    this.compositionService.create({ name: this.name(), entries: this.buildEntriesPayload() }).subscribe({
      next: (detail) => {
        this.compositionId.set(detail.id);
        this.applySavedDetail(detail);
        this.saveStatus.set('saved');
        this.router.navigate(['/pinyes/compositions', detail.id, 'edit'], { replaceUrl: true });
      },
      error: () => this.saveStatus.set('error'),
    });
  }

  private performSave(): void {
    const id = this.compositionId();
    if (!id) return;

    const selectedIndex = this.entries().findIndex((e) => e.id === this.selectedEntryId());
    this.saveStatus.set('saving');
    this.compositionService.update(id, { name: this.name(), entries: this.buildEntriesPayload() }).subscribe({
      next: (detail) => {
        const sorted = [...detail.entries].sort((a, b) => a.sortOrder - b.sortOrder);
        this.entries.set(sorted);
        if (selectedIndex >= 0 && sorted[selectedIndex]) {
          this.selectedEntryId.set(sorted[selectedIndex].id);
        }
        this.saveStatus.set('saved');
      },
      error: () => this.saveStatus.set('error'),
    });
  }
}
