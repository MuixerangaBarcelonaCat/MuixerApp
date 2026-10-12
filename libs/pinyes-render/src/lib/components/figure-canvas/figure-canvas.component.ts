import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Konva from 'konva';
import { FONT_FAMILY } from '@muixer/ui';
import { FigureNodeItem } from '../../models/figure-template.model';
import { FigureZone, NodeShape, EventPhase, Gender } from '@muixer/shared';
import { AssignmentDetail, AttendanceStatus, AvailablePersonPosition, HeightMode, PersonHoverInfo } from '../../models/assignment.model';
import { PersonHoverCardComponent } from '../person-hover-card/person-hover-card.component';
import {
  calculateGhostPosition,
  isGhostEligible,
  isGhostPositionOccupied,
} from '../../utils/ghost-clone.util';
import { screenToStage } from '../../utils/rengla-coordinates.util';
import { BoundsNode, computeFitTransform } from '../../utils/fit-to-bounds.util';
import { formatAssignedLabel } from '../../utils/assigned-label.util';
import { computeTroncNaturalSize, TRONC_GAP_PX } from '../../utils/tronc-size.util';
import { getFigureColor } from '../../utils/figure-palette.util';
import { withAlpha } from '../../theme/canvas-theme';
import { injectCanvasTheme } from '../../theme/inject-canvas-theme';
import { nodeFill } from '../../theme/node-color';
import { attendanceVisual } from '../../node-render/attendance';
import { NodeAppearanceInput, NodeAppearanceMode, formatShoulderHeight, resolveNodeAppearance } from '../../node-render/appearance';
import { DisplayMode, HeightDomain, displayModeOverrides, personDisplayFacts } from '../../node-render/display-mode';
import { nodeDrawPlan } from '../../node-render/draw-plan';
import { loadCanvasFonts } from '../../node-render/fonts';
import { hashSeed } from '../../node-render/sketch';
import { dotGrid } from '../../utils/dot-grid.util';
import { paperGrain } from '../../theme/paper-grain';
import { createNodeShape, drawFigureLink, drawIcon, drawNodePlan, measureText } from '../../node-render/konva-painter';
import { FigureLink } from '../../utils/figure-link.util';
import {
  boundingBoxCenter,
  buildSegmentRenderNodes,
  pivotNodesFor,
  SegmentNodeRef,
  SegmentRenderNode,
  stageToSlotLocal,
} from '../../utils/segment-assignment-render.util';
import {
  clampScale,
  computeRotationAngleDeg,
  getEventClientPoint,
  Point,
  touchDistance,
  touchMidpoint,
  zoomAroundPoint,
} from '../../utils/gesture-math.util';
import { LongPressDetector } from '../../utils/long-press.util';

/** Minimal node shape accepted by the canvas for rendering — both FigureNodeItem and InstanceNodeItem satisfy this */
export interface CanvasNode {
  id: string;
  label: string;
  zone: string;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  sortOrder: number;
  climbIndicator?: string | null;
  ringLevel?: number | null;
  originNodeId?: string | null;
  renglaId?: string | null;
  renglaPosition?: number | null;
  isAdHoc?: boolean;
}

/** Backing-store DPR cap for the read-only (projection) canvas — see `initStage`. */
const READONLY_MAX_PIXEL_RATIO = 2;

export type CanvasMode = 'editor' | 'readonly' | 'composition' | 'segment-assignment';

export interface CompositionSlotWithNodes {
  slotId: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  /** Rotation in degrees. Used by distribution editor; composition editor leaves this undefined (treated as 0). */
  angle?: number;
  /** Person assignments per node. Used in distribution editor to show assigned person alias. */
  assignments?: { figureNodeId: string; personAlias: string }[];
  /** Tronc grid dimensions (distribution editor only). */
  troncGridCols?: number;
  troncGridRows?: number;
  /** Tronc panel position in world coords. null = linked (auto above figure). */
  troncPanelX?: number | null;
  troncPanelY?: number | null;
  figureTemplate: {
    id: string;
    name: string;
    hasPinya: boolean;
    nodes: FigureNodeItem[];
  };
}


/** Canvas text outside the node drawing (slot labels, tooltips, the drag pill): Quicksand. */
const SANS_FONT = FONT_FAMILY.sans.join(', ');

/** Matches the min/max of the zoom-selector dropdown (25%–500%). */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;

@Component({
  selector: 'app-figure-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PersonHoverCardComponent],
  templateUrl: './figure-canvas.component.html',
  styleUrl: './figure-canvas.component.scss',
  // The paper's grain, painted by the wrapper (CSS, under the Konva stage).
  host: { '[style.--paper-grain]': 'paperGrain()' },
})
export class FigureCanvasComponent implements AfterViewInit, OnDestroy {
  /** The canvas colours for the theme on screen; a change redraws everything. */
  private readonly theme = injectCanvasTheme();
  protected readonly paperGrain = computed(() => paperGrain(this.theme().mode));

  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('editor');
  /** Hides the bottom-left zoom-percentage dropdown — pinch/wheel zoom still work regardless.
   *  Off by default on mobile (PWA), where the numeric selector is a precision control the
   *  touch UI doesn't need and just clutters a small viewport. */
  readonly showZoomControls = input<boolean>(true);
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(20);
  readonly selectedNodeId = input<string | null>(null);
  readonly snapToGrid = input<boolean>(false);
  readonly rotationSnapAngle = input<number>(15);
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  // Segment-assignment and readonly mode inputs
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nextPerformanceMap = input<Map<string, string | null>>(new Map());
  /** `segment-assignment` mode: the node whose person is being moved (right-click / long press). */
  readonly moveSourceNode = input<SegmentNodeRef | null>(null);
  /**
   * Person IDs in conflict in this segment (Phase 3). A node whose assigned person is one of
   * these gets the single amber warning style — same for every conflict kind, no `kind` reaches
   * the canvas by design ("un conflicte és un conflicte"). Empty in production until Phase 5.
   */
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly isPlacementMode = input<boolean>(false);
  readonly decorationOpacity = input<number>(1);
  /** Before / on / after the event day: from the event day on, ANIRE is a no-show and PENDENT a no-answer. */
  readonly phase = input<EventPhase>('before');
  /** personId → positions/isXicalla, used to render the hover card on assigned nodes. */
  readonly personDetailsMap = input<Map<string, { positions: AvailablePersonPosition[]; isXicalla: boolean; notes: string | null; notesEmoji: string | null; gender?: Gender | null }>>(new Map());
  /** Segment assignment: what the node colors stand for. `position` (the default) draws as always. */
  readonly displayMode = input<DisplayMode>('position');
  /** Alçada: the shortest → tallest assigned person the ramp stretches over (the whole tab). */
  readonly heightDomain = input<HeightDomain | null>(null);
  /** Extra bounding boxes (in canvas space, x/y = center) included in the readonly fit but not rendered. */
  readonly fitExtraBounds = input<{ x: number; y: number; width: number; height: number }[]>([]);
  /** The strings tying each tronc panel to its pinya (projection, Distribució): drawn behind the nodes, their pins above them. */
  readonly figureLinks = input<FigureLink[]>([]);
  // Segment-assignment mode inputs (multi-figure assignment on one canvas)
  readonly selectedSegmentNode = input<SegmentNodeRef | null>(null);
  readonly dimmedSlotIds = input<Set<string>>(new Set());
  /** Slot ad-hoc nodes are created into when `canvasClicked` fires in placement mode. */
  readonly placementSlotId = input<string | null>(null);
  /** Whether ad-hoc nodes can be dragged/rotated/resized directly on this canvas (Nodes extra tab only). */
  readonly adHocNodesEditable = input<boolean>(false);
  /**
   * Composition mode only: suppress the tronc panel's own visible dashed-rect + "Tronc de X"
   * label — keep the fully-transparent hit rect and its drag/dblclick behaviour. Set by hosts
   * that render their own visual on top instead (see `troncPanelMoved`); other composition-mode
   * hosts (e.g. the composition editor) leave this `false` and keep today's placeholder.
   */
  readonly troncPanelVisualHidden = input<boolean>(false);

  readonly nodeSelected = output<string | null>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();
  readonly nodeResized = output<{
    id: string;
    width: number;
    height: number;
  }>();
  readonly nodeLabelChanged = output<{ id: string; label: string }>();
  readonly slotSelected = output<string | null>();
  readonly slotMoved = output<{
    slotId: string;
    offsetX: number;
    offsetY: number;
    angle: number;
  }>();
  /**
   * Composition mode only: a figure's live position while it is dragged or rotated, before
   * `slotMoved` reports where it settled — so what's drawn over the canvas can follow it.
   */
  readonly slotDragMoved = output<{ slotId: string; offsetX: number; offsetY: number; angle: number }>();
  readonly troncMoved = output<{
    slotId: string;
    troncPanelX: number | null;
    troncPanelY: number | null;
  }>();
  /**
   * Composition mode only: the tronc panel Konva group's live world-space top-left — emitted on
   * initial placement and on every `dragmove` (of the panel itself, or of its linked figure
   * while `troncPanelVisualHidden` is set), unlike `troncMoved` which only fires on `dragend`.
   * A host rendering its own visual overlay uses this as the single source of truth for where
   * to position it, instead of re-deriving linked/detached placement itself.
   */
  readonly troncPanelMoved = output<{ slotId: string; x: number; y: number }>();
  readonly stageTransformChanged = output<{
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  }>();
  readonly ghostCloneRequested = output<{
    sourceNode: CanvasNode;
    targetPosition: { x: number; y: number };
  }>();
  readonly canvasClicked = output<{ x: number; y: number }>();
  // Segment-assignment mode outputs
  readonly segmentNodeSelected = output<SegmentNodeRef | null>();
  readonly segmentNodeDoubleClicked = output<SegmentNodeRef>();

  /**
   * `segment-assignment` mode: a node was right-clicked (the gesture a long press will trigger on
   * touch). Emitted for empty nodes too, since it can also pick the destination of a move.
   */
  readonly segmentNodeContextMenu = output<SegmentNodeRef>();

