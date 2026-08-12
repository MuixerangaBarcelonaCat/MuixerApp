import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Konva from 'konva';
import { FigureNodeItem } from '../../models/figure-template.model';
import { FigureZone, NodeShape, DIRECTION_ZONES } from '@muixer/shared';
import { AssignmentDetail, AttendanceStatus, AvailablePersonPosition, HeightMode, PersonHoverInfo } from '../../models/assignment.model';
import { PersonHoverCardComponent } from '../person-hover-card/person-hover-card.component';
import {
  calculateGhostPosition,
  isGhostEligible,
  isGhostPositionOccupied,
} from '../../utils/ghost-clone.util';
import { screenToStage } from '../../utils/rengla-coordinates.util';
import { computeFitTransform } from '../../utils/fit-to-bounds.util';
import { fitFontSize } from '../../utils/fit-font-size.util';
import { formatAssignedLabel } from '../../utils/assigned-label.util';
import { SHOULDER_HEIGHT_BASELINE_CM } from '../../../../shared/utils/person.util';
import { computeTroncNaturalSize, TRONC_GAP_PX } from '../../utils/tronc-size.util';
import { getFigureColor } from '../../utils/figure-palette.util';
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

export type CanvasMode = 'editor' | 'readonly' | 'composition' | 'assignment' | 'segment-assignment';

export interface OutlineBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  shape: string;
}

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


const GRID_COLOR = '#e5e7eb';
const NODE_COLORS: Record<string, string> = {
  [FigureZone.BASE]: '#EEEEEE',
  [FigureZone.PINYA]: '#3b82f6',
  [FigureZone.TRONC]: '#8b5cf6',
  [FigureZone.FIGURE_DIRECTION]: '#d97706',
  [FigureZone.XICALLA_DIRECTION]: '#db2777',
  [FigureZone.DECORATION]: '#999999',
};
const DEFAULT_NODE_COLOR = '#6b7280';
const DECORATION_STROKE = NODE_COLORS[FigureZone.DECORATION];

function decorationFill(color: string | null | undefined): string {
  return color ?? 'transparent';
}

function createNodeShape(
  shape: string,
  w: number,
  h: number,
  opts: { fill: string; stroke: string; strokeWidth: number; dash?: number[]; opacity?: number },
): Konva.Shape {
  if (shape === NodeShape.ARROW) {
    return new Konva.Line({
      points: [
        -w / 2, -h / 2,
        w / 4, -h / 2,
        w / 2, 0,
        w / 4, h / 2,
        -w / 2, h / 2,
      ],
      closed: true,
      fill: opts.fill,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      dash: opts.dash,
      opacity: opts.opacity,
    });
  }
  if (shape === NodeShape.CIRCLE) {
    const r = Math.min(w, h) / 2;
    return new Konva.Ellipse({
      radiusX: r,
      radiusY: r,
      fill: opts.fill,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      dash: opts.dash,
      opacity: opts.opacity,
    });
  }
  if (shape === NodeShape.ELLIPSE) {
    return new Konva.Ellipse({
      radiusX: w / 2,
      radiusY: h / 2,
      fill: opts.fill,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      dash: opts.dash,
      opacity: opts.opacity,
    });
  }
  return new Konva.Rect({
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    cornerRadius: 4,
    fill: opts.fill,
    stroke: opts.stroke,
    strokeWidth: opts.strokeWidth,
    dash: opts.dash,
    opacity: opts.opacity,
  });
}
const SELECTED_STROKE = '#f59e0b';
const NORMAL_STROKE = '#1e1b4b';
/** Amber conflict outline (Phase 3), matching the observation badge / tronc-view warning hue. */
const CONFLICT_STROKE = '#e11d48';
/** Matches the min/max of the zoom-selector dropdown (25%–300%). */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

