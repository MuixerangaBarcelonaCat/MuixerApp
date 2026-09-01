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
import { FigureZone, ImportScope, getSegmentInstanceLabel } from '@muixer/shared';
import { AttendanceStatus, AssignmentDetail, InstanceNodeItem } from '../../models/assignment.model';
import { ProjectionSegmentData, ProjectionInstance } from '../../models/projection.model';
import { FigureCanvasComponent, OutlineBox } from '../figure-canvas/figure-canvas.component';
import { TroncViewComponent, TroncNodeItem } from '../tronc-view/tronc-view.component';
import { computeCordoObertOverrides } from '../../utils/cordo-obert.util';
import { computeDistributionTransform, computeInstanceNaturalExtent } from '../../utils/projection-layout.util';
import { figureExtentFromNodes, placeFigures, placeNewFigure, PlacedFigurePosition } from '../../utils/figure-placement.util';
import { computeTroncNaturalSize, TRONC_GAP_PX } from '../../utils/tronc-size.util';
import { getFigureColor, SINGLE_FIGURE_PANEL_COLOR, SINGLE_FIGURE_SHADOW_COLOR } from '../../utils/figure-palette.util';
import { describeOwnPlacement, findOwnPlacements, findOwnTroncCellRect } from '../../utils/own-position.util';
import { BoundsNode } from '../../utils/fit-to-bounds.util';
import { OwnPositionBannerComponent, OwnPositionBannerState } from '../own-position-banner/own-position-banner.component';
import { MarkerTarget, OwnPositionMarkerComponent } from '../own-position-marker/own-position-marker.component';

/** Absolute (distScale-normalised — see `flyTo`) Troba'm flight caps: a pinya/base node lands
 *  tight, a tronc panel lands looser so the davall/damunt names stay in frame. Exported so tests
 *  assert against the real value instead of duplicating it as a literal that can drift out of sync. */
export const PINYA_FLIGHT_MAX_SCALE = 1.5;
export const TRONC_FLIGHT_MAX_SCALE = 2;

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
  imports: [CommonModule, FigureCanvasComponent, TroncViewComponent, OwnPositionBannerComponent, OwnPositionMarkerComponent],
  templateUrl: './pinya-projection.component.html',
})
export class PinyaProjectionComponent {
  readonly data = input.required<ProjectionSegmentData>();

  /** Restricts rendering to a single figure. `null` renders the whole segment. */
  readonly instanceId = input<string | null>(null);

  /** Forwarded to FigureCanvasComponent — see its own doc comment. */
  readonly showZoomControls = input<boolean>(true);

  /**
   * The viewer's own `Person.id` — enables the "you are here" banner. `null` (the default, and
   * what the Dashboard always passes) leaves the whole layer inert; only the PWA sets this.
   */
  readonly highlightPersonId = input<string | null>(null);

  /** Import preview scope — `PINYA` hides the tronc panel (nothing to preview yet). `null`/`ALL` unchanged. */
  readonly scope = input<ImportScope | null>(null);

  /** Signal query: the element only exists while the host renders (always, once
   *  `data` is set), but kept as a query for parity with the ResizeObserver
   *  attach/detach pattern used elsewhere in this canvas family. */
  private readonly figuresContainer = viewChild<ElementRef<HTMLDivElement>>('figuresContainer');

  /** For imperatively calling flyToBounds()/cancelFlight() — see `maybeFlyOnArrival`/`onTroba`. */
  private readonly figureCanvas = viewChild<FigureCanvasComponent>('figureCanvas');

  // ── State signals ───────────────────────────────────────────────────────────

  /** Actual pixel size of the figures container (updated by ResizeObserver). */
  protected readonly containerWidth = signal(window.innerWidth);
  protected readonly containerHeight = signal(window.innerHeight);

