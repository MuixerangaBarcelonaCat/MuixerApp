import { FigureCanvasComponent, TroncViewComponent, TroncPanelMeasurerComponent, TroncPanelMeasureSpec, CompositionSlotWithNodes, FigureMode, TroncNodeItem, AssignmentDetail, getFigureColor } from '@muixer/pinyes-render';
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
import {
  FigurePropertiesPanelComponent,
  FigurePropertiesEntry,
} from '../../../figure-properties-panel/figure-properties-panel.component';
import { SegmentWorkspaceStateService } from '../../../../services/segment-workspace-state.service';
import { CanvasStateService } from '../../../../services/canvas-state.service';
import { SegmentDistributionService } from '../../../../services/segment-distribution.service';
import { FigureInstanceService } from '../../../../services/figure-instance.service';
import { NodeAssignmentService } from '../../../../services/node-assignment.service';
import { ToastService, ButtonComponent, ModalComponent } from '@muixer/ui';
import {
  mapDistributionItemsToSlots,
  troncViewNodesFor,
  troncViewAssignmentsFor,
  computeSlotLabel,
} from '../../../../utils/distribution-slot-mapping.util';
import { computeMaxCordons } from '../../../../utils/figure-mode-filter.util';
import { DistributionItem, InstanceDistributionPayload } from '../../../../models/distribution.model';

