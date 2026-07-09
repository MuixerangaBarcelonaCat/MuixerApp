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
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LayoutService } from '../../../../core/services/layout.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { ProjectionService } from '../../services/projection.service';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { AttendanceStatus, AssignmentDetail, InstanceNodeItem } from '../../models/assignment.model';
import { FigureCanvasComponent, OutlineBox } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { FigureZone } from '@muixer/shared';
import { computeCordoObertOverrides } from '../../utils/cordo-obert.util';
import { computeDistributionTransform, computeInstanceNaturalExtent } from '../../utils/projection-layout.util';
import { placeNewFigure } from '../../utils/figure-placement.util';
import { computeTroncNaturalSize, TRONC_GAP_PX } from '../../utils/tronc-size.util';
import { getFigureColor } from '../../utils/figure-palette.util';

interface DistributionTroncPanel {
  instance: ProjectionInstance;
  /** CSS left/top for the container div (at natural scale, before CSS transform). */
  screenX: number;
  screenY: number;
  /** Natural (unscaled) dimensions passed to TroncViewComponent's container. */
  naturalW: number;
  naturalH: number;
  scale: number;
  color: string;
}


@Component({
  selector: 'app-projection-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LucideAngularModule,
    FigureCanvasComponent,
    TroncViewComponent,
  ],
  templateUrl: './projection-view.component.html',
  styleUrl: './projection-view.component.scss',
})
export class ProjectionViewComponent implements OnInit, AfterViewInit, OnDestroy {
  /** True when rendered inside another shell (e.g. the segment workspace's Previsualitza tab),
   *  which already owns fullscreen layout — the standalone route always leaves this false. */
  readonly embedded = input(false);

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

