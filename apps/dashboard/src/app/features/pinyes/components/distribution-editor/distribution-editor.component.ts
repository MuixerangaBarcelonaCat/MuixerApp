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
import { Location } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SegmentDistributionService } from '../../services/segment-distribution.service';
import { CanvasStateService } from '../../services/canvas-state.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { FigureCanvasComponent, CompositionSlotWithNodes } from '../figure-canvas/figure-canvas.component';
import { DistributionItem, InstanceDistributionPayload } from '../../models/distribution.model';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTO_PLACE_GAP = 300;

@Component({
  selector: 'app-distribution-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FigureCanvasComponent, RouterModule],
  templateUrl: './distribution-editor.component.html',
})
export class DistributionEditorComponent implements OnInit, OnDestroy {
  private readonly distributionService = inject(SegmentDistributionService);
  private readonly canvasState = inject(CanvasStateService);
  private readonly layoutService = inject(LayoutService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly eventId = this.route.snapshot.paramMap.get('eventId')!;
  readonly segmentId = this.route.snapshot.paramMap.get('segmentId')!;

  readonly segmentName = signal<string | null>(null);
  readonly slots = signal<CompositionSlotWithNodes[]>([]);
  readonly saveStatus = signal<SaveStatus>('idle');
  readonly loading = signal(true);
  readonly selectedSlotId = signal<string | null>(null);

  readonly compositionSlots = computed(() => this.slots());

  @ViewChild(FigureCanvasComponent) private canvasRef?: FigureCanvasComponent;

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    this.canvasState.reset();
    this.loadDistribution();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
  }

  private loadDistribution(): void {
    this.distributionService.getDistribution(this.eventId, this.segmentId).subscribe({
      next: (data) => {
        this.segmentName.set(data.segment.name);
        this.slots.set(this.mapItemsToSlots(data.items));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/pinyes']);
      },
    });
  }

  private mapItemsToSlots(items: DistributionItem[]): CompositionSlotWithNodes[] {
    const hasPositions = items.some((i) => i.projectionX !== null);

    return items.map((item, index) => ({
      slotId: item.instanceId,
      label: item.label,
      offsetX: hasPositions ? (item.projectionX ?? index * AUTO_PLACE_GAP) : index * AUTO_PLACE_GAP,
      offsetY: hasPositions ? (item.projectionY ?? 0) : 0,
      sortOrder: index,
      angle: hasPositions ? (item.projectionAngle ?? 0) : 0,
      figureTemplate: {
        id: item.figureTemplate.id,
        name: item.figureTemplate.name,
        hasPinya: item.figureTemplate.nodes.some((n) => n.zone === 'PINYA'),
        nodes: item.figureTemplate.nodes,
      },
    }));
  }

  onSlotSelected(slotId: string | null): void {
    this.selectedSlotId.set(slotId);
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

  fitAll(): void {
    this.canvasRef?.fitAllSlots();
  }

  async clearDistribution(): Promise<void> {
    this.distributionService.clearDistribution(this.eventId, this.segmentId).subscribe({
      next: () => this.goBack(),
      error: () => this.saveStatus.set('error'),
    });
  }

  goBack(): void {
    this.location.back();
  }

  get gridEnabled(): boolean { return this.canvasState.gridEnabled(); }
  get gridSpacing(): number { return this.canvasState.gridSpacing(); }
  get snapToGrid(): boolean { return this.canvasState.snapToGrid(); }

  toggleGrid(): void { this.canvasState.gridEnabled.set(!this.canvasState.gridEnabled()); }
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

  private save(): void {
    const items: InstanceDistributionPayload[] = this.slots().map((s) => ({
      instanceId: s.slotId,
      x: s.offsetX,
      y: s.offsetY,
      angle: s.angle ?? 0,
      troncPanelX: null,
      troncPanelY: null,
      troncPanelWidth: null,
      troncPanelHeight: null,
    }));

    this.saveStatus.set('saving');
    this.distributionService.saveDistribution(this.eventId, this.segmentId, items).subscribe({
      next: () => this.saveStatus.set('saved'),
      error: () => this.saveStatus.set('error'),
    });
  }
}