  /**
   * `segment-assignment` mode: whether a placed person can be dragged onto another node. Off on
   * touch, where a long press starts the move instead (and a drag would fight the canvas pan).
   */
  readonly personDragEnabled = input(true);
  readonly segmentAdHocNodeMoved = output<SegmentNodeRef & { x: number; y: number }>();
  readonly segmentAdHocNodeTransformed = output<
    SegmentNodeRef & { x: number; y: number; width: number; height: number; rotation: number }
  >();
  /** A person was dragged off `source` and released on `target` (drag-and-drop move/swap). */
  readonly segmentNodeDropped = output<{ source: SegmentNodeRef; target: SegmentNodeRef }>();
  /** A `flyToBounds()` tween finished landing (or, under reduced motion, the instant jump ran). */
  readonly flightLanded = output<void>();

  private stage!: Konva.Stage;
  private gridLayer!: Konva.Layer;
  /** Between the grid and the nodes: the tronc panel strings (`figureLinks`). */
  private linkLayer!: Konva.Layer;
  private pinyaLayer!: Konva.Layer;
  /** Above the nodes: the pins the strings end at on each figure. */
  private pinLayer!: Konva.Layer;
  private transformer!: Konva.Transformer;

  private resizeObserver: ResizeObserver | null = null;
  /**
   * Once the user pans or pinch-zooms in readonly/projection mode, stop
   * re-applying the auto-fit-to-screen transform on data or size changes —
   * otherwise their view would keep snapping back.
   */
  private userAdjustedView = false;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  /** In-flight `flyToBounds()` tween, if any — cancelled by any user gesture (see `cancelFlight`). */
  private flightTween: Konva.Tween | null = null;
  /** Pending rAF that will flush one `stageTransformChanged` emission — see `scheduleStageTransform`. */
  private stageTransformFrame: number | null = null;
  private gestureEndHandler: (() => void) | null = null;

  private activeGhostGroup: Konva.Group | null = null;
  private ghostHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostSourceNodeId: string | null = null;
  private adHocTooltip: Konva.Label | null = null;

  // Segment-assignment mode: person drag-and-drop (drag the assigned person's
  // name off their node, drop it on another to move/swap). The dragged node
  // itself never moves — only a floating label follows the pointer.
  private segmentNodeGroupsByKey = new Map<
    string,
    { ref: SegmentNodeRef; group: Konva.Group; raised: Konva.Group; node: CanvasNode; input: NodeAppearanceInput; hasAssignment: boolean }
  >();
  private personDragHoverRef: SegmentNodeRef | null = null;
  private personDragGhost: { group: Konva.Group; alias: string } | null = null;
  /** Swallows the synthetic click Konva fires right after a drag ends. */
  private personDragJustEnded = false;
  /** Touch long press on a node: starts the "move a person" gesture (see `segmentNodeContextMenu`). */
  private readonly longPress = new LongPressDetector();
  // Slot rotation/offset pivot, frozen on first render so adding or moving a node
  // never recenters the figure. Shared with the placement click-to-local math.
  private readonly segmentSlotPivotCache = new Map<string, { x: number; y: number }>();

  readonly zoomLevel = signal(1);
  readonly hoveredPerson = signal<{ info: PersonHoverInfo; top: number; left: number; positionType: string | null } | null>(null);
  // Identifies which node/person the popover is currently showing, so a
  // re-render (e.g. after unassigning via Backspace) can tell whether the
  // hovered assignment still exists — Konva never fires mouseleave when the
  // hovered group is destroyed out from under the cursor by destroyChildren().
  private destroyed = false;
  private hoveredNodeKey: string | null = null;
  private hoveredPersonId: string | null = null;

  constructor() {
    effect(() => {
      this.gridEnabled();
      this.gridSpacing();
      if (!this.stage) return;
      untracked(() => this.renderGrid());
    });

    effect(() => {
      this.nodes();
      this.selectedNodeId();
      this.mode();
      if (!this.stage) return;
      untracked(() => {
        const m = this.mode();
        if (m === 'composition' || m === 'readonly' || m === 'segment-assignment')
          return;
        this.renderNodes();
        this.updateTransformer();
      });
    });

    effect(() => {
      this.compositionSlots();
      this.selectedSlotId();
      if (!this.stage) return;
      if (this.mode() !== 'composition') return;
      untracked(() => this.renderCompositionSlots());
    });

    effect(() => {
      this.compositionSlots();
      this.assignments();
      this.heightMode();
      this.attendanceMap();
      this.nextPerformanceMap();
      this.selectedSegmentNode();
      this.dimmedSlotIds();
      this.moveSourceNode();
      this.personDetailsMap();
      this.phase();
      this.conflictPersonIds();
      this.decorationOpacity();
      this.displayMode();
      this.heightDomain();
      if (!this.stage) return;
      if (this.mode() !== 'segment-assignment') return;
      untracked(() => this.renderSegmentAssignmentSlots());
    });

    effect(() => {
      this.nodes();
      this.assignments();
      this.heightMode();
      this.attendanceMap();
      this.nextPerformanceMap();
      this.phase();
      this.conflictPersonIds();
      if (!this.stage) return;
      if (this.mode() === 'readonly') {
        untracked(() => this.renderReadonlyNodes());
      }
    });

    // A theme change recolours everything, the grid included.
    effect(() => {
      this.theme();
      if (!this.stage) return;
      untracked(() => this.renderAll());
    });

    // The tronc panel strings redraw on their own layers, apart from the figures: in Distribució
    // they follow a figure or panel while it is dragged, which must not rebuild (and drop) the drag.
    effect(() => {
      const links = this.figureLinks();
      if (!this.stage) return;
      untracked(() => this.renderFigureLinks(links));
    });

    effect(() => {
      const placement = this.isPlacementMode();
      if (!this.stage) return;
      untracked(() => {
        if (placement) {
          this.stage.container().style.cursor = 'crosshair';
        }
      });
    });
  }

  private setCursor(cursor: string): void {
    if (this.isPlacementMode()) {
      this.stage.container().style.cursor = 'crosshair';
      return;
    }
    this.stage.container().style.cursor = cursor;
  }

  ngAfterViewInit(): void {
    this.initStage();
    this.renderAll();
    // Konva measures text as it draws: once the canvas faces arrive, draw again with them.
    void loadCanvasFonts(globalThis.document?.fonts).then(() => {
      if (this.destroyed) return;
      this.renderAll();
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeStage();
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // A pending long press must not fire into a destroyed component (emitting on it throws).
    this.longPress.cancel();
    this.cancelFlight();
    if (this.stageTransformFrame !== null) cancelAnimationFrame(this.stageTransformFrame);
    this.clearAllGhostTimers();
    this.clearPersonDragVisuals();
    this.resizeObserver?.disconnect();
    if (this.wheelHandler) {
      this.stage?.container()?.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.gestureEndHandler) {
      const container = this.stage?.container();
      container?.removeEventListener('touchend', this.gestureEndHandler, true);
      container?.removeEventListener('touchcancel', this.gestureEndHandler, true);
      this.gestureEndHandler = null;
    }
    this.stage?.destroy();
  }

  /**
   * Animates the stage so `bounds` (canvas-world units) fills the viewport — "Troba'm". Cancels
   * any flight already in progress first (landing on a new target mid-flight should redirect, not
   * queue). Under `prefers-reduced-motion`, jumps straight to the destination instead of tweening;
   * `flightLanded` still fires so the arrival bounce isn't silently skipped, only the motion is.
   */
  flyToBounds(bounds: BoundsNode[], options?: { padding?: number; maxScale?: number; durationMs?: number }): void {
    if (!this.stage || bounds.length === 0) return;
    const fit = computeFitTransform(bounds, this.stage.width(), this.stage.height(), {
      padding: options?.padding,
      maxScale: options?.maxScale,
    });
    if (!fit) return;

    this.cancelFlight();
    this.userAdjustedView = true;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.stage.scale({ x: fit.scale, y: fit.scale });
      this.stage.position({ x: fit.x, y: fit.y });
      this.zoomLevel.set(fit.scale);
      this.stage.batchDraw();
      this.emitStageTransform();
      this.flightLanded.emit();
      return;
    }

    this.flightTween = new Konva.Tween({
      node: this.stage,
      duration: (options?.durationMs ?? 1000) / 1000,
      easing: Konva.Easings.EaseInOut,
      x: fit.x,
      y: fit.y,
      scaleX: fit.scale,
      scaleY: fit.scale,
      onUpdate: () => this.emitStageTransform(),
      onFinish: () => {
        this.zoomLevel.set(fit.scale);
        this.flightTween = null;
        this.flightLanded.emit();
      },
    });
    this.flightTween.play();
  }

  /** Stops an in-flight `flyToBounds()` tween exactly where it is. Called at the head of every
   *  gesture handler — fighting the user's finger is worse than not animating at all. */
  cancelFlight(): void {
    this.flightTween?.destroy();
    this.flightTween = null;
  }

  fitToScreen(): void {
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.zoomLevel.set(1);
    this.stage.batchDraw();
    this.emitStageTransform();
  }

  /** Bottom-right canvas button: in composition mode, center on content without changing zoom; otherwise reset to 100%. */
  onFitClick(): void {
    if (this.mode() === 'composition') {
      this.centerOnContent();
    } else {
      this.fitToScreen();
    }
  }

  /** Union bounding box (layer-local/scene coords) of all rendered slot groups, or null if none. */
  private getContentBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    // Collect all slot groups (exclude the Transformer, which is also a Konva.Group subclass —
    // note plain Konva.Group instances never set `.className`, only `.nodeType`, so `instanceof` is required here).
    const groups = this.pinyaLayer
      .getChildren()
      .filter((node) => node instanceof Konva.Group && !(node instanceof Konva.Transformer));

    if (groups.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const group of groups) {
      const rect = group.getClientRect({ relativeTo: this.pinyaLayer });
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    if (maxX - minX <= 0 || maxY - minY <= 0) return null;
    return { minX, minY, maxX, maxY };
  }

  /** Centers the viewport on the bounding box of the rendered content, keeping the current zoom scale. */
  centerOnContent(): void {
    const bounds = this.getContentBounds();
    if (!bounds) return;

    const { minX, minY, maxX, maxY } = bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const scale = this.stage.scaleX();

    this.stage.position({
      x: this.stage.width() / 2 - centerX * scale,
      y: this.stage.height() / 2 - centerY * scale,
    });
    this.stage.batchDraw();
    this.emitStageTransform();
  }

  getStageTransform(): {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  } {
    if (!this.stage) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    return {
      x: this.stage.x(),
      y: this.stage.y(),
      scaleX: this.stage.scaleX(),
      scaleY: this.stage.scaleY(),
    };
  }

  /** Stage-space coordinates at the center of the visible canvas viewport. */
  getViewportCenter(): { x: number; y: number } {
    if (!this.stage) {
      return { x: 0, y: 0 };
    }

    const transform = this.getStageTransform();
    const center = screenToStage(
      this.stage.width() / 2,
      this.stage.height() / 2,
      transform,
    );

    return {
      x: Math.round(center.x),
      y: Math.round(center.y),
    };
  }

  /** Zooms in by a 10% step, matching the mouse-wheel increment (Ctrl/Cmd + shortcut). */
  zoomIn(): void {
    this.setZoom(clampScale(this.zoomLevel() * 1.1, ZOOM_MIN, ZOOM_MAX));
  }

  /** Zooms out by a 10% step, matching the mouse-wheel increment (Ctrl/Cmd - shortcut). */
  zoomOut(): void {
    this.setZoom(clampScale(this.zoomLevel() * 0.9, ZOOM_MIN, ZOOM_MAX));
  }

  setZoom(level: number): void {
    const center = {
      x: this.stage.width() / 2,
      y: this.stage.height() / 2,
    };
    const oldScale = this.stage.scaleX();
    const mousePointTo = {
      x: (center.x - this.stage.x()) / oldScale,
      y: (center.y - this.stage.y()) / oldScale,
    };

    this.stage.scale({ x: level, y: level });
    this.stage.position({
      x: center.x - mousePointTo.x * level,
      y: center.y - mousePointTo.y * level,
    });

    this.zoomLevel.set(level);
    this.stage.batchDraw();
    this.emitStageTransform();
  }

  /**
   * Coalesces the per-`touchmove`/wheel emissions into at most one per frame: touch events can
   * outnumber frames, and every emission re-lays-out the DOM overlay (tronc panels) in the parent.
   */
  private scheduleStageTransform(): void {
    if (this.stageTransformFrame !== null) return;
    this.stageTransformFrame = requestAnimationFrame(() => {
      this.stageTransformFrame = null;
      this.emitStageTransform();
    });
  }

  private emitStageTransform(): void {
    if (!this.stage) return;
    if (this.stageTransformFrame !== null) {
      cancelAnimationFrame(this.stageTransformFrame);
      this.stageTransformFrame = null;
    }
    this.renderGrid();
    this.stageTransformChanged.emit({
      x: this.stage.x(),
      y: this.stage.y(),
      scaleX: this.stage.scaleX(),
      scaleY: this.stage.scaleY(),
    });
  }

  private initStage(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.stage = new Konva.Stage({ container, width, height });

    this.gridLayer = new Konva.Layer({ listening: false });
    this.linkLayer = new Konva.Layer({ listening: false });
    this.pinyaLayer = new Konva.Layer();
    this.pinLayer = new Konva.Layer({ listening: false });

    // Transformer for resizing nodes
    this.transformer = new Konva.Transformer({
      keepRatio: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (oldBox, newBox) => {
        // Limit minimum size
        if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
          return oldBox;
        }
        return newBox;
      },
    });
    this.pinyaLayer.add(this.transformer);

    this.stage.add(this.gridLayer, this.linkLayer, this.pinyaLayer, this.pinLayer);

    // Read-only projection is repainted every pan/pinch frame: at DPR 3 that is 9 device pixels
    // per CSS pixel. Cap the backing store at 2x (per canvas, not the global `Konva.pixelRatio`).
    if (this.mode() === 'readonly' && window.devicePixelRatio > READONLY_MAX_PIXEL_RATIO) {
      for (const layer of [this.gridLayer, this.linkLayer, this.pinyaLayer, this.pinLayer]) {
        layer.getCanvas().setPixelRatio(READONLY_MAX_PIXEL_RATIO);
      }
    }

    this.setupStageInteraction();
  }