/** One tronc-view overlay rendered on top of the (visually hidden) Konva tronc panel. */
export interface TroncViewPanel {
  slotId: string;
  screenX: number;
  screenY: number;
  scale: number;
  /** The real, DOM-measured grid width (see `TroncPanelMeasurerComponent`'s two-pass
   *  measurement) — `null` until measurement resolves. Constraining the overlay to this width
   *  is what makes a long direction line wrap instead of stretching the panel, matching
   *  Previsualitza. */
  width: number | null;
  troncNodes: TroncNodeItem[];
  baseNodes: TroncNodeItem[];
  directionNodes: TroncNodeItem[];
  assignments: AssignmentDetail[];
  figureName: string;
  color: string;
}

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
  imports: [LucideAngularModule, FigureCanvasComponent, TroncViewComponent, TroncPanelMeasurerComponent, FigurePropertiesPanelComponent, ButtonComponent, ModalComponent],
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

  /**
   * One measurement panel per loaded item, always — not just while unplaced — so the live
   * overlay (`troncViewPanels`) always has a real, current width to constrain itself to (see
   * `TroncPanelMeasurerComponent`). `onSizesReady` also completes a pending auto-layout when
   * one is waiting (`pendingPlacementItems`).
   */
  readonly measurePanels = computed<TroncPanelMeasureSpec[]>(() =>
    this.items().map((item) => ({
      instanceId: item.instanceId,
      ...troncViewNodesFor(item.figureTemplate.nodes, item.figureMode),
      assignments: troncViewAssignmentsFor(item.assignments, item.figureTemplate.nodes),
      figureName: computeSlotLabel(item),
    })),
  );

  /** Each instance's real, DOM-measured tronc panel size — see `measurePanels`/`onSizesReady`. */
  private readonly measuredTroncSizes = signal<Map<string, { width: number; height: number }>>(new Map());

  /** Set while a fully-unplaced segment is waiting for every instance's size to be measured
   *  before the auto-layout can run — `loading` stays `true` throughout. */
  private pendingPlacementItems: DistributionItem[] | null = null;

  /** Real Konva stage transform — updated via (stageTransformChanged) from the canvas. */
  private readonly stageTransform = signal({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  /** Each tronc panel's live world-space top-left, reported by (troncPanelMoved) — the
   *  same source of truth the (now visually hidden) Konva tronc panel positions itself with. */
  private readonly troncPanelPositions = signal<Map<string, { x: number; y: number }>>(new Map());

  /**
   * One overlay per slot whose position is already known (i.e. the canvas has rendered it at
   * least once) — renders the real `<app-tronc-view>` on top of the canvas's own (visually
   * hidden, see `troncPanelVisualHidden`) tronc panel, replacing the old "Tronc de X" Konva
   * placeholder so the panel always matches Previsualitza's rendering exactly.
   */
  readonly troncViewPanels = computed<TroncViewPanel[]>(() => {
    const { x: stageX, y: stageY, scaleX: stageScale } = this.stageTransform();
    const positions = this.troncPanelPositions();
    const sizes = this.measuredTroncSizes();
    const itemsById = new Map(this.items().map((i) => [i.instanceId, i]));

    const panels: TroncViewPanel[] = [];
    for (const slot of this.slots()) {
      const pos = positions.get(slot.slotId);
      if (!pos) continue;
      const item = itemsById.get(slot.slotId);
      const { troncNodes, baseNodes, directionNodes } = troncViewNodesFor(
        slot.figureTemplate.nodes,
        item?.figureMode ?? 'COMPLETA',
      );
      panels.push({
        slotId: slot.slotId,
        screenX: pos.x * stageScale + stageX,
        screenY: pos.y * stageScale + stageY,
        scale: stageScale,
        width: sizes.get(slot.slotId)?.width ?? null,
        troncNodes,
        baseNodes,
        directionNodes,
        assignments: troncViewAssignmentsFor(item?.assignments ?? [], slot.figureTemplate.nodes),
        figureName: slot.label ?? slot.figureTemplate.name,
        color: getFigureColor(slot.sortOrder),
      });
    }
    return panels;
  });

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
      cordonsObertsEnabled: item?.cordonsObertsEnabled ?? true,
      hasCordoObertNodes: (item?.figureTemplate.nodes ?? []).some((n) => n.positionType === 'cordo-obert'),
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

  onStageTransformChanged(t: { x: number; y: number; scaleX: number; scaleY: number }): void {
    this.stageTransform.set(t);
  }

  onTroncPanelMoved(event: { slotId: string; x: number; y: number }): void {
    this.troncPanelPositions.update((current) => {
      const next = new Map(current);
      next.set(event.slotId, { x: event.x, y: event.y });
      return next;
    });
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

  readonly pendingCordonsChange = signal<{ id: string; value: number | null; affectedCount: number } | null>(null);

  onNumberOfCordonsChanged(event: { id: string; value: number | null }): void {
    const affectedCount = this.countAssignmentsBeyondCordons(event.id, event.value);
    if (affectedCount > 0) {
      this.pendingCordonsChange.set({ id: event.id, value: event.value, affectedCount });
      return;
    }
    this.applyCordonsChange(event.id, event.value);
  }

  confirmCordonsChange(): void {
    const pending = this.pendingCordonsChange();
    if (!pending) return;
    this.applyCordonsChange(pending.id, pending.value);
    this.pendingCordonsChange.set(null);
  }

  cancelCordonsChange(): void {
    this.pendingCordonsChange.set(null);
  }

  private applyCordonsChange(id: string, value: number | null): void {
    this.assignmentService.updateCordons(id, { numberOfCordons: value }).subscribe({
      next: () => this.loadDistribution(),
      error: () => this.toast.error("No s'han pogut actualitzar els cordons."),
    });
  }

  /** Number of existing assignments on PINYA nodes that a reduced cordons value would hide (cordo-obert exempt). */
  private countAssignmentsBeyondCordons(instanceId: string, numberOfCordons: number | null): number {
    if (numberOfCordons === null) return 0;
    const item = this.items().find((i) => i.instanceId === instanceId);
    if (!item) return 0;

    const hiddenNodeIds = new Set(
      item.figureTemplate.nodes
        .filter(
          (n) =>
            n.zone === 'PINYA' &&
            n.positionType !== 'cordo-obert' &&
            n.renglaPosition !== null &&
            n.renglaPosition > numberOfCordons,
        )
        .map((n) => n.id),
    );
    if (hiddenNodeIds.size === 0) return 0;

    return item.assignments.filter((a) => hiddenNodeIds.has(a.figureNodeId)).length;
  }

  readonly pendingCordonsObertsChange = signal<{ id: string; affectedCount: number } | null>(null);

  onCordonsObertsEnabledChanged(event: { id: string; value: boolean }): void {
    if (event.value) {
      this.applyCordonsObertsChange(event.id, true);
      return;
    }
    const affectedCount = this.countCordoObertAssignments(event.id);
    if (affectedCount > 0) {
      this.pendingCordonsObertsChange.set({ id: event.id, affectedCount });
      return;
    }
    this.applyCordonsObertsChange(event.id, false);
  }

  confirmCordonsObertsChange(): void {
    const pending = this.pendingCordonsObertsChange();
    if (!pending) return;
    this.applyCordonsObertsChange(pending.id, false);
    this.pendingCordonsObertsChange.set(null);
  }

  cancelCordonsObertsChange(): void {
    this.pendingCordonsObertsChange.set(null);
  }

  private applyCordonsObertsChange(id: string, value: boolean): void {
    this.assignmentService.updateCordons(id, { cordonsObertsEnabled: value }).subscribe({
      next: () => this.loadDistribution(),
      error: () => this.toast.error("No s'han pogut actualitzar els cordons oberts."),
    });
  }

  /** Number of existing assignments on cordo-obert nodes for this instance. */
  private countCordoObertAssignments(instanceId: string): number {
    const item = this.items().find((i) => i.instanceId === instanceId);
    if (!item) return 0;

    const cordoObertNodeIds = new Set(
      item.figureTemplate.nodes.filter((n) => n.positionType === 'cordo-obert').map((n) => n.id),
    );
    if (cordoObertNodeIds.size === 0) return 0;

    return item.assignments.filter((a) => cordoObertNodeIds.has(a.figureNodeId)).length;
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
        const isFullyUnplaced = data.items.length > 0 && data.items.every((i) => i.projectionX === null);
        if (isFullyUnplaced) {
          // Real DOM measurement first — see TroncPanelMeasurerComponent (always mounted, via
          // `measurePanels`) — so the auto-layout packs figures against each other's *actual*
          // tronc panel size, not an approximation. `onSizesReady` completes this once ready.
          this.pendingPlacementItems = data.items;
          this.tryRunPendingPlacement();
          return;
        }
        this.slots.set(mapDistributionItemsToSlots(data.items));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("No s'ha pogut carregar la distribució.");
      },
    });
  }

  onSizesReady(sizes: Map<string, { width: number; height: number }>): void {
    this.measuredTroncSizes.set(sizes);
    this.tryRunPendingPlacement();
  }

  /** Runs the auto-layout once every pending (fully-unplaced) item has a measured size. */
  private tryRunPendingPlacement(): void {
    const items = this.pendingPlacementItems;
    if (!items) return;
    const sizes = this.measuredTroncSizes();
    if (!items.every((i) => sizes.has(i.instanceId))) return;

    this.slots.set(mapDistributionItemsToSlots(items, sizes));
    this.loading.set(false);
    this.pendingPlacementItems = null;
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
