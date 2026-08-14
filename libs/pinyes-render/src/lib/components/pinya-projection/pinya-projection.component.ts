import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FigureZone } from '@muixer/shared';
import { AttendanceStatus, AssignmentDetail, InstanceNodeItem } from '../../models/assignment.model';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { FigureCanvasComponent, OutlineBox } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { computeCordoObertOverrides } from '../../utils/cordo-obert.util';
import { computeDistributionTransform, computeInstanceNaturalExtent } from '../../utils/projection-layout.util';
import { figureExtentFromNodes, placeFigures, placeNewFigure, PlacedFigurePosition } from '../../utils/figure-placement.util';
import { computeTroncNaturalSize, TRONC_GAP_PX } from '../../utils/tronc-size.util';
import { getFigureColor, SINGLE_FIGURE_PANEL_COLOR, SINGLE_FIGURE_SHADOW_COLOR } from '../../utils/figure-palette.util';

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
  borderColor: string;
}

/**
 * Presentational rendering of a segment's projection: the unified figures
 * canvas plus each figure's tronc panel overlay. Consumed by the Dashboard's
 * `ProjectionViewComponent` (standalone route + embedded Previsualitza tab)
 * and the PWA's segment-projection screen — neither owns fetch/fullscreen/
 * routing concerns, both just hand it fetched data.
 */
@Component({
  selector: 'lib-pinya-projection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [CommonModule, FigureCanvasComponent, TroncViewComponent],
  templateUrl: './pinya-projection.component.html',
})
export class PinyaProjectionComponent {
  readonly data = input.required<ProjectionSegmentData>();

  /** Restricts rendering to a single figure. `null` renders the whole segment. */
  readonly instanceId = input<string | null>(null);

  /** Signal query: the element only exists while the host renders (always, once
   *  `data` is set), but kept as a query for parity with the ResizeObserver
   *  attach/detach pattern used elsewhere in this canvas family. */
  private readonly figuresContainer = viewChild<ElementRef<HTMLDivElement>>('figuresContainer');

  // ── State signals ───────────────────────────────────────────────────────────

  /** Actual pixel size of the figures container (updated by ResizeObserver). */
  private readonly containerWidth = signal(window.innerWidth);
  private readonly containerHeight = signal(window.innerHeight);

