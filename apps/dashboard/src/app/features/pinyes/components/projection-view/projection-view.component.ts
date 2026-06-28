import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { AttendanceStatus, AssignmentDetail, InstanceNodeItem } from '../../models/assignment.model';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { FigureZone } from '@muixer/shared';
import { ICON_FIGURA_NETA } from '../../../../shared/constants/domain-icons';
import { computeCordoObertOverrides } from '../../utils/cordo-obert.util';
import { computeProjectionLayout, computeDistributionLayout, computeDistributionTransform, ProjectionCell, DistributionCell } from '../../utils/projection-layout.util';

// Natural size constants matching TroncViewComponent's CSS grid:
// 1 grid unit = 2 half-units, each half-unit min 40px (2.5rem) → 80px per grid unit.
// Label column adds another 40px.
const TRONC_HALF_UNIT_PX = 40;
const TRONC_LABEL_COL_PX = 40;
const TRONC_FLOOR_ROW_PX = 48;
const TRONC_HEADER_PX = 32;
const TRONC_GAP_PX = 16;

interface DistributionTroncPanel {
  instance: ProjectionInstance;
  /** CSS left/top for the container div (at natural scale, before CSS transform). */
  screenX: number;
  screenY: number;
  /** Natural (unscaled) dimensions passed to TroncViewComponent's container. */
  naturalW: number;
  naturalH: number;
  scale: number;
}