@Component({
  selector: 'app-figure-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PersonHoverCardComponent],
  templateUrl: './figure-canvas.component.html',
  styleUrl: './figure-canvas.component.scss',
})
export class FigureCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('editor');
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(20);
  readonly selectedNodeId = input<string | null>(null);
  readonly snapToGrid = input<boolean>(false);
  readonly rotationSnapAngle = input<number>(15);
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  // Assignment mode inputs
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nextPerformanceMap = input<Map<string, string | null>>(new Map());
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  /**
   * Person IDs in conflict in this segment (Phase 3). A node whose assigned person is one of
   * these gets the single amber warning style — same for every conflict kind, no `kind` reaches
   * the canvas by design ("un conflicte és un conflicte"). Empty in production until Phase 5.
   */
  readonly conflictPersonIds = input<Set<string>>(new Set());
  readonly isPlacementMode = input<boolean>(false);
  readonly decorationOpacity = input<number>(1);
  readonly isPast = input<boolean>(false);
  /** personId → positions/isXicalla, used to render the hover card on assigned nodes. */
  readonly personDetailsMap = input<Map<string, { positions: AvailablePersonPosition[]; isXicalla: boolean; notes: string | null; notesEmoji: string | null }>>(new Map());
  /** Extra bounding boxes (in canvas space, x/y = center) included in the readonly fit but not rendered. */
  readonly fitExtraBounds = input<{ x: number; y: number; width: number; height: number }[]>([]);
  /** Outline shapes rendered in a layer BELOW pinyaLayer. Each box matches a node's canvas-space position. */
  readonly outlineBoxes = input<OutlineBox[]>([]);
  // Segment-assignment mode inputs (multi-figure assignment on one canvas)
  readonly selectedSegmentNode = input<SegmentNodeRef | null>(null);
  readonly dimmedSlotIds = input<Set<string>>(new Set());
  /** Slot ad-hoc nodes are created into when `canvasClicked` fires in placement mode. */
  readonly placementSlotId = input<string | null>(null);
  /** Whether ad-hoc nodes can be dragged/rotated/resized directly on this canvas (Nodes extra tab only). */
  readonly adHocNodesEditable = input<boolean>(false);

  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; x: number; y: number }>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();
  readonly nodeResized = output<{
    id: string;
    width: number;
    height: number;
  }>();
  readonly nodeLabelChanged = output<{ id: string; label: string }>();
  readonly zoomChanged = output<number>();
  readonly slotSelected = output<string | null>();
  readonly slotMoved = output<{
    slotId: string;
    offsetX: number;
    offsetY: number;
    angle: number;
  }>();
  readonly troncMoved = output<{
    slotId: string;
    troncPanelX: number | null;
    troncPanelY: number | null;
  }>();
  readonly nodeDoubleClicked = output<string>();
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
  readonly adHocNodeMoved = output<{
    nodeId: string;
    x: number;
    y: number;
  }>();
  readonly adHocNodeTransformed = output<{
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>();
  // Segment-assignment mode outputs
  readonly segmentNodeSelected = output<SegmentNodeRef | null>();
  readonly segmentNodeDoubleClicked = output<SegmentNodeRef>();
  readonly segmentAdHocNodeMoved = output<SegmentNodeRef & { x: number; y: number }>();
  readonly segmentAdHocNodeTransformed = output<
    SegmentNodeRef & { x: number; y: number; width: number; height: number; rotation: number }
  >();
  /** A person was dragged off `source` and released on `target` (drag-and-drop move/swap). */
  readonly segmentNodeDropped = output<{ source: SegmentNodeRef; target: SegmentNodeRef }>();

  private stage!: Konva.Stage;
  private gridLayer!: Konva.Layer;
  private outlineLayer!: Konva.Layer;
  private pinyaLayer!: Konva.Layer;
  private transformer!: Konva.Transformer;

  private resizeObserver: ResizeObserver | null = null;
  /** Reused for measuring label text; not attached to the stage. */
  private labelMeasureProbe: Konva.Text | null = null;
  /**
   * Once the user pans or pinch-zooms in readonly/projection mode, stop
   * re-applying the auto-fit-to-screen transform on data or size changes —
   * otherwise their view would keep snapping back.
   */
  private userAdjustedView = false;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;

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
    { ref: SegmentNodeRef; group: Konva.Group; shape: Konva.Shape; fill: string; hasAssignment: boolean }
  >();
  private personDragSourceRef: SegmentNodeRef | null = null;
  private personDragHoverRef: SegmentNodeRef | null = null;
  private personDragGhost: Konva.Label | null = null;
  /** Swallows the synthetic click Konva fires right after a drag ends. */
  private personDragJustEnded = false;
  // Slot rotation/offset pivot, frozen on first render so adding or moving a node
  // never recenters the figure. Shared with the placement click-to-local math.
  private readonly segmentSlotPivotCache = new Map<string, { x: number; y: number }>();

  readonly zoomLevel = signal(1);
  readonly hoveredPerson = signal<{ info: PersonHoverInfo; top: number; left: number; positionType: string | null } | null>(null);
  // Identifies which node/person the popover is currently showing, so a
  // re-render (e.g. after unassigning via Backspace) can tell whether the
  // hovered assignment still exists — Konva never fires mouseleave when the
  // hovered group is destroyed out from under the cursor by destroyChildren().
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
        if (m === 'composition' || m === 'assignment' || m === 'readonly' || m === 'segment-assignment')
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
      this.highlightedNodeIds();
      this.conflictPersonIds();
      this.decorationOpacity();
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
      this.selectedNodeId();
      this.highlightedNodeIds();
      this.conflictPersonIds();
      this.decorationOpacity();
      if (!this.stage) return;
      if (this.mode() === 'assignment') {
        untracked(() => {
          this.renderAssignmentNodes();
          this.updateTransformer();
        });
      } else if (this.mode() === 'readonly') {
        untracked(() => this.renderReadonlyNodes());
      }
    });

    effect(() => {
      this.outlineBoxes();
      if (!this.stage) return;
      untracked(() => this.renderOutlines());
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

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeStage();
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.clearAllGhostTimers();
    this.clearPersonDragVisuals();
    this.resizeObserver?.disconnect();
    if (this.wheelHandler) {
      this.stage?.container()?.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    this.labelMeasureProbe?.destroy();
    this.labelMeasureProbe = null;
    this.stage?.destroy();
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

  private emitStageTransform(): void {
    if (!this.stage) return;
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
    this.outlineLayer = new Konva.Layer({ listening: false });
    this.pinyaLayer = new Konva.Layer();

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

    this.stage.add(this.gridLayer, this.outlineLayer, this.pinyaLayer);

    this.setupStageInteraction();
  }

  private setupStageInteraction(): void {
    // Pan with middle mouse button or left click when no node selected
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let stageStart = { x: 0, y: 0 };

    this.stage.on('mousedown', (e) => {
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

    const getTouchPoint = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });

    this.stage.on('touchstart', (e) => {
      const touches = e.evt.touches;
      if (touches.length === 1 && e.target === this.stage && this.canPanOrZoom()) {
        panStart = getTouchPoint(touches[0]);
        panStageStart = { x: this.stage.x(), y: this.stage.y() };
      } else if (touches.length === 2) {
        panStart = null;
        pinchStartDist = touchDistance(getTouchPoint(touches[0]), getTouchPoint(touches[1]));
        pinchStartScale = this.stage.scaleX();
        this.userAdjustedView = true;
        e.evt.preventDefault();
      }
    });

    this.stage.on('touchmove', (e) => {
      const touches = e.evt.touches;
      if (touches.length === 2 && pinchStartDist > 0) {
        e.evt.preventDefault();
        const p1 = getTouchPoint(touches[0]);
        const p2 = getTouchPoint(touches[1]);
        const dist = touchDistance(p1, p2);
        const newScale = clampScale(pinchStartScale * (dist / pinchStartDist), ZOOM_MIN, ZOOM_MAX);
        const rect = this.stage.container().getBoundingClientRect();
        const midpoint = touchMidpoint(p1, p2);
        const focal = { x: midpoint.x - rect.left, y: midpoint.y - rect.top };
        const newPos = zoomAroundPoint(this.stage.position(), this.stage.scaleX(), newScale, focal);
        this.stage.scale({ x: newScale, y: newScale });
        this.stage.position(newPos);
        this.zoomLevel.set(newScale);
        this.stage.batchDraw();
        this.emitStageTransform();
      } else if (touches.length === 1 && panStart) {
        e.evt.preventDefault();
        this.userAdjustedView = true;
        const pos = getTouchPoint(touches[0]);
        this.stage.position({
          x: panStageStart.x + (pos.x - panStart.x),
          y: panStageStart.y + (pos.y - panStart.y),
        });
        this.stage.batchDraw();
        this.emitStageTransform();
      }
    });

    this.stage.on('touchend touchcancel', (e) => {
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
      this.emitStageTransform();
    };
    this.stage.container().addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  private updateTransformer(): void {
    const selectedId = this.selectedNodeId();
    const m = this.mode();
    const isEditor = m === 'editor';
    const isAssignment = m === 'assignment';

    if (!selectedId) {
      this.transformer.nodes([]);
      return;
    }

    if (!isEditor && !isAssignment) {
      this.transformer.nodes([]);
      return;
    }

    const konvaNode = this.pinyaLayer.findOne(`#${selectedId}`);
    if (!konvaNode) {
      this.transformer.nodes([]);
      return;
    }

    if (isAssignment) {
      const canvasNode = this.nodes().find((n) => n.id === selectedId);
      if (!(canvasNode as any)?.isAdHoc) {
        this.transformer.nodes([]);
        return;
      }
    }

    this.transformer.nodes([konvaNode]);
    this.transformer.moveToTop();
    this.pinyaLayer.batchDraw();
  }

  private applyReadonlyFit(): void {
    const nodes = this.nodes();
    if (nodes.length === 0) return;
    const allBounds = [...nodes, ...this.fitExtraBounds()];
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
    this.renderOutlines();
    if (this.mode() === 'composition') {
      this.renderCompositionSlots();
    } else if (this.mode() === 'segment-assignment') {
      this.renderSegmentAssignmentSlots();
    } else if (this.mode() === 'assignment') {
      this.renderAssignmentNodes();
    } else if (this.mode() === 'readonly') {
      this.renderReadonlyNodes();
    } else {
      this.renderNodes();
    }
  }

  /**
   * Draws grid lines covering the currently visible world-space rect (derived from the stage's
   * pan/zoom transform), so the grid always fills the viewport instead of being anchored to a
   * fixed area around world (0,0).
   */
  private renderGrid(): void {
    this.gridLayer.destroyChildren();

    if (!this.gridEnabled()) {
      this.gridLayer.batchDraw();
      return;
    }

    const spacing = this.gridSpacing();
    const scale = this.stage.scaleX() || 1;
    const width = this.stage.width();
    const height = this.stage.height();

    const worldLeft = -this.stage.x() / scale;
    const worldTop = -this.stage.y() / scale;
    const worldRight = worldLeft + width / scale;
    const worldBottom = worldTop + height / scale;

    const startCol = Math.floor(worldLeft / spacing) - 1;
    const endCol = Math.ceil(worldRight / spacing) + 1;
    const startRow = Math.floor(worldTop / spacing) - 1;
    const endRow = Math.ceil(worldBottom / spacing) + 1;

    const top = startRow * spacing;
    const bottom = endRow * spacing;
    const left = startCol * spacing;
    const right = endCol * spacing;

    for (let i = startCol; i <= endCol; i++) {
      const x = i * spacing;
      this.gridLayer.add(
        new Konva.Line({
          points: [x, top, x, bottom],
          stroke: GRID_COLOR,
          strokeWidth: 1,
          listening: false,
        }),
      );
    }
    for (let j = startRow; j <= endRow; j++) {
      const y = j * spacing;
      this.gridLayer.add(
        new Konva.Line({
          points: [left, y, right, y],
          stroke: GRID_COLOR,
          strokeWidth: 1,
          listening: false,
        }),
      );
    }

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
      const pinyaNodes = slot.figureTemplate.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );

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
            stroke: isSelected ? SELECTED_STROKE : '#94a3b8',
            strokeWidth: isSelected ? 2 : 1,
            dash: [6, 3],
            fill: isSelected
              ? 'rgba(245,158,11,0.05)'
              : 'rgba(148,163,184,0.05)',
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
            fontFamily: 'Inter, sans-serif',
            fill: isSelected ? SELECTED_STROKE : '#64748b',
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
            fontFamily: 'Inter, sans-serif',
            fill: '#94a3b8',
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
            stroke: isSelected ? SELECTED_STROKE : figColor,
            strokeWidth: isSelected ? 2 : 1,
            dash: [6, 3],
            fill: isSelected ? 'rgba(245,158,11,0.05)' : figColor + '14',
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
            fontFamily: 'Inter, sans-serif',
            fill: isSelected ? SELECTED_STROKE : '#64748b',
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
          const fill =
            node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
          const nodeGroup = new Konva.Group({
            x: node.x,
            y: node.y,
            rotation: node.rotation,
            draggable: false,
            listening: false,
            opacity: 1,
          });

          const shape = createNodeShape(node.shape ?? NodeShape.RECTANGLE, node.width, node.height, {
            fill,
            stroke: NORMAL_STROKE,
            strokeWidth: 1.5,
          });
          nodeGroup.add(shape);

          const textFill = this.getContrastColor(fill);
          nodeGroup.add(
            new Konva.Text({
              text: personAlias
                ? formatAssignedLabel(personAlias, node.climbIndicator)
                : formatAssignedLabel(node.label, node.climbIndicator),
              fontSize: personAlias ? 11 : 10,
              fontStyle: personAlias ? 'bold' : 'normal',
              fontFamily: 'Inter, sans-serif',
              fill: textFill,
              align: 'center',
              verticalAlign: 'middle',
              width: node.width,
              height: node.height - 8,
              x: -node.width / 2,
              y: -node.height / 2 + 4,
              listening: false,
              wrap: 'none',
              ellipsis: true,
            }),
          );

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

    // Bounding box for pivot computation (same logic as renderCompositionSlots)
    const pinyaNodes = slot.figureTemplate.nodes.filter(
      (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
    );
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

    troncGroup.add(new Konva.Rect({
      x: 0,
      y: 0,
      width: troncW,
      height: troncH,
      fill: figColor + '20',
      stroke: figColor,
      strokeWidth: 1.5,
      dash: [6, 3],
      cornerRadius: 4,
      listening: true,
    }));

    troncGroup.add(new Konva.Text({
      x: 0,
      y: 0,
      width: troncW,
      height: troncH,
      text: 'Tronc de ' + (slot.label ?? slot.figureTemplate.name),
      fontSize: 18,
      fontFamily: 'Inter, sans-serif',
      fill: figColor,
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    }));

    // Keep tronc in sync when figure is dragged (linked mode)
    slotGroup.on('dragmove.tronc', () => {
      if (!isLinked) return;
      const pos = this.computeLinkedTroncPosition(slotGroup, figureHalfHeight, troncW, troncH);
      troncGroup.x(pos.x);
      troncGroup.y(pos.y);
      this.pinyaLayer.batchDraw();
    });

    slotGroup.on('dragend.tronc', () => {
      if (!isLinked) return;
      const pos = this.computeLinkedTroncPosition(slotGroup, figureHalfHeight, troncW, troncH);
      troncGroup.x(pos.x);
      troncGroup.y(pos.y);
    });

    troncGroup.on('dragmove', () => {
      if (this.snapToGrid()) {
        const spacing = this.gridSpacing() / 4;
        troncGroup.x(this.snapValue(troncGroup.x(), spacing));
        troncGroup.y(this.snapValue(troncGroup.y(), spacing));
      }
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
    });

    this.pinyaLayer.add(troncGroup);
  }

  private makeRotationHandle(slotId: string, slotGroup: Konva.Group, x: number, y: number): Konva.Circle {
    const handle = new Konva.Circle({
      x,
      y,
      radius: 10,
      fill: '#f59e0b',
      stroke: '#ffffff',
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

  /** Small "circle-alert" glyph (matches ICON_OBSERVACIONS) marking a person with technical observations. */
  private buildObservationBadge(x: number, y: number): Konva.Group {
    const group = new Konva.Group({ x, y, listening: false });
    group.add(
      new Konva.Circle({
        radius: 5,
        fill: '#f59e0b',
        stroke: '#ffffff',
        strokeWidth: 1,
      }),
      new Konva.Line({
        points: [0, -2, 0, 0.5],
        stroke: '#ffffff',
        strokeWidth: 1,
        lineCap: 'round',
      }),
      new Konva.Circle({
        y: 2.3,
        radius: 0.6,
        fill: '#ffffff',
      }),
    );
    return group;
  }

  /** True when this node's assigned person holds >1 placement in the segment (Phase 3). */
  private isConflictAssignment(assignment: AssignmentDetail | null | undefined): boolean {
    return !!assignment && this.conflictPersonIds().has(assignment.person.id);
  }

  /** Single amber warning outline for a conflicted node — identical across all conflict kinds. */
  private applyConflictOutline(shape: Konva.Shape): void {
    shape.stroke(CONFLICT_STROKE);
    shape.strokeWidth(3);
    shape.shadowColor(CONFLICT_STROKE);
    shape.shadowBlur(10);
    shape.shadowOpacity(0.75);
    shape.shadowEnabled(true);
  }

  private renderAssignmentNodes(): void {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.pinyaLayer.destroyChildren();

    const assignments = this.assignments();
    const heightMode = this.heightMode();
    const attendanceMap = this.attendanceMap();
    const nextPerformanceMap = this.nextPerformanceMap();
    const selectedId = this.selectedNodeId();

    const assignmentByNodeId = new Map(assignments.map((a) => [a.node.id, a]));
    this.reconcileHoveredPerson(
      this.hoveredNodeKey ? assignmentByNodeId.get(this.hoveredNodeKey)?.person.id ?? null : undefined,
    );
    const highlighted = this.highlightedNodeIds();

    const past = this.isPast();
    const ATTENDANCE_COLORS: Record<string, string> = {
      ANIRE: past ? '#f59e0b' : '#22c55e',
      ASSISTIT: '#22c55e',
      PENDENT: past ? '#ef4444' : '#f59e0b',
      NO_VAIG: '#ef4444',
    };

    for (const node of this.nodes()) {
      const assignment = assignmentByNodeId.get(node.id);
      const isSelected = selectedId === node.id;
      const isHighlighted = highlighted.has(node.id);
      const isAdHoc = !!(node as any).isAdHoc;
      const isDecoration = node.zone === FigureZone.DECORATION;
      const isDirection = (DIRECTION_ZONES as readonly string[]).includes(
        node.zone,
      );
      const fill = isDecoration
        ? decorationFill(node.color)
        : (node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR);
      const stroke = isSelected
        ? SELECTED_STROKE
        : isHighlighted
          ? '#10b981'
          : isDecoration
            ? DECORATION_STROKE
            : isDirection
              ? '#1e1b4b'
              : NORMAL_STROKE;
      const strokeWidth = isSelected
        ? 3
        : isHighlighted
          ? 2.5
          : isDirection
            ? 2.5
            : isDecoration
              ? 2
              : 1.5;

      const group = new Konva.Group({
        id: node.id,
        x: node.x,
        y: node.y,
        rotation: node.rotation,
        draggable: isAdHoc,
        opacity: isDecoration ? this.decorationOpacity() : 1,
      });

      const shape = createNodeShape(
        (node as any).shape ?? NodeShape.RECTANGLE,
        node.width,
        node.height,
        { fill, stroke, strokeWidth, dash: isAdHoc ? [6, 3] : undefined },
      );
      if (isHighlighted) {
        shape.shadowColor('#10b981');
        shape.shadowBlur(12);
        shape.shadowOpacity(0.7);
        shape.shadowEnabled(true);
      }
      if (this.isConflictAssignment(assignment)) {
        this.applyConflictOutline(shape);
      }
      group.add(shape);

      if (assignment) {
        const alias = assignment.person.alias;
        const textFill = isDecoration
          ? (node.color ? this.getContrastColor(node.color) : '#000000')
          : this.getContrastColor(fill);
        const shoulderH = assignment.person.shoulderHeight;
        const hasValidHeight =
          shoulderH !== null && shoulderH !== 0;
        const nextStatus = nextPerformanceMap.get(assignment.person.id);

        group.add(
          new Konva.Text({
            text: alias,
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
            fill: textFill,
            align: 'center',
            verticalAlign: 'middle',
            width: node.width,
            height: node.height,
            x: -node.width / 2,
            y: -node.height / 2,
            listening: false,
            wrap: 'none',
            ellipsis: true,
          }),
        );

        if (hasValidHeight) {
          const heightText =
            heightMode === 'relative'
              ? `${shoulderH! >= SHOULDER_HEIGHT_BASELINE_CM ? '+' : ''}${shoulderH! - SHOULDER_HEIGHT_BASELINE_CM}`
              : `${shoulderH}`;
          group.add(
            new Konva.Text({
              text: heightText,
              fontSize: 10,
              fontFamily: 'Inter, sans-serif',
              fill: textFill,
              opacity: 0.75,
              align: 'left',
              x: -node.width / 2 + 3,
              y: -node.height / 2 + 2,
              listening: false,
            }),
          );
        }

        if (nextStatus === 'ANIRE') {
          group.add(
            new Konva.Text({
              text: '🎭',
              fontSize: 8,
              x: -node.width / 2 + 2,
              y: node.height / 2 - 11,
              listening: false,
            }),
          );
        }

        const attendanceStatus = attendanceMap.get(assignment.person.id);
        const badgeColor = attendanceStatus ? ATTENDANCE_COLORS[attendanceStatus] : undefined;
        if (badgeColor && attendanceStatus !== 'ASSISTIT') {
          group.add(
            new Konva.Circle({
              x: node.width / 2 - 5,
              y: -node.height / 2 + 5,
              radius: 5,
              fill: badgeColor,
              stroke: '#ffffff',
              strokeWidth: 1,
              listening: false,
            }),
          );
        }

        const personDetails = this.personDetailsMap().get(assignment.person.id);
        if (personDetails?.notes) {
          const probe = this.getLabelMeasureProbe();
          probe.fontSize(11);
          probe.text(alias);
          const badgeX = Math.min(probe.getTextWidth() / 2 + 8, node.width / 2 - 5);
          group.add(
            personDetails.notesEmoji
              ? new Konva.Text({
                  text: personDetails.notesEmoji,
                  fontSize: 12,
                  x: badgeX - 6,
                  y: -6,
                  listening: false,
                })
              : this.buildObservationBadge(badgeX, 0),
          );
        }

        group.on('mouseenter.personHover tap.personHover', (e) => {
          const point = getEventClientPoint(e.evt);
          if (!point) return;
          this.hoveredNodeKey = node.id;
          this.hoveredPersonId = assignment.person.id;
          this.hoveredPerson.set({
            info: {
              alias,
              attendanceStatus: (attendanceStatus as AttendanceStatus) ?? null,
              isXicalla: personDetails?.isXicalla ?? false,
              shoulderHeight: shoulderH,
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
      } else {
        const textFill = isDecoration
          ? (node.color ? this.getContrastColor(node.color) : '#000000')
          : this.getContrastColor(fill);
        group.add(
          new Konva.Text({
            text: formatAssignedLabel(node.label, node.climbIndicator),
            fontSize: 9,
            fontFamily: 'Inter, sans-serif',
            fill: textFill,
            opacity: 0.6,
            align: 'center',
            verticalAlign: 'middle',
            width: node.width,
            height: node.height - 8,
            x: -node.width / 2,
            y: -node.height / 2 + 4,
            listening: false,
            wrap: 'word',
          }),
        );
      }

      if (isAdHoc) {
        group.on('click tap', (e) => {
          this.nodeSelected.emit(node.id);
          if (!isDecoration) {
            const point = getEventClientPoint(e.evt);
            if (point) {
              const containerRect = this.stage.container().getBoundingClientRect();
              this.nodeClicked.emit({
                nodeId: node.id,
                x: point.x - containerRect.left,
                y: point.y - containerRect.top,
              });
            }
          }
        });

        group.on('dragstart', () => {
          this.setCursor('grabbing');
        });

        group.on('dragend', () => {
          this.setCursor('grab');
          this.adHocNodeMoved.emit({
            nodeId: node.id,
            x: Math.round(group.x()),
            y: Math.round(group.y()),
          });
        });

        group.on('dblclick dbltap', () => {
          this.nodeSelected.emit(node.id);
          this.nodeDoubleClicked.emit(node.id);
          this.transformer.nodes([group]);
          this.transformer.moveToTop();
          this.pinyaLayer.batchDraw();
        });

        group.on('transformend', () => {
          const scaleX = group.scaleX();
          const scaleY = group.scaleY();
          group.scaleX(1);
          group.scaleY(1);

          this.adHocNodeTransformed.emit({
            nodeId: node.id,
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
      } else {
        group.on('click tap', (e) => {
          this.nodeSelected.emit(node.id);
          const point = getEventClientPoint(e.evt);
          if (point) {
            const containerRect = this.stage.container().getBoundingClientRect();
            this.nodeClicked.emit({
              nodeId: node.id,
              x: point.x - containerRect.left,
              y: point.y - containerRect.top,
            });
          }
        });

        group.on('dblclick dbltap', () => {
          this.nodeDoubleClicked.emit(node.id);
        });

        group.on('mouseenter', () => {
          this.setCursor('pointer');
        });
        group.on('mouseleave', () => {
          this.setCursor('default');
        });
      }

      this.pinyaLayer.add(group);
    }

    this.pinyaLayer.add(this.transformer);
    this.pinyaLayer.batchDraw();
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
      this.highlightedNodeIds(),
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
          fontFamily: 'Inter, sans-serif',
          fill: '#64748b',
          opacity: isDimmedSlot ? 0.25 : 1,
          align: 'center',
          verticalAlign: 'middle',
          height: labelHeight,
          listening: false,
          ellipsis: true,
        }),
      );

      for (const rn of slotNodes) {
        const nodeGroup = this.buildSegmentAssignmentNodeGroup(rn);
        slotGroup.add(nodeGroup);
        if (editable && rn.isSelected && rn.node.isAdHoc) {
          selectedEditableGroup = nodeGroup;
        }
      }

      this.pinyaLayer.add(slotGroup);
    }

    this.pinyaLayer.add(this.transformer);
    if (selectedEditableGroup) {
      this.transformer.nodes([selectedEditableGroup]);
      this.transformer.moveToTop();
    }
    this.pinyaLayer.batchDraw();
  }

  private buildSegmentAssignmentNodeGroup(rn: SegmentRenderNode): Konva.Group {
    const node = rn.node;
    const assignment = rn.assignment;
    const heightMode = this.heightMode();
    const attendanceMap = this.attendanceMap();
    const nextPerformanceMap = this.nextPerformanceMap();
    const ref: SegmentNodeRef = { slotId: rn.slotId, nodeId: node.id };

    const past = this.isPast();
    const ATTENDANCE_COLORS: Record<string, string> = {
      ANIRE: past ? '#f59e0b' : '#22c55e',
      ASSISTIT: '#22c55e',
      PENDENT: past ? '#ef4444' : '#f59e0b',
      NO_VAIG: '#ef4444',
    };

    const isAdHoc = !!node.isAdHoc;
    const isDecoration = node.zone === FigureZone.DECORATION;
    const fill = isDecoration
      ? decorationFill(node.color)
      : (node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR);
    const stroke = rn.isSelected
      ? SELECTED_STROKE
      : rn.isHighlighted
        ? '#10b981'
        : isDecoration
          ? DECORATION_STROKE
          : NORMAL_STROKE;
    const strokeWidth = rn.isSelected ? 3 : rn.isHighlighted ? 2.5 : isDecoration ? 2 : 1.5;

    const isEditable = isAdHoc && this.adHocNodesEditable();

    const group = new Konva.Group({
      id: rn.key,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      draggable: isEditable,
      opacity: rn.isDimmed ? 0.25 : isDecoration ? this.decorationOpacity() : 1,
    });

    const shape = createNodeShape(node.shape ?? NodeShape.RECTANGLE, node.width, node.height, {
      fill,
      stroke,
      strokeWidth,
      dash: isAdHoc ? [6, 3] : undefined,
    });
    if (rn.isHighlighted) {
      shape.shadowColor('#10b981');
      shape.shadowBlur(12);
      shape.shadowOpacity(0.7);
      shape.shadowEnabled(true);
    }
    if (this.isConflictAssignment(assignment)) {
      this.applyConflictOutline(shape);
    }
    group.add(shape);
    const personVisualStartIndex = group.getChildren().length;

    if (assignment) {
      const alias = formatAssignedLabel(assignment.person.alias, node.climbIndicator);
      const textFill = isDecoration
        ? (node.color ? this.getContrastColor(node.color) : '#000000')
        : this.getContrastColor(fill);
      const shoulderH = assignment.person.shoulderHeight;
      const hasValidHeight = shoulderH !== null && shoulderH !== 0;
      const nextStatus = nextPerformanceMap.get(assignment.person.id);

      group.add(
        new Konva.Text({
          text: alias,
          fontSize: 11,
          fontFamily: 'Inter, sans-serif',
          fill: textFill,
          align: 'center',
          verticalAlign: 'middle',
          width: node.width,
          height: node.height,
          x: -node.width / 2,
          y: -node.height / 2,
          listening: false,
          wrap: 'none',
          ellipsis: true,
        }),
      );

      if (hasValidHeight) {
        const heightText =
          heightMode === 'relative'
            ? `${shoulderH! >= SHOULDER_HEIGHT_BASELINE_CM ? '+' : ''}${shoulderH! - SHOULDER_HEIGHT_BASELINE_CM}`
            : `${shoulderH}`;
        group.add(
          new Konva.Text({
            text: heightText,
            fontSize: 10,
            fontFamily: 'Inter, sans-serif',
            fill: textFill,
            opacity: 0.75,
            align: 'left',
            x: -node.width / 2 + 3,
            y: -node.height / 2 + 2,
            listening: false,
          }),
        );
      }

      if (nextStatus === 'ANIRE') {
        group.add(
          new Konva.Text({
            text: '🎭',
            fontSize: 8,
            x: -node.width / 2 + 2,
            y: node.height / 2 - 11,
            listening: false,
          }),
        );
      }

      const attendanceStatus = attendanceMap.get(assignment.person.id);
      const badgeColor = attendanceStatus ? ATTENDANCE_COLORS[attendanceStatus] : undefined;
      if (badgeColor && attendanceStatus !== 'ASSISTIT') {
        group.add(
          new Konva.Circle({
            x: node.width / 2 - 5,
            y: -node.height / 2 + 5,
            radius: 5,
            fill: badgeColor,
            stroke: '#ffffff',
            strokeWidth: 1,
            listening: false,
          }),
        );
      }

      const personDetails = this.personDetailsMap().get(assignment.person.id);
      if (personDetails?.notes) {
        const probe = this.getLabelMeasureProbe();
        probe.fontSize(11);
        probe.text(alias);
        const badgeX = Math.min(probe.getTextWidth() / 2 + 8, node.width / 2 - 5);
        group.add(
          personDetails.notesEmoji
            ? new Konva.Text({
                text: personDetails.notesEmoji,
                fontSize: 12,
                x: badgeX - 6,
                y: -6,
                listening: false,
              })
            : this.buildObservationBadge(badgeX, 0),
        );
      }

      group.on('mouseenter.personHover tap.personHover', (e) => {
        const point = getEventClientPoint(e.evt);
        if (!point) return;
        this.hoveredNodeKey = `${rn.slotId}:${node.id}`;
        this.hoveredPersonId = assignment.person.id;
        this.hoveredPerson.set({
          info: {
            alias,
            attendanceStatus: (attendanceStatus as AttendanceStatus) ?? null,
            isXicalla: personDetails?.isXicalla ?? false,
            shoulderHeight: shoulderH,
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
    } else {
      const textFill = isDecoration
        ? (node.color ? this.getContrastColor(node.color) : '#000000')
        : this.getContrastColor(fill);
      group.add(
        new Konva.Text({
          text: formatAssignedLabel(node.label, node.climbIndicator),
          fontSize: 9,
          fontFamily: 'Inter, sans-serif',
          fill: textFill,
          opacity: 0.6,
          align: 'center',
          verticalAlign: 'middle',
          width: node.width,
          height: node.height - 8,
          x: -node.width / 2,
          y: -node.height / 2 + 4,
          listening: false,
          wrap: 'word',
        }),
      );
    }

    group.on('click tap', () => {
      // A drag that ended without a valid drop target fires a synthetic click;
      // swallow it so it doesn't re-select the node right after a cancelled drag.
      if (this.personDragJustEnded) {
        this.personDragJustEnded = false;
        return;
      }
      this.segmentNodeSelected.emit(ref);
    });

    group.on('dblclick dbltap', () => {
      this.segmentNodeDoubleClicked.emit(ref);
    });

    const isPersonDraggable = !!assignment && !isEditable;

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
      const personVisualNodes = group.getChildren().slice(personVisualStartIndex);
      const homePos = { x: node.x, y: node.y };
      const alias = formatAssignedLabel(assignment!.person.alias, node.climbIndicator);

      group.draggable(true);
      // Pin the node in place — only the floating ghost label moves.
      group.dragBoundFunc(() => group.getAbsolutePosition());

      group.on('dragstart', () => {
        this.setCursor('grabbing');
        this.personDragSourceRef = ref;
        for (const n of personVisualNodes) n.visible(false);
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
        for (const n of personVisualNodes) n.visible(true);
        const target = this.personDragHoverRef;
        this.clearPersonDragVisuals();
        this.personDragSourceRef = null;
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

    this.segmentNodeGroupsByKey.set(rn.key, { ref, group, shape, fill, hasAssignment: !!assignment });

    return group;
  }

  private renderReadonlyNodes(): void {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.pinyaLayer.destroyChildren();

    const assignments = this.assignments();
    const assignmentByNodeId = new Map(assignments.map((a) => [a.node.id, a]));
    const attendanceMap = this.attendanceMap();
    const past = this.isPast();
    const ATTENDANCE_COLORS: Record<string, string> = {
      ANIRE: past ? '#f59e0b' : '#22c55e',
      ASSISTIT: '#22c55e',
      PENDENT: past ? '#ef4444' : '#f59e0b',
      NO_VAIG: '#ef4444',
    };

    for (const node of this.nodes()) {
      const assignment = assignmentByNodeId.get(node.id);
      const isDecoration = node.zone === FigureZone.DECORATION;
      const fill = isDecoration
        ? decorationFill(node.color)
        : (node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR);

      const group = new Konva.Group({
        id: node.id,
        x: node.x,
        y: node.y,
        rotation: node.rotation,
        draggable: false,
        opacity: 1,
      });

      const shape = createNodeShape(
        (node as { shape?: string }).shape ?? NodeShape.RECTANGLE,
        node.width,
        node.height,
        {
          fill,
          stroke: isDecoration ? DECORATION_STROKE : NORMAL_STROKE,
          strokeWidth: isDecoration ? 2 : 1.5,
        },
      );
      if (this.isConflictAssignment(assignment)) {
        this.applyConflictOutline(shape);
      }
      group.add(shape);

      const textFill = isDecoration
        ? (node.color ? this.getContrastColor(node.color) : '#000000')
        : this.getContrastColor(fill);
      const displayText = formatAssignedLabel(
        assignment ? assignment.person.alias : node.label,
        node.climbIndicator,
      );
      const { fontSize, wrap } = this.fitFontSizeForNode(
        displayText,
        node.width,
        node.height,
        {
          maxFontSize: assignment || isDecoration ? 18 : 9,
          minFontSize: 5,
          fontStyle: assignment ? 'bold' : 'normal',
          wrap: assignment ? 'none' : 'word',
        },
      );

      group.add(
        new Konva.Text({
          text: displayText,
          fontSize,
          fontStyle: assignment ? 'bold' : 'normal',
          fontFamily: 'Inter, sans-serif',
          fill: textFill,
          opacity: assignment || isDecoration ? 1 : 0.5,
          align: 'center',
          verticalAlign: 'middle',
          width: node.width,
          height: node.height,
          x: -node.width / 2,
          y: -node.height / 2,
          listening: false,
          wrap,
          ellipsis: false,
        }),
      );

      if (assignment) {
        const attendanceStatus = attendanceMap.get(assignment.person.id);
        const badgeColor = attendanceStatus ? ATTENDANCE_COLORS[attendanceStatus] : undefined;
        if (badgeColor && attendanceStatus !== 'ASSISTIT') {
          group.add(
            new Konva.Circle({
              x: node.width / 2 - 5,
              y: -node.height / 2 + 5,
              radius: 5,
              fill: badgeColor,
              stroke: '#ffffff',
              strokeWidth: 1,
              listening: false,
            }),
          );
        }
      }

      this.pinyaLayer.add(group);
    }

    this.pinyaLayer.add(this.transformer);
    this.pinyaLayer.batchDraw();

    if (this.nodes().length > 0 && !this.userAdjustedView) {
      setTimeout(() => {
        this.applyReadonlyFit();
        this.stage.batchDraw();
      });
    }
  }

  private renderOutlines(): void {
    this.outlineLayer.destroyChildren();
    for (const box of this.outlineBoxes()) {
      const group = new Konva.Group({ x: box.x, y: box.y, rotation: box.rotation });
      const shape = createNodeShape(box.shape, box.width, box.height, {
        fill: box.color,
        stroke: 'transparent',
        strokeWidth: 0,
      });
      shape.shadowColor(box.color);
      shape.shadowBlur(30);
      shape.shadowOpacity(0.95);
      shape.shadowOffset({ x: 0, y: 0 });
      group.add(shape);
      this.outlineLayer.add(group);
    }
    this.outlineLayer.batchDraw();
  }

  private buildNodeGroup(
    node: FigureNodeItem,
    isEditor: boolean,
    isSelected: boolean,
    renglaMaxPosition: Map<string, number> = new Map(),
  ): Konva.Group {
    const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
    const stroke = isSelected ? SELECTED_STROKE : NORMAL_STROKE;
    const strokeWidth = isSelected ? 3 : 1.5;

    const group = new Konva.Group({
      id: node.id,
      x: node.x,
      y: node.y,
      rotation: node.rotation,
      draggable: isEditor,
    });

    const shape = createNodeShape(node.shape ?? NodeShape.RECTANGLE, node.width, node.height, {
      fill,
      stroke,
      strokeWidth,
    });
    group.add(shape);

    // Label
    const textFill = this.getContrastColor(fill);
    const text = new Konva.Text({
      text: node.label,
      fontSize: 10,
      fontFamily: 'Inter, sans-serif',
      fill: textFill,
      align: 'center',
      verticalAlign: 'middle',
      width: node.width,
      height: node.height - 8,
      x: -node.width / 2,
      y: -node.height / 2 + 4,
      listening: false,
      wrap: 'word',
      ellipsis: false,
    });
    group.add(text);

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
        fill: 'rgba(0,0,0,0.55)',
        cornerRadius: 2,
        listening: false,
      });
      group.add(badgeBg);

      const badgeLabel = new Konva.Text({
        text: badgeText,
        fontSize: badgeFontSize,
        fontFamily: 'Inter, monospace',
        fill: '#ffffff',
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
    const nodeColor =
      node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;

    const ghost = new Konva.Group({
      x: pos.x,
      y: pos.y,
      rotation: node.rotation,
      listening: true,
    });

    const shape = createNodeShape(node.shape ?? NodeShape.RECTANGLE, node.width, node.height, {
      fill: nodeColor,
      stroke: 'black',
      strokeWidth: 2,
      dash: [6, 4],
      opacity: 0.4,
    });
    ghost.add(shape);

    ghost.add(
      new Konva.Text({
        text: '+',
        fontSize: 24,
        fontFamily: 'Inter, sans-serif',
        fill: 'black',
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

  private getLabelMeasureProbe(): Konva.Text {
    if (!this.labelMeasureProbe) {
      this.labelMeasureProbe = new Konva.Text({
        fontFamily: 'Inter, sans-serif',
        listening: false,
      });
    }
    return this.labelMeasureProbe;
  }

  /**
   * Shrinks font size (and optionally wraps) so the full label fits inside the node box.
   * Used in readonly/projection mode instead of ellipsis truncation.
   */
  private fitFontSizeForNode(
    text: string,
    boxWidth: number,
    boxHeight: number,
    opts: {
      maxFontSize: number;
      minFontSize?: number;
      fontStyle?: string;
      wrap?: 'none' | 'word';
      padding?: number;
    },
  ): { fontSize: number; wrap: 'none' | 'word' } {
    const padding = opts.padding ?? 4;
    const maxW = Math.max(1, boxWidth - padding * 2);
    const maxH = Math.max(1, boxHeight - padding * 2);
    const minFont = opts.minFontSize ?? 5;
    const maxFont = opts.maxFontSize;
    const wrap = opts.wrap ?? 'none';
    const probe = this.getLabelMeasureProbe();

    probe.text(text);
    probe.fontStyle(opts.fontStyle ?? 'normal');
    probe.wrap(wrap);
    probe.setAttr('width', wrap === 'word' ? maxW : undefined);

    const fontSize = fitFontSize(maxFont, minFont, maxW, maxH, wrap, (fs) => {
      probe.fontSize(fs);
      return {
        width: probe.getWidth(),
        height: probe.getHeight(),
      };
    });

    return { fontSize, wrap };
  }

  /** Returns #000 or #fff depending on background luminance */
  private getContrastColor(hex: string): string {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
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
    label.add(new Konva.Tag({ fill: '#1f2937', cornerRadius: 4, pointerDirection: 'down', pointerWidth: 8, pointerHeight: 4 }));
    label.add(new Konva.Text({ text: 'Node creat manualment', fontSize: 11, fontFamily: 'Inter, sans-serif', fill: '#ffffff', padding: 4 }));
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
    const label = new Konva.Label({ opacity: 0.95, scaleX: 1.15, scaleY: 1.15, listening: false });
    label.add(
      new Konva.Tag({
        fill: '#1f2937',
        cornerRadius: 6,
        shadowColor: 'black',
        shadowBlur: 8,
        shadowOpacity: 0.35,
        shadowOffsetY: 2,
      }),
    );
    label.add(
      new Konva.Text({
        text: alias,
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        fill: '#ffffff',
        padding: 6,
      }),
    );
    this.personDragGhost = label;
    this.pinyaLayer.add(label);
    this.updatePersonDragGhostPosition();
    label.moveToTop();
  }

  private updatePersonDragGhostPosition(): void {
    if (!this.personDragGhost) return;
    const pointer = this.pinyaLayer.getRelativePointerPosition();
    if (!pointer) return;
    this.personDragGhost.position({ x: pointer.x + 14, y: pointer.y + 14 });
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

  /** Highlights the hovered drop target: amber fill for a swap, green for a move into an empty node. */
  private setPersonDragHoverTarget(target: SegmentNodeRef | null): void {
    const prev = this.personDragHoverRef;
    const same = !!prev && !!target && prev.slotId === target.slotId && prev.nodeId === target.nodeId;
    if (same) return;

    if (prev) {
      const prevEntry = this.segmentNodeGroupsByKey.get(`${prev.slotId}:${prev.nodeId}`);
      prevEntry?.shape.fill(prevEntry.fill);
    }
    this.personDragHoverRef = target;

    if (target) {
      const entry = this.segmentNodeGroupsByKey.get(`${target.slotId}:${target.nodeId}`);
      entry?.shape.fill(entry.hasAssignment ? '#f59e0b' : '#22c55e');
      this.personDragGhost?.moveToTop();
    }
    this.pinyaLayer.batchDraw();
  }

  private clearPersonDragVisuals(): void {
    this.personDragGhost?.destroy();
    this.personDragGhost = null;
    if (this.personDragHoverRef) {
      const entry = this.segmentNodeGroupsByKey.get(
        `${this.personDragHoverRef.slotId}:${this.personDragHoverRef.nodeId}`,
      );
      entry?.shape.fill(entry.fill);
    }
    this.personDragHoverRef = null;
  }
}
