import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { FigureZone } from '@muixer/shared';

type ViewMode = 'pinyes' | 'troncs';

interface TroncPanel {
  instanceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface DragState {
  panelId: string;
  startMouseX: number;
  startMouseY: number;
  startPanelX: number;
  startPanelY: number;
}

interface ResizeState {
  panelId: string;
  startMouseX: number;
  startMouseY: number;
  startWidth: number;
  startHeight: number;
}

@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    FigureCanvasComponent,
    TroncViewComponent,
    CdkTrapFocus,
  ],
  templateUrl: './projection-view.component.html',
})
export class ProjectionViewComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly layoutService = inject(LayoutService);
  private readonly projectionService = inject(ProjectionService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly FigureZone = FigureZone;

  // ── State signals ───────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly viewMode = signal<ViewMode>('pinyes');
  readonly segmentData = signal<ProjectionSegmentData | null>(null);
  readonly cursorVisible = signal(true);
  readonly helpModalOpen = signal(false);

  /** Pinya view: independently draggable/resizable tronc panels, one per figure. */
  readonly openTroncPanels = signal<TroncPanel[]>([]);

  /** Background color for projection. */
  readonly bgColor = signal<'white' | 'black'>('white');

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly gridCols = computed(() => {
    const n = this.segmentData()?.instances.length ?? 0;
    if (n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    return 3;
  });

  readonly gridRows = computed(() => {
    const n = this.segmentData()?.instances.length ?? 0;
    return Math.ceil(n / this.gridCols());
  });

  readonly itemWidthStyle = computed(() => `calc(${100 / this.gridCols()}% - 6px)`);
  readonly itemHeightStyle = computed(() => `calc(${100 / this.gridRows()}% - 6px)`);

  // ── Route params ────────────────────────────────────────────────────────────

  eventId = '';
  segmentId = '';

  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private zCounter = 60;
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];

    const qp = this.route.snapshot.queryParams['view'];
    if (qp === 'troncs') this.viewMode.set('troncs');

    this.loadSegment();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.navigateSegment('prev');
    if (event.key === 'ArrowRight') this.navigateSegment('next');
    if (event.key === 'Escape') this.handleEscape();
    if (event.key === 'f' || event.key === 'F') this.toggleBrowserFullscreen();
    if (event.key === 'e' || event.key === 'E') this.toggleViewMode();
    if (event.key === '?' || event.key === 'h' || event.key === 'H') {
      this.helpModalOpen.update((v) => !v);
    }
  }

  // ── Drag & resize ───────────────────────────────────────────────────────────

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.dragState) {
      const dx = event.clientX - this.dragState.startMouseX;
      const dy = event.clientY - this.dragState.startMouseY;
      const { panelId, startPanelX, startPanelY } = this.dragState;
      this.openTroncPanels.update((ps) =>
        ps.map((p) =>
          p.instanceId === panelId
            ? { ...p, x: Math.max(0, startPanelX + dx), y: Math.max(0, startPanelY + dy) }
            : p,
        ),
      );
    }
    if (this.resizeState) {
      const dx = event.clientX - this.resizeState.startMouseX;
      const dy = event.clientY - this.resizeState.startMouseY;
      const { panelId, startWidth, startHeight } = this.resizeState;
      this.openTroncPanels.update((ps) =>
        ps.map((p) =>
          p.instanceId === panelId
            ? { ...p, width: Math.max(300, startWidth + dx), height: Math.max(200, startHeight + dy) }
            : p,
        ),
      );
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.dragState = null;
    this.resizeState = null;
  }

  // ── Mouse / cursor management ───────────────────────────────────────────────

  onMouseMove(): void {
    this.cursorVisible.set(true);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
  }

  // ── View mode ───────────────────────────────────────────────────────────────

  toggleViewMode(): void {
    const next: ViewMode = this.viewMode() === 'pinyes' ? 'troncs' : 'pinyes';
    this.viewMode.set(next);
    this.syncQueryParam();
  }

  // ── Figure grid interactions (pinya view) ─────────────────────────────────

  onFigureDoubleClicked(instanceId: string): void {
    const existing = this.openTroncPanels().find((p) => p.instanceId === instanceId);
    if (existing) {
      this.bringPanelToFront(instanceId);
      return;
    }
    const offset = this.openTroncPanels().length * 30;
    this.zCounter++;
    this.openTroncPanels.update((ps) => [
      ...ps,
      { instanceId, x: 16 + offset, y: 100 + offset, width: 600, height: 400, zIndex: this.zCounter },
    ]);
  }

  bringPanelToFront(instanceId: string): void {
    this.zCounter++;
    const z = this.zCounter;
    this.openTroncPanels.update((ps) =>
      ps.map((p) => (p.instanceId === instanceId ? { ...p, zIndex: z } : p)),
    );
  }

  closeTroncPanel(instanceId: string): void {
    this.openTroncPanels.update((ps) => ps.filter((p) => p.instanceId !== instanceId));
  }

  onPanelDragStart(event: MouseEvent, instanceId: string): void {
    event.preventDefault();
    const panel = this.openTroncPanels().find((p) => p.instanceId === instanceId);
    if (!panel) return;
    this.bringPanelToFront(instanceId);
    this.dragState = {
      panelId: instanceId,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startPanelX: panel.x,
      startPanelY: panel.y,
    };
  }

  onPanelResizeStart(event: MouseEvent, instanceId: string): void {
    event.preventDefault();
    event.stopPropagation();
    const panel = this.openTroncPanels().find((p) => p.instanceId === instanceId);
    if (!panel) return;
    this.bringPanelToFront(instanceId);
    this.resizeState = {
      panelId: instanceId,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startWidth: panel.width,
      startHeight: panel.height,
    };
  }

  // ── Panel data accessors ──────────────────────────────────────────────────

  getPanelInstance(instanceId: string): ProjectionInstance | undefined {
    return this.segmentData()?.instances.find((i) => i.id === instanceId);
  }

  getPanelTroncNodes(instanceId: string): TroncNodeItem[] {
    return (this.getPanelInstance(instanceId)?.nodes.filter((n) => n.zone === FigureZone.TRONC) ?? []) as TroncNodeItem[];
  }

  getPanelBaseNodes(instanceId: string): TroncNodeItem[] {
    return (this.getPanelInstance(instanceId)?.nodes.filter((n) => n.zone === FigureZone.BASE) ?? []) as TroncNodeItem[];
  }

  getInstancePinyaNodes(instance: ProjectionInstance) {
    return instance.nodes.filter((n) => n.zone !== FigureZone.TRONC);
  }

  getInstanceTroncNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[];
  }

  getInstanceBaseNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[];
  }

  getInstanceName(instance: ProjectionInstance): string {
    return instance.label ?? instance.figureTemplate?.name ?? 'Figura';
  }

  getCordonsLabel(instance: ProjectionInstance): string | null {
    if (instance.numberOfCordons == null && (!instance.openCordons || instance.openCordons.length === 0)) {
      return null;
    }
    const parts: string[] = [];
    if (instance.numberOfCordons != null) {
      parts.push(`${instance.numberOfCordons}C`);
    }
    if (instance.openCordons && instance.openCordons.length > 0) {
      parts.push('CO');
    }
    return parts.join('+');
  }

  // ── Background color ────────────────────────────────────────────────────────

  toggleBgColor(): void {
    this.bgColor.update((c) => (c === 'white' ? 'black' : 'white'));
  }

  // ── Segment navigation ──────────────────────────────────────────────────────

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.segmentData();
    if (!data) return;
    const targetId =
      direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;

    const queryParams = this.viewMode() === 'troncs' ? { view: 'troncs' } : {};
    this.router.navigate(
      ['/pinyes/events', this.eventId, 'segments', targetId, 'project'],
      { queryParams },
    );
    this.segmentId = targetId;
    this.openTroncPanels.set([]);
    this.loadSegment();
  }

  goBack(): void {
    this.location.back();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private handleEscape(): void {
    if (this.helpModalOpen()) {
      this.helpModalOpen.set(false);
      return;
    }
    const panels = this.openTroncPanels();
    if (panels.length > 0) {
      const topPanel = panels.reduce((a, b) => (a.zIndex > b.zIndex ? a : b));
      this.closeTroncPanel(topPanel.instanceId);
      return;
    }
    this.goBack();
  }

  private toggleBrowserFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { /* best-effort */ });
    } else {
      document.exitFullscreen().catch(() => { /* best-effort */ });
    }
  }

  private syncQueryParam(): void {
    const queryParams = this.viewMode() === 'troncs' ? { view: 'troncs' } : { view: null };
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private loadSegment(): void {
    this.loading.set(true);
    this.projectionService.getProjection(this.eventId, this.segmentId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.segmentData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error carregant les dades de projecció');
        this.loading.set(false);
      },
    });
  }
}