  /** Real Konva stage transform — updated via (stageTransformChanged) from FigureCanvasComponent. */
  private readonly stageTransform = signal({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly filteredInstances = computed(() => {
    const instances = this.data().instances;
    const id = this.instanceId();
    return id ? instances.filter((i) => i.id === id) : instances;
  });

  /**
   * Person IDs in conflict for this segment (D13) — the last line of defence during l'assaig.
   * Single amber style regardless of kind. Empty in production until Phase 5.
   */
  readonly conflictPersonIds = computed(
    () => new Set((this.data().conflicts ?? []).map((c) => c.personId)),
  );

  /** personId → attendanceStatus, derived from the projection response. */
  readonly attendanceMap = computed(() => {
    const map = new Map<string, AttendanceStatus>();
    const pa = this.data().personAttendance;
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
  /**
   * Space-optimizing placements for fully-unplaced segments, built from the
   * same inputs as the Distribució tab (`mapDistributionItemsToSlots`): pinya
   * canvas node extents plus the derived tronc panel size (including the base
   * row). Empty when any instance has a saved position.
   *
   * The pivot node set (`nodes`, defining each figure's placed x/y) MUST be
   * raw, unfiltered PINYA+BASE — exactly what `distributionNodes` uses as its
   * Konva rotation pivot (see its doc comment). Using any other set (assigned-
   * only PINYA, or including DECORATION) shifts the figure's actual rendered
   * position away from what placement assumed, misaligning the tronc panel
   * against real nodes — including the figure's own BASE row. Decoration and
   * assignment status still matter for `occupiedNodes`: they block tronc
   * placement without affecting the pivot.
   */
  private readonly batchPlacements = computed((): Map<string, PlacedFigurePosition> => {
    const instances = this.filteredInstances();
    if (instances.length === 0 || instances.some((inst) => inst.projectionX != null)) {
      return new Map();
    }
    const specs = instances.map((inst) => {
      const pivotNodes = inst.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );
      const occupiedNodes = this.getInstanceProjectionNodes(inst);
      const { naturalW, naturalH } = this.getTroncPanelNaturalSize(inst);
      return {
        ...figureExtentFromNodes(inst.id, pivotNodes),
        nodes: pivotNodes,
        occupiedNodes,
        tronc: { width: naturalW, height: naturalH },
      };
    });
    return new Map(placeFigures(specs).map((p) => [p.instanceId, p]));
  });

  readonly effectivePositions = computed((): Map<string, { x: number; y: number; angle: number }> => {
    const instances = this.filteredInstances();
    const positions = new Map<string, { x: number; y: number; angle: number }>();
    const placedExtents: { x: number; width: number }[] = [];

    for (const inst of instances) {
      if (inst.projectionX == null) continue;
      positions.set(inst.id, { x: inst.projectionX, y: inst.projectionY ?? 0, angle: inst.projectionAngle ?? 0 });
      placedExtents.push({ x: inst.projectionX, width: computeInstanceNaturalExtent(inst).width });
    }

    // Fully-unplaced segment → same layout Distribució shows.
    const batch = this.batchPlacements();
    if (batch.size > 0) {
      for (const placed of batch.values()) {
        positions.set(placed.instanceId, { x: placed.x, y: placed.y, angle: placed.angle });
      }
      return positions;
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
    const batch = this.batchPlacements();
    return this.filteredInstances().map((inst) => {
      const pos = positions.get(inst.id);
      if (!pos) return inst;
      const placed = batch.get(inst.id);
      return {
        ...inst,
        projectionX: pos.x,
        projectionY: pos.y,
        projectionAngle: pos.angle,
        troncPanelX: inst.troncPanelX ?? placed?.troncPanelX ?? null,
        troncPanelY: inst.troncPanelY ?? placed?.troncPanelY ?? null,
      };
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
    const singleFigure = instances.length === 1;

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

      const color = singleFigure ? SINGLE_FIGURE_PANEL_COLOR : getFigureColor(instIndex);
      const borderColor = singleFigure ? SINGLE_FIGURE_SHADOW_COLOR : color;
      return { instance: inst, screenX, screenY, naturalW, naturalH, scale: totalScale, color, borderColor };
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

    const singleFigure = instances.length === 1;

    return instances.flatMap((inst, instIndex) => {
      const color = singleFigure ? SINGLE_FIGURE_SHADOW_COLOR : getFigureColor(instIndex);
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

  constructor() {
    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        this.containerWidth.set(rect.width);
        this.containerHeight.set(rect.height);
      }
    });
    effect((onCleanup) => {
      const el = this.figuresContainer()?.nativeElement;
      resizeObserver.disconnect();
      if (el) resizeObserver.observe(el);
      onCleanup(() => resizeObserver.disconnect());
    });
  }

  onStageTransformChanged(t: { x: number; y: number; scaleX: number; scaleY: number }): void {
    this.stageTransform.set(t);
  }

  // ── Node data accessors ───────────────────────────────────────────────────

  /** Nodes to render on the Konva canvas: PINYA + BASE + DECORATION (spatial x,y nodes).
   *  Excludes TRONC/DIRECTION (shown in tronc header) and unassigned PINYA nodes.
   *  BASE nodes are excluded for REMAT and NETA modes.
   *  PINYA nodes beyond numberOfCordons are excluded even if (stale-)assigned —
   *  reducing cordons does not auto-unassign anyone server-side, but the
   *  structure physically doesn't have that cordon anymore. cordo-obert nodes
   *  are exempt (matches Distribució's filterNodesByFigureMode keepCordoObert).
   *  Assigned cordo-obert nodes collapse to the first empty slot in their rengla. */
  getInstanceProjectionNodes(instance: ProjectionInstance): InstanceNodeItem[] {
    const assignedNodeIds = new Set(instance.assignments.map((a) => a.node.id));
    const hideBase = instance.figureMode === 'REMAT';
    const cordons = instance.numberOfCordons;
    const withinCordons = (n: InstanceNodeItem) =>
      cordons === null ||
      n.positionType === 'cordo-obert' ||
      !n.renglaId ||
      n.renglaPosition === null ||
      n.renglaPosition <= cordons;
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
        !(n.zone === FigureZone.PINYA && !assignedNodeIds.has(n.id)) &&
        (n.zone !== FigureZone.PINYA || withinCordons(n)),
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
}