@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    FigureCanvasComponent,
    TroncViewComponent,
  ],
  templateUrl: './projection-view.component.html',
  styleUrl: './projection-view.component.scss',
})
export class ProjectionViewComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly ICON_FIGURA_NETA = ICON_FIGURA_NETA;

  @ViewChild('figuresContainer') private readonly figuresContainerRef!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layoutService = inject(LayoutService);
  private readonly projectionService = inject(ProjectionService);
  private readonly toast = inject(ToastService);

  // ── State signals ───────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly segmentData = signal<ProjectionSegmentData | null>(null);
  readonly cursorVisible = signal(true);
  readonly helpModalOpen = signal(false);

  /** Actual pixel size of the figures container (updated by ResizeObserver). */
  private readonly containerWidth = signal(window.innerWidth);
  private readonly containerHeight = signal(window.innerHeight);

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly filteredInstances = computed(() => {
    const instances = this.segmentData()?.instances ?? [];
    return this.instanceId ? instances.filter((i) => i.id === this.instanceId) : instances;
  });

  /** personId → attendanceStatus, derived from the projection response. */
  readonly attendanceMap = computed(() => {
    const map = new Map<string, AttendanceStatus>();
    const pa = this.segmentData()?.personAttendance;
    if (pa) {
      for (const [personId, status] of Object.entries(pa)) {
        map.set(personId, status as AttendanceStatus);
      }
    }
    return map;
  });

  readonly hasDistribution = computed(() => this.segmentData()?.hasDistribution ?? false);

  /** Absolute-positioned layout cells, one per instance. Used when no distribution is set. */
  readonly layout = computed(() =>
    computeProjectionLayout(
      this.filteredInstances(),
      this.containerWidth(),
      this.containerHeight(),
    ),
  );

  readonly cellsById = computed(() => {
    const m = new Map<string, ProjectionCell>();
    for (const cell of this.layout()) m.set(cell.instanceId, cell);
    return m;
  });

  /** Distribution-mode cells keyed by instanceId. Empty when no distribution is active. */
  readonly distributionCellsById = computed((): Map<string, DistributionCell> => {
    if (!this.hasDistribution()) return new Map();
    const m = new Map<string, DistributionCell>();
    for (const cell of computeDistributionLayout(
      this.filteredInstances(),
      this.containerWidth(),
      this.containerHeight(),
    )) {
      m.set(cell.instanceId, cell);
    }
    return m;
  });

  /**
   * All pinya/base/decoration nodes from every instance, translated into a shared
   * screen-space coordinate system using each instance's stored distribution position.
   * Empty when no distribution is active.
   *
   * The distribution editor shifts the Konva group's rotation pivot to the visual
   * center of each figure's PINYA+BASE bounding box (slotGroup.offsetX/Y). The stored
   * projectionX/Y therefore represents the world position of that center, not the
   * top-left corner. Rotation must be applied around the same center.
   */
  readonly distributionNodes = computed((): InstanceNodeItem[] => {
    if (!this.hasDistribution()) return [];
    const instances = this.filteredInstances();
    const { scale, offsetX, offsetY } = computeDistributionTransform(
      instances,
      this.containerWidth(),
      this.containerHeight(),
    );
    const result: InstanceNodeItem[] = [];
    for (const inst of instances) {
      const projX = inst.projectionX ?? 0;
      const projY = inst.projectionY ?? 0;
      const angleRad = ((inst.projectionAngle ?? 0) * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      // Compute the figure's rotation pivot — the center of its PINYA+BASE bounding box.
      // This matches the offsetX/Y the distribution editor applies to the Konva group.
      const pinyaBaseNodes = inst.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );
      let centerX = 0;
      let centerY = 0;
      if (pinyaBaseNodes.length > 0) {
        const mnX = Math.min(...pinyaBaseNodes.map((n) => n.x - n.width / 2));
        const mxX = Math.max(...pinyaBaseNodes.map((n) => n.x + n.width / 2));
        const mnY = Math.min(...pinyaBaseNodes.map((n) => n.y - n.height / 2));
        const mxY = Math.max(...pinyaBaseNodes.map((n) => n.y + n.height / 2));
        centerX = (mnX + mxX) / 2;
        centerY = (mnY + mxY) / 2;
      }

      for (const node of this.getInstanceProjectionNodes(inst)) {
        const relX = node.x - centerX;
        const relY = node.y - centerY;
        const rotX = cosA * relX - sinA * relY;
        const rotY = sinA * relX + cosA * relY;
        result.push({
          ...node,
          x: (projX + rotX) * scale + offsetX,
          y: (projY + rotY) * scale + offsetY,
          width: node.width * scale,
          height: node.height * scale,
          rotation: node.rotation + (inst.projectionAngle ?? 0),
        });
      }
    }
    return result;
  });

  /** Combined assignments from all instances for the unified distribution canvas. */
  readonly distributionAssignments = computed((): AssignmentDetail[] => {
    if (!this.hasDistribution()) return [];
    return this.filteredInstances().flatMap((inst) => inst.assignments);
  });

  /** Tronc panels positioned in screen space for the distribution view. */
  readonly distributionTroncPanels = computed((): DistributionTroncPanel[] => {
    if (!this.hasDistribution()) return [];
    const instances = this.filteredInstances();
    const { scale, offsetX, offsetY } = computeDistributionTransform(
      instances,
      this.containerWidth(),
      this.containerHeight(),
    );

    return instances.flatMap((inst) => {
      const troncNodes = this.getInstanceTroncNodes(inst);
      const dirNodes = this.getInstanceDirectionNodes(inst);
      if (troncNodes.length === 0 && dirNodes.length === 0) return [];

      const troncGridCols = troncNodes.reduce((max, n) => Math.max(max, n.x + n.width), 0);
      const distinctZ = new Set(troncNodes.map((n) => n.z)).size;
      const hasFigDir = dirNodes.some((n) => n.zone === FigureZone.FIGURE_DIRECTION);
      const hasXicDir = dirNodes.some((n) => n.zone === FigureZone.XICALLA_DIRECTION);
      const troncGridRows = distinctZ + (hasFigDir ? 1 : 0) + (hasXicDir ? 1 : 0);
      if (troncGridCols === 0 || troncGridRows === 0) return [];

      // Natural pixel size matching TroncViewComponent's CSS grid minimum:
      // 1 grid unit = 2 half-units × TRONC_HALF_UNIT_PX, plus a label column.
      const naturalW = troncGridCols * 2 * TRONC_HALF_UNIT_PX + TRONC_LABEL_COL_PX;
      const naturalH = troncGridRows * TRONC_FLOOR_ROW_PX + TRONC_HEADER_PX;

      let screenX: number, screenY: number;
      if (inst.troncPanelX != null && inst.troncPanelY != null) {
        screenX = inst.troncPanelX * scale + offsetX;
        screenY = inst.troncPanelY * scale + offsetY;
      } else {
        const pinyaBaseNodes = inst.nodes.filter(
          (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
        );
        const mnY = pinyaBaseNodes.length > 0 ? Math.min(...pinyaBaseNodes.map((n) => n.y - n.height / 2)) : 0;
        const mxY = pinyaBaseNodes.length > 0 ? Math.max(...pinyaBaseNodes.map((n) => n.y + n.height / 2)) : 0;
        const figHalfH = (mxY - mnY) / 2;
        const figScreenX = (inst.projectionX ?? 0) * scale + offsetX;
        const figScreenY = (inst.projectionY ?? 0) * scale + offsetY;
        // left/top set to the CSS position of the container at natural size.
        // CSS transform: scale(scale) with transform-origin top-left keeps top-left fixed,
        // so visual center X = screenX + naturalW*scale/2 aligns with figure center.
        screenX = figScreenX - (naturalW * scale) / 2;
        screenY = figScreenY - figHalfH * scale - naturalH * scale - TRONC_GAP_PX * scale;
      }

      return [{ instance: inst, screenX, screenY, naturalW, naturalH, scale }];
    });
  });

  // ── Route params ────────────────────────────────────────────────────────────

  eventId = '';
  segmentId = '';
  instanceId = '';

  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];
    this.instanceId = params['instanceId'] ?? '';
    this.loadSegment();
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        this.containerWidth.set(rect.width);
        this.containerHeight.set(rect.height);
      }
    });
    this.resizeObserver.observe(this.figuresContainerRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.resizeObserver?.disconnect();
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.navigateSegment('prev');
    if (event.key === 'ArrowRight') this.navigateSegment('next');
    if (event.key === 'Escape') this.handleEscape();
    if (event.key === 'f' || event.key === 'F') this.toggleBrowserFullscreen();
    if (event.key === '?' || event.key === 'h' || event.key === 'H') {
      this.helpModalOpen.update((v) => !v);
    }
  }

  // ── Mouse / cursor management ───────────────────────────────────────────────

  onMouseMove(): void {
    this.cursorVisible.set(true);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    this.cursorTimer = setTimeout(() => this.cursorVisible.set(false), 3000);
  }

  // ── Node data accessors ───────────────────────────────────────────────────

  /** Nodes to render on the Konva canvas: PINYA + BASE + DECORATION (spatial x,y nodes).
   *  Excludes TRONC/DIRECTION (shown in tronc header) and unassigned PINYA nodes.
   *  BASE nodes are excluded for REMAT and NETA modes.
   *  Assigned cordo-obert nodes collapse to the first empty slot in their rengla. */
  getInstanceProjectionNodes(instance: ProjectionInstance): InstanceNodeItem[] {
    const assignedNodeIds = new Set(instance.assignments.map((a) => a.node.id));
    const hideBase = instance.figureMode === 'REMAT';
    const overrides = computeCordoObertOverrides(
      instance.nodes,
      (co, others) =>
        assignedNodeIds.has(co.id)
          ? others.find((n) => !assignedNodeIds.has(n.id))
          : undefined,
    );

    return instance.nodes
      .filter((n) =>
        (n.zone === FigureZone.PINYA || (!hideBase && n.zone === FigureZone.BASE) || n.zone === FigureZone.DECORATION) &&
        !(n.zone === FigureZone.PINYA && !assignedNodeIds.has(n.id)),
      )
      .map((n) => {
        const pos = overrides.get(n.id);
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      });
  }

  getInstanceTroncNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[];
  }

  getInstanceBaseNodes(instance: ProjectionInstance): TroncNodeItem[] {
    if (instance.figureMode === 'REMAT') return [];
    return instance.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[];
  }

  getInstanceDirectionNodes(instance: ProjectionInstance): TroncNodeItem[] {
    return instance.nodes.filter(
      (n) => n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION,
    ) as TroncNodeItem[];
  }

  isNetaFigure(instance: ProjectionInstance): boolean {
    return instance.figureTemplate?.hasPinya === false || instance.figureMode === 'REMAT' || instance.figureMode === 'NETA';
  }

  getInstanceName(instance: ProjectionInstance): string {
    const base = instance.label ?? instance.figureTemplate?.name ?? 'Figura';
    if (instance.figureMode === 'PEU') return `Peu de ${base}`;
    if (instance.figureMode === 'REMAT') return `Remat de ${base}`;
    if (instance.figureMode === 'NETA') return `${base} ${this.netaSuffix(base)}`;
    return base;
  }

  private netaSuffix(name: string): string {
    const firstWord = name.trim().split(/\s+/)[0] ?? '';
    return firstWord.endsWith('a') ? 'neta' : 'net';
  }

  // ── Segment navigation ──────────────────────────────────────────────────────

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.segmentData();
    if (!data) return;
    const targetId = direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;
    this.router.navigate(['/pinyes/events', this.eventId, 'segments', targetId, 'project']);
    this.segmentId = targetId;
    this.loadSegment();
  }

  goBack(): void {
    this.router.navigate(['/events', this.eventId]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private handleEscape(): void {
    if (this.helpModalOpen()) {
      this.helpModalOpen.set(false);
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

  private loadSegment(): void {
    this.loading.set(true);
    this.projectionService.getProjection(this.eventId, this.segmentId).subscribe({
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