  /** Real Konva stage transform — updated via (stageTransformChanged) from FigureCanvasComponent. */
  private readonly stageTransform = signal({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

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

  /**
   * Per-instance world position, resolved for every instance regardless of whether a
   * distribution was ever saved: stored projectionX/Y/Angle when present, otherwise a
   * position from the placement mock (`placeNewFigure`), laid out to the right of
   * whatever is already placed (stored or previously mock-placed) so figures never
   * overlap. This replaces the old per-instance screen-splitting fallback — the
   * projection view always renders through the single unified canvas below.
   */
  readonly effectivePositions = computed((): Map<string, { x: number; y: number; angle: number }> => {
    const instances = this.filteredInstances();
    const positions = new Map<string, { x: number; y: number; angle: number }>();
    const placedExtents: { x: number; width: number }[] = [];

    for (const inst of instances) {
      if (inst.projectionX == null) continue;
      positions.set(inst.id, { x: inst.projectionX, y: inst.projectionY ?? 0, angle: inst.projectionAngle ?? 0 });
      placedExtents.push({ x: inst.projectionX, width: computeInstanceNaturalExtent(inst).width });
    }

    for (const inst of instances) {
      if (inst.projectionX != null) continue;
      const extent = computeInstanceNaturalExtent(inst);
      const placed = placeNewFigure(placedExtents, { instanceId: inst.id, ...extent });
      placedExtents.push({ x: placed.x, width: extent.width });
      positions.set(inst.id, { x: placed.x, y: placed.y, angle: placed.angle });
    }

    return positions;
  });

  /** `filteredInstances()` with every projectionX/Y/Angle resolved via `effectivePositions`. */
  readonly effectiveInstances = computed((): ProjectionInstance[] => {
    const positions = this.effectivePositions();
    return this.filteredInstances().map((inst) => {
      const pos = positions.get(inst.id);
      if (!pos) return inst;
      return { ...inst, projectionX: pos.x, projectionY: pos.y, projectionAngle: pos.angle };
    });
  });

  /**
   * All pinya/base/decoration nodes from every instance, translated into a shared
   * screen-space coordinate system using each instance's effective (stored or
   * mock-placed) distribution position.
   *
   * The distribution editor shifts the Konva group's rotation pivot to the visual
   * center of each figure's PINYA+BASE bounding box (slotGroup.offsetX/Y). The stored
   * projectionX/Y therefore represents the world position of that center, not the
   * top-left corner. Rotation must be applied around the same center.
   */
  readonly distributionNodes = computed((): InstanceNodeItem[] => {
    const instances = this.effectiveInstances();
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
  readonly distributionAssignments = computed((): AssignmentDetail[] =>
    this.effectiveInstances().flatMap((inst) => inst.assignments),
  );

  /**
   * Virtual bounding boxes (in Konva canvas units, x/y = center) for each instance's linked tronc
   * panel. Passed to FigureCanvasComponent as fitExtraBounds so the initial auto-fit reserves space
   * for the tronc panels above each figure.
   *
   * Derivation: the tronc top in canvas units =
   *   canvasCY − figHalfH × distScale − (naturalH + TRONC_GAP_PX) × distScale
   * (same geometry as distributionTroncPanels, converted from screen to canvas by dividing stageScale)
   */
  readonly distributionFitBounds = computed((): { x: number; y: number; width: number; height: number }[] => {
    const instances = this.effectiveInstances();
    const { scale: distScale, offsetX, offsetY } = computeDistributionTransform(
      instances,
      this.containerWidth(),
      this.containerHeight(),
    );

    return instances.map((inst) => {
      const { naturalW, naturalH } = this.getTroncPanelNaturalSize(inst);
      const troncW = naturalW * distScale;
      const troncH = naturalH * distScale;

      if (inst.troncPanelX != null && inst.troncPanelY != null) {
        // Detached: panel top-left is stored in world coords.
        const panelCanvasX = inst.troncPanelX * distScale + offsetX;
        const panelCanvasY = inst.troncPanelY * distScale + offsetY;
        return { x: panelCanvasX + troncW / 2, y: panelCanvasY + troncH / 2, width: troncW, height: troncH };
      }

      // Linked: panel sits above the figure's pinya top edge.
      const pinyaBaseNodes = inst.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );
      const mnY = pinyaBaseNodes.length > 0 ? Math.min(...pinyaBaseNodes.map((n) => n.y - n.height / 2)) : 0;
      const mxY = pinyaBaseNodes.length > 0 ? Math.max(...pinyaBaseNodes.map((n) => n.y + n.height / 2)) : 0;
      const figHalfH = (mxY - mnY) / 2;
      const canvasCX = (inst.projectionX ?? 0) * distScale + offsetX;
      const canvasCY = (inst.projectionY ?? 0) * distScale + offsetY;
      const troncCenterY = canvasCY - figHalfH * distScale - TRONC_GAP_PX * distScale - troncH / 2;
      return { x: canvasCX, y: troncCenterY, width: troncW, height: troncH };
    });
  });

  /**
   * Tronc panels for the distribution view.
   *
   * Positioning uses two stacked transforms:
   *   distScale/offset  — from computeDistributionTransform, converts world → canvas-world
   *                       (this is the same transform used by distributionNodes())
   *   stageScale/stageXY — real Konva stage transform, set by (stageTransformChanged)
   *
   * screen = canvasWorld * stageScale + stageXY
   *        = (world * distScale + distOffset) * stageScale + stageXY
   *
   * The overlay div is rendered at natural pixel size and scaled with CSS transform: scale(totalScale)
   * so TroncViewComponent gets full space to render and is then visually scaled down.
   */
  readonly distributionTroncPanels = computed((): DistributionTroncPanel[] => {
    const instances = this.effectiveInstances();
    const { scale: distScale, offsetX, offsetY } = computeDistributionTransform(
      instances,
      this.containerWidth(),
      this.containerHeight(),
    );
    const { x: stageX, y: stageY, scaleX: stageScale } = this.stageTransform();
    const totalScale = distScale * stageScale;

    return instances.map((inst, instIndex) => {
      const { naturalW, naturalH } = this.getTroncPanelNaturalSize(inst);

      // Figure center in canvas-world coords (matches distributionNodes() computation).
      const canvasCX = (inst.projectionX ?? 0) * distScale + offsetX;
      const canvasCY = (inst.projectionY ?? 0) * distScale + offsetY;

      // Figure center in screen coords.
      const figScreenX = canvasCX * stageScale + stageX;
      const figScreenY = canvasCY * stageScale + stageY;

      // Figure visual half-height (world coords → screen via totalScale).
      const pinyaBaseNodes = inst.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );
      const mnY = pinyaBaseNodes.length > 0 ? Math.min(...pinyaBaseNodes.map((n) => n.y - n.height / 2)) : 0;
      const mxY = pinyaBaseNodes.length > 0 ? Math.max(...pinyaBaseNodes.map((n) => n.y + n.height / 2)) : 0;
      const figHalfH = (mxY - mnY) / 2;

      let screenX: number, screenY: number;
      if (inst.troncPanelX != null && inst.troncPanelY != null) {
        // Detached: stored world position → canvas-world → screen.
        const panelCanvasX = inst.troncPanelX * distScale + offsetX;
        const panelCanvasY = inst.troncPanelY * distScale + offsetY;
        screenX = panelCanvasX * stageScale + stageX;
        screenY = panelCanvasY * stageScale + stageY;
      } else {
        // Linked: centred above figure. With CSS transform: scale(totalScale) origin top-left,
        // visual width = naturalW * totalScale, so CSS left = figScreenX - naturalW*totalScale/2.
        screenX = figScreenX - (naturalW * totalScale) / 2;
        screenY = figScreenY - figHalfH * totalScale - naturalH * totalScale - TRONC_GAP_PX * totalScale;
      }

      return { instance: inst, screenX, screenY, naturalW, naturalH, scale: totalScale, color: getFigureColor(instIndex) };
    });
  });

  /** Canvas-space outlines for each pinya/base node, rendered inside Konva below the node layer. */
  readonly distributionNodeOutlines = computed((): OutlineBox[] => {
    const instances = this.effectiveInstances();
    const { scale: distScale, offsetX, offsetY } = computeDistributionTransform(
      instances,
      this.containerWidth(),
      this.containerHeight(),
    );

    return instances.flatMap((inst, instIndex) => {
      const color = getFigureColor(instIndex);
      const projX = inst.projectionX ?? 0;
      const projY = inst.projectionY ?? 0;
      const angleRad = ((inst.projectionAngle ?? 0) * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      const pinyaBaseNodes = inst.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );
      let centerX = 0, centerY = 0;
      if (pinyaBaseNodes.length > 0) {
        const mnX = Math.min(...pinyaBaseNodes.map((n) => n.x - n.width / 2));
        const mxX = Math.max(...pinyaBaseNodes.map((n) => n.x + n.width / 2));
        const mnY = Math.min(...pinyaBaseNodes.map((n) => n.y - n.height / 2));
        const mxY = Math.max(...pinyaBaseNodes.map((n) => n.y + n.height / 2));
        centerX = (mnX + mxX) / 2;
        centerY = (mnY + mxY) / 2;
      }

      return this.getInstanceProjectionNodes(inst).map((node): OutlineBox => {
        const relX = node.x - centerX;
        const relY = node.y - centerY;
        const rotX = cosA * relX - sinA * relY;
        const rotY = sinA * relX + cosA * relY;
        return {
          x: (projX + rotX) * distScale + offsetX,
          y: (projY + rotY) * distScale + offsetY,
          width: node.width * distScale,
          height: node.height * distScale,
          rotation: (inst.projectionAngle ?? 0) + (node.rotation ?? 0),
          color,
          shape: (node as { shape?: string }).shape ?? 'RECTANGLE',
        };
      });
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
    if (!this.embedded()) {
      this.layoutService.requestFullscreen();
    }
    const params = this.route.snapshot.params;
    this.eventId = params['eventId'];
    this.segmentId = params['segmentId'];
    this.instanceId = this.embedded() ? '' : (params['instanceId'] ?? '');
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
    if (!this.embedded()) {
      this.layoutService.exitFullscreen();
    }
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

  onStageTransformChanged(t: { x: number; y: number; scaleX: number; scaleY: number }): void {
    this.stageTransform.set(t);
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

  private getTroncPanelNaturalSize(inst: ProjectionInstance): { naturalW: number; naturalH: number } {
    const troncNodes = this.getInstanceTroncNodes(inst);
    const dirNodes = this.getInstanceDirectionNodes(inst);
    const baseNodes = this.getInstanceBaseNodes(inst);
    const troncGridCols = troncNodes.reduce((max, n) => Math.max(max, n.x + n.width), 0);
    const distinctZ = new Set(troncNodes.map((n) => n.z)).size;
    const hasFigDir = dirNodes.some((n) => n.zone === FigureZone.FIGURE_DIRECTION);
    const hasXicDir = dirNodes.some((n) => n.zone === FigureZone.XICALLA_DIRECTION);
    const troncGridRows = distinctZ + (hasFigDir ? 1 : 0) + (hasXicDir ? 1 : 0);
    const gridRows = troncGridRows + (baseNodes.length > 0 ? 1 : 0);
    const { naturalW, naturalH } = computeTroncNaturalSize(troncGridCols, gridRows);
    return { naturalW, naturalH: naturalH };
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