  /** Real Konva stage transform — updated via (stageTransformChanged) from FigureCanvasComponent. */
  protected readonly stageTransform = signal({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  /** Bumped on every `(flightLanded)` from the canvas — drives the marker's one-shot arrival bounce. */
  protected readonly arrivedTick = signal(0);

  /** The placement key `maybeFlyOnArrival` last flew to, so arrival-flight fires once per placement
   *  (new segment, new own-position) rather than on every subsequent stage-transform tick — see
   *  its own doc comment for why this can't be a plain `effect()` on `ownFlightBounds()`. */
  private hasFlownForKey: string | null = null;

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly filteredInstances = computed(() => {
    const instances = this.data().instances;
    const id = this.instanceId();
    return id ? instances.filter((i) => i.id === id) : instances;
  });

  /**
   * Every assignment `highlightPersonId` holds in this segment, against the raw, unfiltered
   * `data()` — deliberately not `filteredInstances()`, which exists for the Dashboard's
   * single-figure preview route (`instanceId`) and would silently misreport
   * `figureName`/`instanceIndex` if a placement happened to live outside the filter. The two
   * inputs are never set together in practice (the Dashboard never passes `highlightPersonId`,
   * the PWA never sets `instanceId`), so this only matters for correctness, not behaviour today.
   */
  private readonly ownPlacements = computed(() => {
    const personId = this.highlightPersonId();
    return personId ? findOwnPlacements(this.data(), personId) : [];
  });

  /** The "you are here" banner state — see `ownPlacements` for why it reads raw `data()`. */
  readonly ownPositionState = computed((): OwnPositionBannerState | null => {
    if (!this.highlightPersonId()) return null;

    const placements = this.ownPlacements();
    if (placements.length === 0) return { kind: 'NONE' };
    if (placements.length > 1) return { kind: 'MULTIPLE' };

    return describeOwnPlacement(placements[0], this.data().instances.length);
  });

  /**
   * Where the marker points: the caller's node in `distributionNodes()` (batch-placement-adjusted
   * canvas-world coords) for a PINYA/BASE placement, or the centre of the caller's own cell inside
   * the matching tronc panel (`findOwnTroncCellRect`, converted from natural to screen space with
   * the panel's own `screenX/screenY/scale`) for a TRONC/direction one — deliberately not the
   * panel as a whole, which stays reserved for the phase 5 flight destination. `null` whenever the
   * banner isn't showing a single resolved placement (no placement, more than one, or no
   * `highlightPersonId`).
   */
  readonly ownPositionTarget = computed((): MarkerTarget | null => {
    const placements = this.ownPlacements();
    const state = this.ownPositionState();
    if (placements.length !== 1 || !state || (state.kind !== 'PINYA' && state.kind !== 'TRONC')) return null;

    const [placement] = placements;
    if (state.kind === 'TRONC') {
      const panel = this.distributionTroncPanels().find((p) => p.instance.id === placement.instance.id);
      if (!panel) return null;
      const cell = findOwnTroncCellRect(placement.node, placement.instance);
      return {
        kind: 'screen',
        x: panel.screenX + (cell.x + cell.width / 2) * panel.scale,
        y: panel.screenY + (cell.y + cell.height / 2) * panel.scale,
      };
    }

    const distNode = this.distributionNodes().find((n) => n.id === placement.node.id);
    return distNode ? { kind: 'world', x: distNode.x, y: distNode.y } : null;
  });

  /**
   * Identifies *which* placement is currently resolved (`instanceId:nodeId`), so
   * `maybeFlyOnArrival` can tell "a genuinely new placement to fly to" apart from "the same
   * placement, stage transform just ticked" — the latter happens on every pan/zoom frame,
   * including the ones the flight itself produces. `null` whenever there's nothing to fly to.
   */
  private readonly ownPlacementKey = computed((): string | null => {
    const placements = this.ownPlacements();
    if (placements.length !== 1) return null;
    const [{ instance, node }] = placements;
    return `${instance.id}:${node.id}`;
  });

  /**
   * The flight's destination, in canvas-world units (unlike `ownPositionTarget`, which is
   * screen-space for the ring): the caller's node, tight, for PINYA/BASE — or the caller's
   * **whole tronc panel** for TRONC/direction, deliberately not the cell `ownPositionTarget`
   * uses, so davall/damunt names stay legible on arrival (derivation 3 in the plan). Reuses
   * `distributionFitBounds()`, which is already expressed in canvas-world units independent of
   * the live stage transform — the same reason `ownPlacementKey` exists: nothing here may depend
   * on `stageTransform()`, or a flight would retrigger itself every frame it's flying.
   */
  readonly ownFlightBounds = computed((): BoundsNode[] | null => {
    const placements = this.ownPlacements();
    const state = this.ownPositionState();
    if (placements.length !== 1 || !state || (state.kind !== 'PINYA' && state.kind !== 'TRONC')) return null;

    const [placement] = placements;
    if (state.kind === 'TRONC') {
      const instances = this.effectiveInstances();
      const idx = instances.findIndex((i) => i.id === placement.instance.id);
      const bounds = idx >= 0 ? this.distributionFitBounds()[idx] : null;
      return bounds ? [bounds] : null;
    }

    const distNode = this.distributionNodes().find((n) => n.id === placement.node.id);
    return distNode ? [{ x: distNode.x, y: distNode.y, width: distNode.width, height: distNode.height }] : null;
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
    if (this.scope() === ImportScope.PINYA) return [];
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
    if (this.scope() === ImportScope.PINYA) return [];
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
    this.maybeFlyOnArrival();
  }

  /**
   * Flies to `ownFlightBounds()` once per placement — on the *first* stage-transform tick after
   * it resolves, not the moment it resolves. `FigureCanvasComponent` applies its own instant
   * whole-segment fit on data load (`applyReadonlyFit`, scheduled via `setTimeout` from
   * `renderNodes()`), which would otherwise race an arrival flight started eagerly from an
   * `effect()` and stomp it mid-tween. Piggybacking on the first `(stageTransformChanged)` after
   * a new `ownPlacementKey` sidesteps the race entirely: that event **is** the whole-segment fit
   * completing, so the flight is guaranteed to start after it, not during it.
   */
  private maybeFlyOnArrival(): void {
    const key = this.ownPlacementKey();
    if (!key || key === this.hasFlownForKey) return;
    const bounds = this.ownFlightBounds();
    if (!bounds) return;

    this.hasFlownForKey = key;
    this.flyTo(bounds);
  }

  /** Troba'm (banner button) and the chevron tap both re-fly to the current placement on demand. */
  onTroba(): void {
    const bounds = this.ownFlightBounds();
    if (bounds) this.flyTo(bounds);
  }

  /** Bumps the tick the marker watches to fire its one-shot arrival bounce. */
  onFlightLanded(): void {
    this.arrivedTick.update((n) => n + 1);
  }

  /**
   * `bounds` (canvas-world units) already carry `distScale` — `computeDistributionTransform`'s
   * own uncapped fit-the-whole-segment scale, baked into every node's x/y/width/height by
   * `distributionNodes()`/`distributionFitBounds()`. It varies a lot: a segment with one small
   * figure gets a *large* `distScale` (blown up to fill the viewport on its own), a segment with
   * several spread-out figures gets a *small* one. `flyToBounds`'s `maxScale` caps the Konva
   * stage scale it lands on — a *literal* cap there would therefore cap a different absolute
   * on-screen size per segment: capped-and-small for a low-`distScale` segment, effectively
   * uncapped (fills to the framing target normally) for a high-`distScale` one, which is exactly
   * the "some figures end up far bigger than others after Troba'm" bug. Dividing the intended
   * absolute cap by `distScale` here keeps the *combined* `distScale × flightScale` — the actual
   * physical size on screen — the same regardless of what else is in the segment.
   */
  private flyTo(bounds: BoundsNode[]): void {
    const { scale: distScale } = computeDistributionTransform(
      this.effectiveInstances(),
      this.containerWidth(),
      this.containerHeight(),
    );
    const options =
      this.ownPositionState()?.kind === 'PINYA'
        ? { maxScale: PINYA_FLIGHT_MAX_SCALE / distScale }
        : { padding: 32, maxScale: TRONC_FLIGHT_MAX_SCALE / distScale };
    this.figureCanvas()?.flyToBounds(bounds, options);
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
    return getSegmentInstanceLabel(instance);
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