  private setupStageInteraction(): void {
    // Pan with middle mouse button or left click when no node selected
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let stageStart = { x: 0, y: 0 };

    this.stage.on('mousedown', (e) => {
      this.cancelFlight();
      const isMiddleButton = e.evt.button === 1;
      const isLeftButton = e.evt.button === 0;
      const clickedOnStage = e.target === this.stage;

      // Allow panning with middle button or left button on empty canvas
      if (isMiddleButton || (isLeftButton && clickedOnStage && this.canPanOrZoom())) {
        isPanning = true;
        const pos = this.stage.getPointerPosition()!;
        panStart = { x: pos.x, y: pos.y };
        stageStart = { x: this.stage.x(), y: this.stage.y() };
        this.stage.container().style.cursor = 'grabbing';
        e.evt.preventDefault();
      }
    });

    this.stage.on('mousemove', () => {
      if (!isPanning) return;
      const pos = this.stage.getPointerPosition()!;
      this.stage.position({
        x: stageStart.x + (pos.x - panStart.x),
        y: stageStart.y + (pos.y - panStart.y),
      });
      this.stage.batchDraw();
      this.emitStageTransform();
    });

    this.stage.on('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        this.setCursor('default');
        this.emitStageTransform();
      }
    });

    this.stage.on('mousemove', (e) => {
      if (isPanning) return;
      const clickedOnStage = e.target === this.stage;

      if (
        clickedOnStage &&
        this.canPanOrZoom() &&
        (this.mode() === 'editor' || this.mode() === 'composition')
      ) {
        this.setCursor('grab');
      }
    });

    this.stage.on('mouseleave', () => {
      if (!isPanning) {
        this.setCursor('default');
      }
    });

    this.setupTouchGestures();
    this.setupWheelZoom();

    // Deselect on stage click or place ad-hoc node
    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) {
        // Touch has no hover: a tap/long-press reveals the person card or the
        // ad-hoc tooltip (see personHover/tap bindings below), so tapping
        // empty canvas is what dismisses it again.
        this.hoveredNodeKey = null;
        this.hoveredPersonId = null;
        this.hoveredPerson.set(null);
        this.hideAdHocTooltip();

        if (this.isPlacementMode()) {
          const pos = this.stage.getPointerPosition();
          if (pos) {
            const scale = this.stage.scaleX();
            const stagePos = this.stage.position();
            const stagePoint = {
              x: (pos.x - stagePos.x) / scale,
              y: (pos.y - stagePos.y) / scale,
            };
            if (this.mode() === 'segment-assignment') {
              const targetSlot = this.compositionSlots().find((s) => s.slotId === this.placementSlotId());
              this.canvasClicked.emit(
                targetSlot
                  ? stageToSlotLocal(stagePoint, targetSlot, this.slotPivot(targetSlot))
                  : { x: Math.round(stagePoint.x), y: Math.round(stagePoint.y) },
              );
            } else {
              this.canvasClicked.emit({ x: Math.round(stagePoint.x), y: Math.round(stagePoint.y) });
            }
          }
          return;
        }
        if (this.mode() === 'composition') {
          this.slotSelected.emit(null);
        } else if (this.mode() === 'segment-assignment') {
          this.segmentNodeSelected.emit(null);
        } else {
          this.nodeSelected.emit(null);
          this.transformer.nodes([]);
        }
      }
    });
  }

  /** True when nothing is selected for the current mode, mirroring the mouse-pan gate above. */
  private canPanOrZoom(): boolean {
    return this.mode() === 'composition'
      ? !this.selectedSlotId()
      : this.mode() === 'segment-assignment'
        ? !this.selectedSegmentNode()
        : !this.selectedNodeId();
  }

  /**
   * One-finger pan and two-finger pinch-zoom on touch devices, mirroring the
   * mouse pan (mousedown/mousemove/mouseup) and adding what mouse input has no
   * equivalent for (pinch). Applies in every mode, including readonly/projection.
   */
  private setupTouchGestures(): void {
    let panStart: Point | null = null;
    let panStageStart: Point = { x: 0, y: 0 };
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    // Container doesn't move mid-gesture: read its rect once, not on every touchmove (forced reflow).
    let pinchRect: DOMRect | null = null;

    const getTouchPoint = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });

    // Read-only projection: nothing in the scene needs hit-testing *during* a pan/pinch, but
    // Konva redraws the hit canvas together with the scene on every frame. Suspend it for the
    // gesture and rebuild it once in the capture phase of touchend — i.e. before Konva resolves
    // the tap target — so a tap on a person right after a pan still behaves exactly as before.
    const suspendHitGraph = (): void => {
      if (this.mode() === 'readonly' && this.pinyaLayer.listening()) this.pinyaLayer.listening(false);
    };
    this.gestureEndHandler = () => {
      if (this.pinyaLayer.listening()) return;
      this.pinyaLayer.listening(true);
      this.pinyaLayer.drawHit();
    };
    const container = this.stage.container();
    container.addEventListener('touchend', this.gestureEndHandler, true);
    container.addEventListener('touchcancel', this.gestureEndHandler, true);

    this.stage.on('touchstart', (e) => {
      this.cancelFlight();
      const touches = e.evt.touches;
      if (touches.length > 1) this.longPress.cancel();
      if (touches.length === 1 && !e.target.draggable() && this.canPanOrZoom()) {
        panStart = getTouchPoint(touches[0]);
        panStageStart = { x: this.stage.x(), y: this.stage.y() };
      } else if (touches.length === 2) {
        panStart = null;
        pinchStartDist = touchDistance(getTouchPoint(touches[0]), getTouchPoint(touches[1]));
        pinchStartScale = this.stage.scaleX();
        pinchRect = this.stage.container().getBoundingClientRect();
        this.userAdjustedView = true;
        e.evt.preventDefault();
      }
    });

    this.stage.on('touchmove', (e) => {
      const touches = e.evt.touches;
      if (touches.length === 1) this.longPress.move(touches[0].clientX, touches[0].clientY);
      else this.longPress.cancel();
      if (touches.length === 2 && pinchStartDist > 0) {
        e.evt.preventDefault();
        const p1 = getTouchPoint(touches[0]);
        const p2 = getTouchPoint(touches[1]);
        const dist = touchDistance(p1, p2);
        const newScale = clampScale(pinchStartScale * (dist / pinchStartDist), ZOOM_MIN, ZOOM_MAX);
        const rect = pinchRect ?? this.stage.container().getBoundingClientRect();
        const midpoint = touchMidpoint(p1, p2);
        const focal = { x: midpoint.x - rect.left, y: midpoint.y - rect.top };
        const newPos = zoomAroundPoint(this.stage.position(), this.stage.scaleX(), newScale, focal);
        this.stage.scale({ x: newScale, y: newScale });
        this.stage.position(newPos);
        this.zoomLevel.set(newScale);
        suspendHitGraph();
        this.stage.batchDraw();
        this.scheduleStageTransform();
      } else if (touches.length === 1 && panStart) {
        e.evt.preventDefault();
        this.userAdjustedView = true;
        const pos = getTouchPoint(touches[0]);
        this.stage.position({
          x: panStageStart.x + (pos.x - panStart.x),
          y: panStageStart.y + (pos.y - panStart.y),
        });
        suspendHitGraph();
        this.stage.batchDraw();
        this.scheduleStageTransform();
      }
    });

    this.stage.on('touchend touchcancel', (e) => {
      this.longPress.end();
      const remaining = e.evt.touches;
      pinchStartDist = 0;
      if (remaining.length === 1) {
        // One finger lifted mid-pinch: resume single-finger pan from here.
        panStart = getTouchPoint(remaining[0]);
        panStageStart = { x: this.stage.x(), y: this.stage.y() };
      } else {
        panStart = null;
      }
      this.emitStageTransform();
    });
  }

  /** Ctrl/plain wheel zoom toward the pointer, for desktop trackpads/mice (DEBT F2). */
  private setupWheelZoom(): void {
    this.wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      this.cancelFlight();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const direction = e.deltaY > 0 ? -1 : 1;
      const oldScale = this.stage.scaleX();
      const newScale = clampScale(oldScale * (1 + direction * 0.1), ZOOM_MIN, ZOOM_MAX);
      const newPos = zoomAroundPoint(this.stage.position(), oldScale, newScale, pointer);
      this.stage.scale({ x: newScale, y: newScale });
      this.stage.position(newPos);
      this.zoomLevel.set(newScale);
      this.userAdjustedView = true;
      this.stage.batchDraw();
      this.scheduleStageTransform();
    };
    this.stage.container().addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  private updateTransformer(): void {
    const selectedId = this.selectedNodeId();
    const m = this.mode();
    const isEditor = m === 'editor';

    if (!selectedId) {
      this.transformer.nodes([]);
      return;
    }

    if (!isEditor) {
      this.transformer.nodes([]);
      return;
    }

    const konvaNode = this.pinyaLayer.findOne(`#${selectedId}`);
    if (!konvaNode) {
      this.transformer.nodes([]);
      return;
    }

    this.transformer.nodes([konvaNode]);
    this.transformer.moveToTop();
    this.pinyaLayer.batchDraw();
  }

  private applyReadonlyFit(): void {
    const nodes = this.nodes();
    const allBounds = [...nodes, ...this.fitExtraBounds()];
    if (allBounds.length === 0) return;
    const fit = computeFitTransform(allBounds, this.stage.width(), this.stage.height(), { padding: 20, maxScale: 2 });
    if (fit) {
      this.stage.scale({ x: fit.scale, y: fit.scale });
      this.stage.position({ x: fit.x, y: fit.y });
      this.zoomLevel.set(fit.scale);
      this.emitStageTransform();
    }
  }

  private resizeStage(): void {
    const container = this.containerRef.nativeElement;
    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) {
      // A collapsed container (e.g. transient layout reflow) would otherwise
      // resize the Konva stage to 0px and crash on the next draw (P-H1).
      // Keep the last valid size until the observer reports real dimensions.
      return;
    }
    this.stage.width(clientWidth);
    this.stage.height(clientHeight);
    this.renderGrid();

    if (this.mode() === 'readonly' && !this.userAdjustedView) {
      this.applyReadonlyFit();
    }

    this.stage.batchDraw();
  }

  private renderAll(): void {
    this.renderGrid();
    if (this.mode() === 'composition') {
      this.renderCompositionSlots();
    } else if (this.mode() === 'segment-assignment') {
      this.renderSegmentAssignmentSlots();
    } else if (this.mode() === 'readonly') {
      this.renderReadonlyNodes();
    } else {
      this.renderNodes();
    }
    this.renderFigureLinks(this.figureLinks());
  }

  /**
   * Draws the dot grid (`dotGrid`) over the currently visible world-space rect (derived from the
   * stage's pan/zoom transform), so the paper always fills the viewport instead of being anchored
   * to a fixed area around world (0,0). One shape for every dot: this runs on every pan frame.
   */
  private renderGrid(): void {
    // Nothing to erase or draw (e.g. projection, `[gridEnabled]="false"`): skip the redraw.
    if (!this.gridEnabled() && this.gridLayer.getChildren().length === 0) return;
    this.gridLayer.destroyChildren();

    if (!this.gridEnabled()) {
      this.gridLayer.batchDraw();
      return;
    }

    const scale = this.stage.scaleX() || 1;
    const left = -this.stage.x() / scale;
    const top = -this.stage.y() / scale;
    const view = { left, top, right: left + this.stage.width() / scale, bottom: top + this.stage.height() / scale };
    const { xs, ys, radius } = dotGrid(view, this.gridSpacing(), scale);

    this.gridLayer.add(
      new Konva.Shape({
        listening: false,
        perfectDrawEnabled: false,
        sceneFunc: (context) => {
          const ctx = context._context;
          ctx.beginPath();
          for (const x of xs) {
            for (const y of ys) {
              ctx.moveTo(x + radius, y);
              ctx.arc(x, y, radius, 0, Math.PI * 2);
            }
          }
          ctx.fillStyle = this.theme().crease;
          ctx.fill();
        },
      }),
    );

    this.gridLayer.batchDraw();
  }

  /**
   * Hides the hover popover if the node/person it refers to no longer has
   * that assignment after a re-render (e.g. unassigned via Backspace).
   * Leaves it open when re-rendering for unrelated reasons (selection, etc.).
   */
  private reconcileHoveredPerson(currentPersonId: string | null | undefined): void {
    if (this.hoveredNodeKey === null) return;
    if (currentPersonId !== this.hoveredPersonId) {
      this.hoveredPerson.set(null);
      this.hoveredNodeKey = null;
      this.hoveredPersonId = null;
    }
  }

  private renderNodes(): void {
    this.clearAllGhostTimers();

    this.transformer.nodes([]);
    this.transformer.remove();

    this.pinyaLayer.destroyChildren();

    const isEditor = this.mode() === 'editor';
    const selectedId = this.selectedNodeId();
    const allNodes = this.nodes() as FigureNodeItem[];

    const renglaMaxPosition = new Map<string, number>();
    for (const node of allNodes) {
      if (node.renglaId != null && node.renglaPosition != null) {
        const current = renglaMaxPosition.get(node.renglaId) ?? -Infinity;
        if (node.renglaPosition > current) {
          renglaMaxPosition.set(node.renglaId, node.renglaPosition);
        }
      }
    }

    for (const node of allNodes) {
      const group = this.buildNodeGroup(node, isEditor, selectedId === node.id, renglaMaxPosition);
      this.pinyaLayer.add(group);
    }

    this.pinyaLayer.add(this.transformer);

    this.pinyaLayer.batchDraw();

  }

  private renderCompositionSlots(): void {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.pinyaLayer.destroyChildren();

    const selectedSlotId = this.selectedSlotId();
    // Sort ascending: lower sortOrder painted first (behind), higher sortOrder on top
    const sortedSlots = [...this.compositionSlots()].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    for (const slot of sortedSlots) {
      // pivotNodesFor also excludes ad-hoc ("extra") nodes — this mode renders the
      // Distribució tab too (see distribucio-tab.component.html), where instances
      // can carry them; an inline filter here would silently drift from the pivot
      // every other mode/view uses (see slotPivot below).
      const pinyaNodes = pivotNodesFor(slot.figureTemplate.nodes);

      const isSelected = slot.slotId === selectedSlotId;

      const slotGroup = new Konva.Group({
        id: slot.slotId,
        x: slot.offsetX,
        y: slot.offsetY,
        rotation: slot.angle ?? 0,
        draggable: true,
      });

      if (pinyaNodes.length === 0) {
        // Placeholder while nodes are loading (optimistic add before save response)
        const phW = 120;
        const phH = 80;
        slotGroup.add(
          new Konva.Rect({
            x: -phW / 2,
            y: -phH / 2,
            width: phW,
            height: phH,
            stroke: isSelected ? this.theme().focus : this.theme().inkFaint,
            strokeWidth: isSelected ? 2 : 1,
            dash: [6, 3],
            fill: withAlpha(isSelected ? this.theme().focus : this.theme().inkFaint, 0.05),
            cornerRadius: 6,
            listening: true,
          }),
        );
        slotGroup.add(
          new Konva.Text({
            x: -phW / 2,
            y: -20,
            width: phW,
            text: slot.figureTemplate.name,
            fontSize: 11,
            fontFamily: SANS_FONT,
            fill: isSelected ? this.theme().focus : this.theme().inkMuted,
            align: 'center',
            listening: false,
          }),
        );
        slotGroup.add(
          new Konva.Text({
            x: -phW / 2,
            y: -4,
            width: phW,
            text: 'Carregant...',
            fontSize: 10,
            fontFamily: SANS_FONT,
            fill: this.theme().inkFaint,
            align: 'center',
            listening: false,
          }),
        );

        if (slot.angle !== undefined && isSelected) {
          slotGroup.add(this.makeRotationHandle(slot.slotId, slotGroup, 0, -phH / 2 - 32));
        }
      } else {
        // Compute bounding box for the bounding rect
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const n of pinyaNodes) {
          minX = Math.min(minX, n.x - n.width / 2);
          minY = Math.min(minY, n.y - n.height / 2);
          maxX = Math.max(maxX, n.x + n.width / 2);
          maxY = Math.max(maxY, n.y + n.height / 2);
        }

        const padding = 8;
        const labelHeight = 16;

        // Shift Konva's rotation/scale pivot to the figure's visual center so that
        // rotation (in distribution mode) happens around the actual center of mass.
        // slotGroup.x/y then represents the visual-center position, which is what
        // we store in projectionX/Y.
        if (slot.angle !== undefined) {
          slotGroup.offsetX((minX + maxX) / 2);
          slotGroup.offsetY((minY + maxY) / 2);
        }

        const figColor = getFigureColor(slot.sortOrder);

        // Bounding rect with listening: true — acts as the hit area for the whole group
        slotGroup.add(
          new Konva.Rect({
            x: minX - padding,
            y: minY - padding - labelHeight,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2 + labelHeight,
            stroke: isSelected ? this.theme().focus : figColor,
            strokeWidth: isSelected ? 2 : 1,
            dash: [6, 3],
            fill: isSelected ? withAlpha(this.theme().focus, 0.05) : withAlpha(figColor, 0x14 / 0xff),
            cornerRadius: 6,
            listening: true,
          }),
        );

        // Group label (figure name or slot label)
        const labelText = slot.label ?? slot.figureTemplate.name;
        slotGroup.add(
          new Konva.Text({
            x: minX - padding,
            y: minY - padding - labelHeight,
            width: maxX - minX + padding * 2,
            text: labelText,
            fontSize: 11,
            fontFamily: SANS_FONT,
            fill: isSelected ? this.theme().focus : this.theme().inkMuted,
            align: 'center',
            verticalAlign: 'middle',
            height: labelHeight,
            listening: false,
            ellipsis: true,
          }),
        );

        // Build assignment lookup for this slot (figureNodeId → personAlias)
        const assignmentMap = new Map<string, string>();
        for (const a of slot.assignments ?? []) {
          assignmentMap.set(a.figureNodeId, a.personAlias);
        }

        // Render pinya-view nodes (read-only)
        for (const node of pinyaNodes) {
          const personAlias = assignmentMap.get(node.id);
          const nodeGroup = new Konva.Group({
            x: node.x,
            y: node.y,
            rotation: node.rotation,
            draggable: false,
            listening: false,
          });
          // The composition editor arranges bare templates; the Distribució tab shows who is placed.
          this.paintNode(nodeGroup, node, {
            ...this.appearanceInput(node, null, slot.assignments ? 'workspace' : 'template'),
            person: personAlias ? { name: formatAssignedLabel(personAlias, node.climbIndicator) } : null,
          });

          slotGroup.add(nodeGroup);
        }

        if (slot.angle !== undefined && isSelected) {
          const handleX = (minX + maxX) / 2;
          const handleY = minY - padding - labelHeight - 32;
          slotGroup.add(this.makeRotationHandle(slot.slotId, slotGroup, handleX, handleY));
        }
      }

      // Slot group interaction — same for real slots and placeholders
      slotGroup.on('click tap', () => {
        this.slotSelected.emit(slot.slotId);
      });

      slotGroup.on('dragmove', () => {
        if (this.snapToGrid()) {
          const spacing = this.gridSpacing() / 4;
          slotGroup.x(this.snapValue(slotGroup.x(), spacing));
          slotGroup.y(this.snapValue(slotGroup.y(), spacing));
        }
        this.slotDragMoved.emit({ slotId: slot.slotId, offsetX: slotGroup.x(), offsetY: slotGroup.y(), angle: slotGroup.rotation() });
      });

      slotGroup.on('dragend', () => {
        this.slotMoved.emit({
          slotId: slot.slotId,
          offsetX: Math.round(slotGroup.x()),
          offsetY: Math.round(slotGroup.y()),
          angle: slotGroup.rotation(),
        });
      });

      slotGroup.on('mouseenter', () => {
        this.stage.container().style.cursor = 'grab';
      });
      slotGroup.on('mouseleave', () => {
        this.stage.container().style.cursor = 'default';
      });
      slotGroup.on('dragstart', () => {
        this.stage.container().style.cursor = 'grabbing';
      });

      this.pinyaLayer.add(slotGroup);

      // Tronc panel — distribution mode only (slot.angle defined + tronc data present)
      if (slot.angle !== undefined && slot.troncGridCols !== undefined && slot.troncGridRows !== undefined) {
        this.renderTroncPanel(slot, slotGroup, getFigureColor(slot.sortOrder));
      }
    }

    this.pinyaLayer.add(this.transformer);
    this.pinyaLayer.batchDraw();
  }

  private computeLinkedTroncPosition(
    slotGroup: Konva.Group,
    figureHalfHeight: number,
    troncW: number,
    troncH: number,
  ): { x: number; y: number } {
    return {
      x: slotGroup.x() - troncW / 2,
      y: slotGroup.y() - figureHalfHeight - troncH - TRONC_GAP_PX,
    };
  }

  private renderTroncPanel(slot: CompositionSlotWithNodes, slotGroup: Konva.Group, figColor: string): void {
    const { naturalW: troncW, naturalH: troncH } = computeTroncNaturalSize(slot.troncGridCols ?? 0, slot.troncGridRows ?? 0);

    // Bounding box for pivot computation (same logic as renderCompositionSlots, ad-hoc excluded)
    const pinyaNodes = pivotNodesFor(slot.figureTemplate.nodes);
    let minY = 0, maxY = 0;
    if (pinyaNodes.length > 0) {
      minY = Math.min(...pinyaNodes.map((n) => n.y - n.height / 2));
      maxY = Math.max(...pinyaNodes.map((n) => n.y + n.height / 2));
    }
    const figureHalfHeight = (maxY - minY) / 2;

    let isLinked = slot.troncPanelX == null;
    const linked = this.computeLinkedTroncPosition(slotGroup, figureHalfHeight, troncW, troncH);

    const troncGroup = new Konva.Group({
      x: isLinked ? linked.x : (slot.troncPanelX ?? linked.x),
      y: isLinked ? linked.y : (slot.troncPanelY ?? linked.y),
      draggable: true,
    });

    const hideVisual = this.troncPanelVisualHidden();

    // Hit area: always present (drag/click target), visible dashed rect only when a host
    // isn't rendering its own overlay on top (see `troncPanelVisualHidden`).
    troncGroup.add(new Konva.Rect({
      x: 0,
      y: 0,
      width: troncW,
      height: troncH,
      fill: hideVisual ? 'transparent' : figColor + '20',
      stroke: hideVisual ? undefined : figColor,
      strokeWidth: hideVisual ? 0 : 1.5,
      dash: hideVisual ? undefined : [6, 3],
      cornerRadius: 4,
      listening: true,
    }));

    if (!hideVisual) {
      troncGroup.add(new Konva.Text({
        x: 0,
        y: 0,
        width: troncW,
        height: troncH,
        text: 'Tronc de ' + (slot.label ?? slot.figureTemplate.name),
        fontSize: 18,
        fontFamily: SANS_FONT,
        fill: figColor,
        align: 'center',
        verticalAlign: 'middle',
        listening: false,
      }));
    }

    const emitTroncPanelMoved = () => {
      this.troncPanelMoved.emit({ slotId: slot.slotId, x: troncGroup.x(), y: troncGroup.y() });
    };

    // Keep tronc in sync when figure is dragged (linked mode)
    slotGroup.on('dragmove.tronc', () => {
      if (!isLinked) return;
      const pos = this.computeLinkedTroncPosition(slotGroup, figureHalfHeight, troncW, troncH);
      troncGroup.x(pos.x);
      troncGroup.y(pos.y);
      this.pinyaLayer.batchDraw();
      emitTroncPanelMoved();
    });

    slotGroup.on('dragend.tronc', () => {
      if (!isLinked) return;
      const pos = this.computeLinkedTroncPosition(slotGroup, figureHalfHeight, troncW, troncH);
      troncGroup.x(pos.x);
      troncGroup.y(pos.y);
      emitTroncPanelMoved();
    });

    troncGroup.on('dragmove', () => {
      if (this.snapToGrid()) {
        const spacing = this.gridSpacing() / 4;
        troncGroup.x(this.snapValue(troncGroup.x(), spacing));
        troncGroup.y(this.snapValue(troncGroup.y(), spacing));
      }
      emitTroncPanelMoved();
    });

    troncGroup.on('dragend', () => {
      isLinked = false;
      this.troncMoved.emit({
        slotId: slot.slotId,
        troncPanelX: Math.round(troncGroup.x()),
        troncPanelY: Math.round(troncGroup.y()),
      });
    });

    troncGroup.on('mouseenter', () => {
      this.stage.container().style.cursor = 'grab';
    });
    troncGroup.on('mouseleave', () => {
      this.stage.container().style.cursor = 'default';
    });
    troncGroup.on('dblclick dbltap', () => {
      isLinked = true;
      const pos = this.computeLinkedTroncPosition(slotGroup, figureHalfHeight, troncW, troncH);
      troncGroup.x(pos.x);
      troncGroup.y(pos.y);
      this.pinyaLayer.batchDraw();
      this.troncMoved.emit({ slotId: slot.slotId, troncPanelX: null, troncPanelY: null });
      emitTroncPanelMoved();
    });

    this.pinyaLayer.add(troncGroup);
    emitTroncPanelMoved();
  }

  private makeRotationHandle(slotId: string, slotGroup: Konva.Group, x: number, y: number): Konva.Circle {
    const handle = new Konva.Circle({
      x,
      y,
      radius: 10,
      fill: this.theme().focus,
      stroke: this.theme().onInk,
      strokeWidth: 3,
      draggable: false,
      listening: true,
      cursor: 'crosshair',
    });

    handle.on('mousedown touchstart', (e) => {
      e.cancelBubble = true;
      e.evt.preventDefault();
      slotGroup.draggable(false); // prevent parent drag while rotating

      const stageEl = this.stage.container();
      const groupX = slotGroup.x();
      const groupY = slotGroup.y();

      const toLayer = (client: Point) => {
        const rect = stageEl.getBoundingClientRect();
        return {
          x: (client.x - rect.left - this.stage.x()) / this.stage.scaleX(),
          y: (client.y - rect.top - this.stage.y()) / this.stage.scaleY(),
        };
      };

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const client = getEventClientPoint(ev);
        if (!client) return;
        ev.preventDefault();
        const lp = toLayer(client);
        const angleDeg = computeRotationAngleDeg(lp, { x: groupX, y: groupY }, this.snapToGrid());
        slotGroup.rotation(angleDeg);
        this.pinyaLayer.batchDraw();
        this.slotDragMoved.emit({ slotId, offsetX: slotGroup.x(), offsetY: slotGroup.y(), angle: angleDeg });
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchend', onUp);
        slotGroup.draggable(true);
        this.slotMoved.emit({
          slotId,
          offsetX: Math.round(slotGroup.x()),
          offsetY: Math.round(slotGroup.y()),
          angle: slotGroup.rotation(),
        });
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    });

    return handle;
  }

  /**
   * Draws a node into `group` through the shared pipeline (appearance → draw plan → Konva); returns
   * its outline shape. What the plan raises (the observation sticker, the move badge) goes into
   * `raisedGroup` when given — a group with the node's own transform on a layer above every node —
   * so a neighbouring node never covers it. The node's id seeds its pen strokes.
   */
  private paintNode(
    group: Konva.Group,
    node: { id: string; width: number; height: number; shape?: string | null },
    input: NodeAppearanceInput,
    raisedGroup?: Konva.Group,
  ): Konva.Shape {
    const appearance = resolveNodeAppearance(input, this.theme());
    const size = { width: node.width, height: node.height, shape: node.shape ?? NodeShape.RECTANGLE, seed: hashSeed(node.id) };
    const { shape, nodes, raised } = drawNodePlan(nodeDrawPlan(appearance, size, this.theme(), measureText));
    group.add(...nodes);
    if (raised.length > 0) (raisedGroup ?? group).add(...raised);
    return shape;
  }

  /** A group that carries `source`'s transform, for the pieces of a node raised above its neighbours. */
  private raisedGroupFor(source: Konva.Group): Konva.Group {
    return new Konva.Group({
      x: source.x(),
      y: source.y(),
      rotation: source.rotation(),
      offsetX: source.offsetX(),
      offsetY: source.offsetY(),
      opacity: source.opacity(),
      listening: false,
    });
  }

  /** What a node shows in `mode`, from the node, the person placed on it and the canvas inputs. */
  private appearanceInput(
    node: CanvasNode,
    assignment: AssignmentDetail | null | undefined,
    mode: NodeAppearanceMode,
  ): NodeAppearanceInput {
    const person = assignment?.person;
    const details = person ? this.personDetailsMap().get(person.id) : undefined;
    const sources = { attendance: this.attendanceMap(), nextPerformance: this.nextPerformanceMap(), details: this.personDetailsMap() };
    const display = { mode: this.displayMode(), phase: this.phase(), heightDomain: this.heightDomain(), themeMode: this.theme().mode };
    const overrides = displayModeOverrides(person ? personDisplayFacts(person, sources) : null, display);
    return {
      zone: node.zone,
      positionType: node.positionType,
      color: node.color,
      isAdHoc: !!node.isAdHoc,
      label: formatAssignedLabel(node.label, node.climbIndicator),
      person: person
        ? {
            name: formatAssignedLabel(person.alias, node.climbIndicator),
            height: formatShoulderHeight(person.shoulderHeight, this.heightMode()),
            nextActuacio: this.nextPerformanceMap().get(person.id) === 'ANIRE',
            observation: details?.notes ? { emoji: details.notesEmoji } : null,
          }
        : null,
      attendance: person ? attendanceVisual(this.attendanceMap().get(person.id), this.phase()) : undefined,
      conflict: this.isConflictAssignment(assignment),
      mode,
      ...overrides,
    };
  }

  /** True when this node's assigned person holds >1 placement in the segment (Phase 3). */
  private isConflictAssignment(assignment: AssignmentDetail | null | undefined): boolean {
    return !!assignment && this.conflictPersonIds().has(assignment.person.id);
  }

  /** Frozen bbox-center pivot for a slot, computed once from its current nodes. */
  private slotPivot(slot: CompositionSlotWithNodes): { x: number; y: number } {
    const cached = this.segmentSlotPivotCache.get(slot.slotId);
    if (cached) return cached;
    // PINYA+BASE only, matching the pivot every other view/canvas mode uses
    // (composition/distribution mode below, distributionNodes in the
    // projection view) — decoration is still drawn but must never shift it.
    const pivot = boundingBoxCenter(pivotNodesFor(slot.figureTemplate.nodes));
    this.segmentSlotPivotCache.set(slot.slotId, pivot);
    return pivot;
  }

  /**
   * Segment-assignment mode: all figures of a segment on one canvas at their
   * distributed positions, with assignment-style interactive nodes. Slots are
   * not draggable (that is the distribution view's job).
   */
  private renderSegmentAssignmentSlots(): void {
    this.clearAllGhostTimers();
    this.clearPersonDragVisuals();
    this.segmentNodeGroupsByKey = new Map();
    this.transformer.nodes([]);
    this.transformer.remove();
    this.pinyaLayer.destroyChildren();

    const renderNodes = buildSegmentRenderNodes(
      this.compositionSlots(),
      this.assignments(),
      this.selectedSegmentNode(),
      this.dimmedSlotIds(),
      this.moveSourceNode(),
    );
    const bySlot = new Map<string, SegmentRenderNode[]>();
    for (const rn of renderNodes) {
      const list = bySlot.get(rn.slotId) ?? [];
      list.push(rn);
      bySlot.set(rn.slotId, list);
    }
    if (this.hoveredNodeKey) {
      const hovered = renderNodes.find(
        (rn) => `${rn.slotId}:${rn.node.id}` === this.hoveredNodeKey,
      );
      this.reconcileHoveredPerson(hovered?.assignment?.person.id ?? null);
    }

    const sortedSlots = [...this.compositionSlots()].sort((a, b) => a.sortOrder - b.sortOrder);
    const editable = this.adHocNodesEditable();
    let selectedEditableGroup: Konva.Group | null = null;
    // Each slot's raised pieces, added above every slot once they are all drawn.
    const raisedSlots: Konva.Group[] = [];

    for (const slot of sortedSlots) {
      const slotNodes = bySlot.get(slot.slotId) ?? [];
      if (slotNodes.length === 0) continue;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const rn of slotNodes) {
        minX = Math.min(minX, rn.node.x - rn.node.width / 2);
        minY = Math.min(minY, rn.node.y - rn.node.height / 2);
        maxX = Math.max(maxX, rn.node.x + rn.node.width / 2);
        maxY = Math.max(maxY, rn.node.y + rn.node.height / 2);
      }

      const pivot = this.slotPivot(slot);

      const slotGroup = new Konva.Group({
        id: `slot-${slot.slotId}`,
        x: slot.offsetX,
        y: slot.offsetY,
        rotation: slot.angle ?? 0,
        draggable: false,
      });
      slotGroup.offsetX(pivot.x);
      slotGroup.offsetY(pivot.y);

      const isDimmedSlot = this.dimmedSlotIds().has(slot.slotId);
      const labelHeight = 16;
      const padding = 8;
      slotGroup.add(
        new Konva.Text({
          x: minX - padding,
          y: minY - padding - labelHeight,
          width: maxX - minX + padding * 2,
          text: slot.label ?? slot.figureTemplate.name,
          fontSize: 11,
          fontFamily: SANS_FONT,
          fill: this.theme().inkMuted,
          opacity: isDimmedSlot ? 0.25 : 1,
          align: 'center',
          verticalAlign: 'middle',
          height: labelHeight,
          listening: false,
          ellipsis: true,
        }),
      );

      const raisedSlot = this.raisedGroupFor(slotGroup);
      raisedSlots.push(raisedSlot);

      for (const rn of slotNodes) {
        const nodeGroup = this.buildSegmentAssignmentNodeGroup(rn, raisedSlot);
        if (!rn.isInteractive) {
          // Drawn like any decoration, but kept out of Konva's hit graph and of the
          // geometric drop-target lookup (`findPersonDropTargetAt`).
          nodeGroup.listening(false);
          this.segmentNodeGroupsByKey.delete(rn.key);
        }
        slotGroup.add(nodeGroup);
        if (editable && rn.isSelected && rn.node.isAdHoc) {
          selectedEditableGroup = nodeGroup;
        }
      }

      this.pinyaLayer.add(slotGroup);
    }

    for (const raisedSlot of raisedSlots) this.pinyaLayer.add(raisedSlot);
    this.pinyaLayer.add(this.transformer);
    if (selectedEditableGroup) {
      this.transformer.nodes([selectedEditableGroup]);
      this.transformer.moveToTop();
    }
    this.pinyaLayer.batchDraw();
  }

  private buildSegmentAssignmentNodeGroup(rn: SegmentRenderNode, raisedSlot: Konva.Group): Konva.Group {
    const node = rn.node;
    const assignment = rn.assignment;
    const ref: SegmentNodeRef = { slotId: rn.slotId, nodeId: node.id };

    const isAdHoc = !!node.isAdHoc;
    const isDecoration = node.zone === FigureZone.DECORATION;
    const isEditable = isAdHoc && this.adHocNodesEditable();

    const group = new Konva.Group({
      id: rn.key,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      draggable: isEditable,
      opacity: rn.isDimmed ? 0.25 : isDecoration ? this.decorationOpacity() : 1,
    });

    const input: NodeAppearanceInput = {
      ...this.appearanceInput(node, assignment, 'workspace'),
      selected: rn.isSelected,
      moveSource: rn.isMoveSource,
    };
    const raised = this.raisedGroupFor(group);
    raisedSlot.add(raised);
    this.paintNode(group, node, input, raised);
    // The raised pieces follow the node while an editable one is dragged or resized.
    group.on('dragmove transform', () => {
      raised.setAttrs({ x: group.x(), y: group.y(), rotation: group.rotation(), scaleX: group.scaleX(), scaleY: group.scaleY() });
    });

    if (assignment) {
      const alias = formatAssignedLabel(assignment.person.alias, node.climbIndicator);
      const attendanceStatus = this.attendanceMap().get(assignment.person.id);
      const personDetails = this.personDetailsMap().get(assignment.person.id);

      group.on('mouseenter.personHover tap.personHover', (e) => {
        if (e.type === 'tap' && this.longPress.swallowsClick()) return;
        const point = getEventClientPoint(e.evt);
        if (!point) return;
        this.hoveredNodeKey = `${rn.slotId}:${node.id}`;
        this.hoveredPersonId = assignment.person.id;
        this.hoveredPerson.set({
          info: {
            alias,
            attendanceStatus: (attendanceStatus as AttendanceStatus) ?? null,
            isXicalla: personDetails?.isXicalla ?? false,
            shoulderHeight: assignment.person.shoulderHeight,
            notes: personDetails?.notes ?? null,
            notesEmoji: personDetails?.notesEmoji ?? null,
            positions: personDetails?.positions ?? [],
          },
          top: point.y + 12,
          left: point.x + 12,
          positionType: node.positionType,
        });
      });
      group.on('mouseleave.personHover', () => {
        this.hoveredNodeKey = null;
        this.hoveredPersonId = null;
        this.hoveredPerson.set(null);
      });
    }

    group.on('click tap', () => {
      // Lifting the finger after a long press emits a click that is not a real tap.
      if (this.longPress.swallowsClick()) return;
      // A drag that ended without a valid drop target fires a synthetic click;
      // swallow it so it doesn't re-select the node right after a cancelled drag.
      if (this.personDragJustEnded) {
        this.personDragJustEnded = false;
        return;
      }
      this.segmentNodeSelected.emit(ref);
    });

    if (!isEditable) {
      group.on('contextmenu', (e) => {
        e.evt.preventDefault();
        // Android fires this natively on a long press too: the long-press detector reports that
        // gesture (once), so it must not also be reported here as a mouse right-click.
        if (this.longPress.absorbNativeContextMenu()) return;
        this.segmentNodeContextMenu.emit(ref);
      });
      // A finger held on a node starts the move gesture; the stage's touch handlers below cancel
      // it when the finger moves, a second finger arrives, or the touch ends.
      group.on('touchstart', (e) => {
        const touches = e.evt.touches;
        if (touches.length !== 1) {
          this.longPress.cancel();
          return;
        }
        this.longPress.start(touches[0].clientX, touches[0].clientY, () => this.segmentNodeContextMenu.emit(ref));
      });
    }

    group.on('dblclick dbltap', () => {
      this.segmentNodeDoubleClicked.emit(ref);
    });

    const isPersonDraggable = !!assignment && !isEditable && this.personDragEnabled();

    if (isEditable) {
      group.on('dragstart', () => {
        this.setCursor('grabbing');
      });

      group.on('dragend', () => {
        this.setCursor('grab');
        this.segmentAdHocNodeMoved.emit({
          ...ref,
          x: Math.round(group.x()),
          y: Math.round(group.y()),
        });
      });

      group.on('transformend', () => {
        const scaleX = group.scaleX();
        const scaleY = group.scaleY();
        group.scaleX(1);
        group.scaleY(1);

        this.segmentAdHocNodeTransformed.emit({
          ...ref,
          x: Math.round(group.x()),
          y: Math.round(group.y()),
          width: Math.max(20, Math.round(node.width * scaleX)),
          height: Math.max(20, Math.round(node.height * scaleY)),
          rotation: ((Math.round(group.rotation()) % 360) + 360) % 360,
        });
      });

      group.on('mouseenter tap', () => {
        this.setCursor('grab');
        if (!isDecoration) this.showAdHocTooltip(group);
      });
      group.on('mouseleave', () => {
        this.setCursor('default');
        this.hideAdHocTooltip();
      });
    } else if (isPersonDraggable) {
      // Everything but the outline shape (the first child) belongs to the person.
      const personVisuals = () => group.getChildren().slice(1);
      const homePos = { x: node.x, y: node.y };
      const alias = formatAssignedLabel(assignment!.person.alias, node.climbIndicator);

      group.draggable(true);
      // Pin the node in place — only the floating ghost label moves.
      group.dragBoundFunc(() => group.getAbsolutePosition());

      group.on('dragstart', () => {
        this.setCursor('grabbing');
        for (const n of personVisuals()) n.visible(false);
        raised.visible(false);
        this.showPersonDragGhost(alias);
        this.pinyaLayer.batchDraw();
      });

      group.on('dragmove', () => {
        this.updatePersonDragGhostPosition();
        this.setPersonDragHoverTarget(this.findPersonDropTargetAt(ref));
      });

      group.on('dragend', () => {
        this.setCursor('grab');
        group.position(homePos);
        for (const n of personVisuals()) n.visible(true);
        raised.visible(true);
        const target = this.personDragHoverRef;
        this.clearPersonDragVisuals();
        if (target) {
          this.personDragJustEnded = true;
          this.segmentNodeDropped.emit({ source: ref, target });
        }
        this.pinyaLayer.batchDraw();
      });

      group.on('mouseenter', () => {
        this.setCursor('grab');
      });
      group.on('mouseleave', () => {
        this.setCursor('default');
      });
    } else {
      group.on('mouseenter', () => {
        this.setCursor('pointer');
      });
      group.on('mouseleave', () => {
        this.setCursor('default');
      });
    }

    this.segmentNodeGroupsByKey.set(rn.key, { ref, group, raised, node, input, hasAssignment: !!assignment });

    return group;
  }

  private renderFigureLinks(links: FigureLink[]): void {
    this.linkLayer.destroyChildren();
    this.pinLayer.destroyChildren();
    for (const link of links) {
      const { string, pin } = drawFigureLink(link, this.theme());
      this.linkLayer.add(string);
      this.pinLayer.add(pin);
    }
    this.linkLayer.batchDraw();
    this.pinLayer.batchDraw();
  }

  private renderReadonlyNodes(): void {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.pinyaLayer.destroyChildren();

    const assignmentByNodeId = new Map(this.assignments().map((a) => [a.node.id, a]));
    const raisedLayer = new Konva.Group({ listening: false });

    for (const node of this.nodes()) {
      const group = new Konva.Group({
        id: node.id,
        x: node.x,
        y: node.y,
        rotation: node.rotation,
        draggable: false,
      });
      const raised = this.raisedGroupFor(group);
      raisedLayer.add(raised);
      this.paintNode(group, node, this.appearanceInput(node, assignmentByNodeId.get(node.id), 'projection'), raised);
      this.pinyaLayer.add(group);
    }
    this.pinyaLayer.add(raisedLayer);

    this.pinyaLayer.add(this.transformer);
    this.pinyaLayer.batchDraw();

    if ((this.nodes().length > 0 || this.fitExtraBounds().length > 0) && !this.userAdjustedView) {
      setTimeout(() => {
        this.applyReadonlyFit();
        this.stage.batchDraw();
      });
    }
  }

  private buildNodeGroup(
    node: FigureNodeItem,
    isEditor: boolean,
    isSelected: boolean,
    renglaMaxPosition: Map<string, number> = new Map(),
  ): Konva.Group {
    const group = new Konva.Group({
      id: node.id,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      draggable: isEditor,
    });

    this.paintNode(group, node, { ...this.appearanceInput(node, null, 'template'), selected: isSelected });

    // Ring level badge (editor mode, PINYA zone nodes only)
    if (isEditor && node.zone === FigureZone.PINYA && node.ringLevel != null) {
      const badgeText = `C${node.ringLevel}`;
      const badgeFontSize = 8;
      const badgePadX = 3;
      const badgePadY = 1.5;
      const badgeW = badgeFontSize * badgeText.length * 0.6 + badgePadX * 2;
      const badgeH = badgeFontSize + badgePadY * 2;
      const badgeX = node.width / 2 - badgeW - 1;
      const badgeY = -node.height / 2 + 1;

      const badgeBg = new Konva.Rect({
        x: badgeX,
        y: badgeY,
        width: badgeW,
        height: badgeH,
        fill: withAlpha(this.theme().ink, 0.55),
        cornerRadius: 2,
        listening: false,
      });
      group.add(badgeBg);

      const badgeLabel = new Konva.Text({
        text: badgeText,
        fontSize: badgeFontSize,
        fontFamily: SANS_FONT,
        fill: this.theme().onInk,
        fontStyle: 'bold',
        x: badgeX + badgePadX,
        y: badgeY + badgePadY,
        listening: false,
      });
      group.add(badgeLabel);
    }

    // Events
    group.on('click tap', () => {
      this.nodeSelected.emit(node.id);
      if (isEditor) {
        this.transformer.nodes([group]);
        this.transformer.moveToTop();
        this.pinyaLayer.batchDraw();
      }
    });

    if (isEditor) {
      group.on('dragmove', () => {
        if (this.snapToGrid()) {
          const spacing = this.gridSpacing();
          group.x(this.snapValue(group.x(), spacing));
          group.y(this.snapValue(group.y(), spacing));
        }
      });

      group.on('dragend', () => {
        this.nodeMoved.emit({
          id: node.id,
          x: Math.round(group.x()),
          y: Math.round(group.y()),
        });
      });

      group.on('transformend', () => {
        const scaleX = group.scaleX();
        const scaleY = group.scaleY();

        // Reset accumulated scale back to 1 and apply it as real dimensions
        group.scaleX(1);
        group.scaleY(1);

        const newWidth = Math.max(20, Math.round(node.width * scaleX));
        const newHeight = Math.max(20, Math.round(node.height * scaleY));

        if (newWidth !== node.width || newHeight !== node.height) {
          this.nodeResized.emit({
            id: node.id,
            width: newWidth,
            height: newHeight,
          });
        }

        // Capture rotation set by the Transformer's rotate handle
        const rawRotation = Math.round(group.rotation());
        let rotation = ((rawRotation % 360) + 360) % 360;
        if (this.snapToGrid()) {
          rotation =
            Math.round(rotation / this.rotationSnapAngle()) *
            this.rotationSnapAngle();
          rotation = ((rotation % 360) + 360) % 360;
        }
        if (rotation !== node.rotation) {
          this.nodeRotated.emit({ id: node.id, rotation });
        }
      });

      group.on('dblclick dbltap', () => {
        this.showLabelEditor(node);
      });

      // Cursor + ghost hover
      group.on('mouseenter', () => {
        this.stage.container().style.cursor = 'grab';
        if (isGhostEligible(node, renglaMaxPosition.get(node.renglaId ?? '') ?? 0)) {
          this.startGhostTimer(node);
        }
      });
      group.on('mouseleave', () => {
        this.stage.container().style.cursor = 'default';
        this.scheduleGhostHide();
      });
      group.on('dragstart', () => {
        this.stage.container().style.cursor = 'grabbing';
        this.hideGhost();
      });
    }

    return group;
  }

  // ── Ghost clone ──────────────────────────────────────────────────────────

  private startGhostTimer(node: CanvasNode): void {
    this.clearGhostLeaveTimer();

    if (this.ghostSourceNodeId === node.id) return;

    this.hideGhost();
    this.ghostHoverTimer = setTimeout(() => this.showGhostForNode(node), 250);
  }

  private showGhostForNode(node: CanvasNode): void {
    this.hideGhost();

    const pos = calculateGhostPosition(node);
    if (isGhostPositionOccupied(pos, this.nodes())) return;
    const nodeColor = nodeFill(node, this.theme().mode);

    const ghost = new Konva.Group({
      x: pos.x,
      y: pos.y,
      rotation: node.rotation,
      listening: true,
    });

    const shape = createNodeShape(node.shape ?? NodeShape.RECTANGLE, node.width, node.height, {
      fill: nodeColor,
      stroke: this.theme().ink,
      strokeWidth: 2,
      dash: [6, 4],
      opacity: 0.4,
    });
    ghost.add(shape);

    ghost.add(
      new Konva.Text({
        text: '+',
        fontSize: 24,
        fontFamily: SANS_FONT,
        fill: this.theme().ink,
        opacity: 0.4,
        align: 'center',
        verticalAlign: 'middle',
        width: node.width,
        height: node.height,
        x: -node.width / 2,
        y: -node.height / 2,
        listening: false,
      }),
    );

    ghost.on('mouseenter', () => {
      this.clearGhostLeaveTimer();
      this.stage.container().style.cursor = 'copy';
    });

    ghost.on('mouseleave', () => {
      this.stage.container().style.cursor = 'default';
      this.scheduleGhostHide();
    });

    ghost.on('click tap', () => {
      this.ghostCloneRequested.emit({ sourceNode: node, targetPosition: pos });
      this.hideGhost();
    });

    this.pinyaLayer.add(ghost);
    ghost.moveToTop();
    this.transformer.moveToTop();
    this.pinyaLayer.batchDraw();

    this.activeGhostGroup = ghost;
    this.ghostSourceNodeId = node.id;
  }

  private scheduleGhostHide(): void {
    this.clearGhostLeaveTimer();
    this.ghostLeaveTimer = setTimeout(() => this.hideGhost(), 150);
  }

  private hideGhost(): void {
    this.clearGhostHoverTimer();
    this.clearGhostLeaveTimer();
    if (this.activeGhostGroup) {
      this.activeGhostGroup.destroy();
      this.activeGhostGroup = null;
      this.ghostSourceNodeId = null;
      this.pinyaLayer.batchDraw();
    }
  }

  private clearGhostHoverTimer(): void {
    if (this.ghostHoverTimer) {
      clearTimeout(this.ghostHoverTimer);
      this.ghostHoverTimer = null;
    }
  }

  private clearGhostLeaveTimer(): void {
    if (this.ghostLeaveTimer) {
      clearTimeout(this.ghostLeaveTimer);
      this.ghostLeaveTimer = null;
    }
  }

  private clearAllGhostTimers(): void {
    this.clearGhostHoverTimer();
    this.clearGhostLeaveTimer();
    if (this.activeGhostGroup) {
      this.activeGhostGroup.destroy();
      this.activeGhostGroup = null;
      this.ghostSourceNodeId = null;
    }
  }

  private showLabelEditor(node: FigureNodeItem): void {
    const stageScale = this.stage.scaleX();
    const stagePos = this.stage.position();

    const canvasX = node.x * stageScale + stagePos.x;
    const canvasY = node.y * stageScale + stagePos.y;
    const inputWidth = Math.max(60, node.width * stageScale);
    const inputHeight = Math.max(20, node.height * stageScale);

    const wrapper = this.containerRef.nativeElement.parentElement!;

    const input = document.createElement('textarea');
    input.value = node.label ?? '';
    input.className = 'label-editor';
    input.setAttribute('aria-label', "Edita l'etiqueta del node");
    input.maxLength = 500;

    Object.assign(input.style, {
      position: 'absolute',
      left: `${canvasX - inputWidth / 2}px`,
      top: `${canvasY - inputHeight / 2}px`,
      width: `${inputWidth}px`,
      height: `${inputHeight}px`,
      fontSize: `${Math.max(9, 10 * stageScale)}px`,
      resize: 'none',
      overflowY: 'auto',
    });

    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const newLabel = input.value.trim();
      wrapper.removeChild(input);
      if (newLabel !== (node.label ?? '')) {
        this.nodeLabelChanged.emit({ id: node.id, label: newLabel });
      }
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      wrapper.removeChild(input);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        cancel();
      }
    });

    input.addEventListener('blur', commit);

    wrapper.appendChild(input);
    input.focus();
    input.select();
  }

  private snapValue(value: number, spacing: number): number {
    return Math.round(value / spacing) * spacing;
  }

  private showAdHocTooltip(group: Konva.Group): void {
    this.hideAdHocTooltip();
    // Absolute position relative to pinyaLayer: identical to group.x()/y() for
    // flat 'assignment'-mode groups, but required for segment-assignment mode
    // where the group is nested inside an offset/rotated per-slot group.
    const pos = group.getAbsolutePosition(this.pinyaLayer);
    const label = new Konva.Label({
      x: pos.x,
      y: pos.y - 28,
      opacity: 0.85,
    });
    label.add(new Konva.Tag({ fill: this.theme().ink, cornerRadius: 4, pointerDirection: 'down', pointerWidth: 8, pointerHeight: 4 }));
    label.add(new Konva.Text({ text: 'Node creat manualment', fontSize: 11, fontFamily: SANS_FONT, fill: this.theme().onInk, padding: 4 }));
    this.adHocTooltip = label;
    this.pinyaLayer.add(label);
    this.pinyaLayer.batchDraw();
  }

  private hideAdHocTooltip(): void {
    if (this.adHocTooltip) {
      this.adHocTooltip.destroy();
      this.adHocTooltip = null;
      this.pinyaLayer.batchDraw();
    }
  }

  /** Floating pill showing the dragged person's name, following the pointer. */
  private showPersonDragGhost(alias: string): void {
    const group = new Konva.Group({ opacity: 0.95, listening: false });
    this.personDragGhost = { group, alias };
    this.drawPersonDragGhost(null);
    this.pinyaLayer.add(group);
    this.updatePersonDragGhostPosition();
    group.moveToTop();
  }

  /** Redraws the pill: the name, after an arrow saying what the drop would do over a target. */
  private drawPersonDragGhost(drop: 'swap' | 'move' | null): void {
    if (!this.personDragGhost) return;
    const { group, alias } = this.personDragGhost;
    group.destroyChildren();
    const height = 22;
    const padX = 8;
    const iconSize = 13;
    const textX = drop ? padX + iconSize + 5 : padX;
    const text = new Konva.Text({
      text: alias,
      x: textX,
      y: 0,
      height,
      verticalAlign: 'middle',
      fontSize: 12,
      fontFamily: SANS_FONT,
      fontStyle: 'bold',
      fill: this.theme().onInk,
    });
    group.add(
      new Konva.Rect({
        width: textX + text.width() + padX,
        height,
        cornerRadius: height / 2,
        fill: this.theme().nodeOutline,
      }),
      text,
    );
    if (drop) {
      group.add(
        drawIcon({
          icon: drop === 'swap' ? 'swap' : 'move-into',
          x: padX + iconSize / 2,
          y: height / 2,
          size: iconSize,
          color: this.theme().onInk,
          filled: false,
          strokeWidth: 2.4,
        }),
      );
    }
  }

  private updatePersonDragGhostPosition(): void {
    if (!this.personDragGhost) return;
    const pointer = this.pinyaLayer.getRelativePointerPosition();
    if (!pointer) return;
    this.personDragGhost.group.position({ x: pointer.x + 14, y: pointer.y + 14 });
    this.pinyaLayer.batchDraw();
  }

  /**
   * Finds the segment-assignment node under the pointer, excluding `exclude`.
   * Uses geometric bounding-box hit-testing rather than `stage.getIntersection` —
   * Konva skips hit-graph updates globally while any shape is being dragged
   * (`Konva.hitOnDragEnabled` is `false` by default), so `getIntersection` never
   * finds anything mid-drag.
   */
  private findPersonDropTargetAt(exclude: SegmentNodeRef): SegmentNodeRef | null {
    const pointer = this.pinyaLayer.getRelativePointerPosition();
    if (!pointer) return null;
    for (const entry of this.segmentNodeGroupsByKey.values()) {
      if (entry.ref.slotId === exclude.slotId && entry.ref.nodeId === exclude.nodeId) continue;
      const rect = entry.group.getClientRect({ relativeTo: this.pinyaLayer });
      if (
        pointer.x >= rect.x &&
        pointer.x <= rect.x + rect.width &&
        pointer.y >= rect.y &&
        pointer.y <= rect.y + rect.height
      ) {
        return entry.ref;
      }
    }
    return null;
  }

  /** Marks the hovered drop target with a dashed ink outline, and says in the pill what the drop would do. */
  private setPersonDragHoverTarget(target: SegmentNodeRef | null): void {
    const prev = this.personDragHoverRef;
    const same = !!prev && !!target && prev.slotId === target.slotId && prev.nodeId === target.nodeId;
    if (same) return;

    if (prev) this.repaintSegmentNode(prev, null);
    this.personDragHoverRef = target;

    const entry = target ? this.segmentNodeGroupsByKey.get(`${target.slotId}:${target.nodeId}`) : undefined;
    const drop = entry ? (entry.hasAssignment ? 'swap' : 'move') : null;
    if (target) this.repaintSegmentNode(target, drop);
    this.drawPersonDragGhost(drop);
    this.personDragGhost?.group.moveToTop();
    this.pinyaLayer.batchDraw();
  }

  /** Redraws a segment node in place, as a drop target or not; its event handlers live on the group and stay. */
  private repaintSegmentNode(ref: SegmentNodeRef, dropTarget: 'swap' | 'move' | null): void {
    const entry = this.segmentNodeGroupsByKey.get(`${ref.slotId}:${ref.nodeId}`);
    if (!entry) return;
    entry.group.destroyChildren();
    entry.raised.destroyChildren();
    this.paintNode(entry.group, entry.node, { ...entry.input, dropTarget }, entry.raised);
  }

  private clearPersonDragVisuals(): void {
    this.personDragGhost?.group.destroy();
    this.personDragGhost = null;
    if (this.personDragHoverRef) this.repaintSegmentNode(this.personDragHoverRef, null);
    this.personDragHoverRef = null;
  }
}
