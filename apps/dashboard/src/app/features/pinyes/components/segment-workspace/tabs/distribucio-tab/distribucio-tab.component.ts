import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { FigureCanvasComponent, CompositionSlotWithNodes } from '../../../figure-canvas/figure-canvas.component';
import {
  FigurePropertiesPanelComponent,
  FigurePropertiesEntry,
} from '../../../figure-properties-panel/figure-properties-panel.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { CanvasStateService } from '../../../../services/canvas-state.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { FigureInstanceService } from '../../../../services/figure-instance.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService } from '../../../../../../shared/components/feedback/toast/toast.service';
import { mapDistributionItemsToSlots } from '../../../../utils/distribution-slot-mapping.util';
import { computeMaxCordons } from '../../../../utils/figure-mode-filter.util';
import { DistributionItem, InstanceDistributionPayload } from '../../../../models/distribution.model';
import { FigureMode } from '../../../../models/segment.model';

const INITIAL_ZOOM = 0.75;

/**
 * Distribució tab of the segment workspace: the distribution canvas (drag,
 * rotate, tronc-panel drag) plus a properties panel for the selected figure
 * (reusing FigurePropertiesPanelComponent). Instance deletion is not offered
 * here — it already lives in the segment manager.
 */
@Component({
  selector: 'app-distribucio-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FigureCanvasComponent, FigurePropertiesPanelComponent],
  templateUrl: './distribucio-tab.component.html',
})
export class DistribucioTabComponent implements OnInit {
  readonly ws = inject(SegmentWorkspaceStateService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly distributionService = inject(SegmentDistributionService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);

  readonly slots = signal<CompositionSlotWithNodes[]>([]);
  /** Raw (unfiltered) distribution items, kept alongside `slots` to compute maxCordons. */
  private readonly items = signal<DistributionItem[]>([]);
  readonly selectedSlotId = signal<string | null>(null);
  readonly loading = signal(true);

  readonly propertiesEntry = computed<FigurePropertiesEntry | null>(() => {
    const slot = this.slots().find((s) => s.slotId === this.selectedSlotId());
    if (!slot) return null;
    // numberOfCordons/figureMode come from this tab's own (always-fresh) distribution
    // item, not ws.instances() — that list comes from a separate endpoint this tab
    // never re-fetches, so it can go stale after edits made here.
    const item = this.items().find((i) => i.instanceId === slot.slotId);
    return {
      id: slot.slotId,
      label: slot.label,
      figureTemplateName: slot.figureTemplate.name,
      figureMode: (item?.figureMode ?? 'COMPLETA') as FigureMode,
      numberOfCordons: item?.numberOfCordons ?? null,
      maxCordons: computeMaxCordons(item?.figureTemplate.nodes ?? []),
      // Template-intrinsic, so ws.instances() (unlike numberOfCordons/figureMode) is safe here.
      hasPinya: this.ws.instances().find((i) => i.instanceId === slot.slotId)?.hasPinya ?? true,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      angle: slot.angle ?? 0,
    };
  });

  private initialCenterDone = false;
  // Queried by template ref (not by type) so tests can substitute a stub component.
  @ViewChild('canvas') private canvasRef?: FigureCanvasComponent;

  constructor() {
    effect(() => {
      if (this.slots().length > 0 && !this.initialCenterDone) {
        this.initialCenterDone = true;
        setTimeout(() => {
          this.canvasRef?.setZoom(INITIAL_ZOOM);
          this.canvasRef?.centerOnContent();
        });
      }
    });
  }

  ngOnInit(): void {
    this.selectedSlotId.set(this.ws.selectedInstanceId());
    this.loadDistribution();
  }

  get gridSpacing(): number {
    return this.canvasState.gridSpacing();
  }
  get snapToGrid(): boolean {
    return this.canvasState.snapToGrid();
  }

  onSlotSelected(slotId: string | null): void {
    this.selectedSlotId.set(slotId);
    this.ws.selectInstance(slotId);
  }

  onSlotMoved(event: { slotId: string; offsetX: number; offsetY: number; angle: number }): void {
    this.slots.update((current) =>
      current.map((s) =>
        s.slotId === event.slotId
          ? { ...s, offsetX: event.offsetX, offsetY: event.offsetY, angle: event.angle }
          : s,
      ),
    );
    this.save();
  }

  onTroncMoved(event: { slotId: string; troncPanelX: number | null; troncPanelY: number | null }): void {
    this.slots.update((current) =>
      current.map((s) =>
        s.slotId === event.slotId
          ? { ...s, troncPanelX: event.troncPanelX, troncPanelY: event.troncPanelY }
          : s,
      ),
    );
    this.save();
  }

  onOffsetXChanged(event: { id: string; value: number }): void {
    this.onSlotMoved({ ...this.currentSlotTransform(event.id), slotId: event.id, offsetX: event.value });
  }

  onOffsetYChanged(event: { id: string; value: number }): void {
    this.onSlotMoved({ ...this.currentSlotTransform(event.id), slotId: event.id, offsetY: event.value });
  }

  onAngleChanged(event: { id: string; value: number }): void {
    this.onSlotMoved({ ...this.currentSlotTransform(event.id), slotId: event.id, angle: event.value });
  }

  onLabelChanged(event: { id: string; value: string | null }): void {
    this.slots.update((list) =>
      list.map((s) => (s.slotId === event.id ? { ...s, label: event.value } : s)),
    );
    this.instanceService.update(this.ws.eventId(), this.ws.segmentId(), event.id, { label: event.value }).subscribe({
      error: () => this.toast.error("No s'ha pogut actualitzar el nom de la figura."),
    });
  }

  onFigureModeChanged(event: { id: string; value: FigureMode }): void {
    this.instanceService
      .update(this.ws.eventId(), this.ws.segmentId(), event.id, { figureMode: event.value })
      .subscribe({
        next: () => this.loadDistribution(),
        error: () => this.toast.error("No s'ha pogut actualitzar el mode de la figura."),
      });
  }

  onNumberOfCordonsChanged(event: { id: string; value: number | null }): void {
    this.assignmentService.updateCordons(event.id, { numberOfCordons: event.value }).subscribe({
      next: () => this.loadDistribution(),
      error: () => this.toast.error("No s'han pogut actualitzar els cordons."),
    });
  }

  private currentSlotTransform(slotId: string): { offsetX: number; offsetY: number; angle: number } {
    const slot = this.slots().find((s) => s.slotId === slotId);
    return { offsetX: slot?.offsetX ?? 0, offsetY: slot?.offsetY ?? 0, angle: slot?.angle ?? 0 };
  }

  onResetDistribution(): void {
    this.distributionService.clearDistribution(this.ws.eventId(), this.ws.segmentId()).subscribe({
      next: () => {
        this.loadDistribution();
        this.toast.success("S'ha restablert la distribució.");
      },
      error: () => this.toast.error("No s'ha pogut restablir la distribució."),
    });
  }

  private loadDistribution(): void {
    this.distributionService.getDistribution(this.ws.eventId(), this.ws.segmentId()).subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.slots.set(mapDistributionItemsToSlots(data.items));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("No s'ha pogut carregar la distribució.");
      },
    });
  }

  private save(): void {
    const items: InstanceDistributionPayload[] = this.slots().map((s) => ({
      instanceId: s.slotId,
      x: s.offsetX,
      y: s.offsetY,
      angle: s.angle ?? 0,
      troncPanelX: s.troncPanelX ?? null,
      troncPanelY: s.troncPanelY ?? null,
      troncPanelWidth: null,
      troncPanelHeight: null,
    }));

    this.distributionService.saveDistribution(this.ws.eventId(), this.ws.segmentId(), items).subscribe({
      error: () => this.toast.error("No s'ha pogut alçar la distribució."),
    });
  }
}
