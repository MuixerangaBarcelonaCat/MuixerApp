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
import { CompositionSlotItem } from '../../models/composition.model';
import { FigureZone, NodeShape } from '@muixer/shared';
import { AssignmentDetail, HeightMode } from '../../models/assignment.model';
import {
  calculateGhostPosition,
  isGhostEligible,
} from '../../utils/ghost-clone.util';

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
  ringLevel?: number | null;
  originNodeId?: string | null;
  renglaId?: string | null;
  renglaPosition?: number | null;
  isAdHoc?: boolean;
}

export type CanvasMode = 'editor' | 'readonly' | 'composition' | 'assignment';

export interface CompositionSlotWithNodes {
  slotId: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: {
    id: string;
    name: string;
    hasPinya: boolean;
    nodes: FigureNodeItem[];
  };
}

export function compositionSlotItemToCanvasSlot(slot: CompositionSlotItem): CompositionSlotWithNodes {
  return {
    slotId: slot.id,
    label: slot.label,
    offsetX: slot.offsetX,
    offsetY: slot.offsetY,
    sortOrder: slot.sortOrder,
    figureTemplate: {
      id: slot.figureTemplate.id,
      name: slot.figureTemplate.name,
      hasPinya: slot.figureTemplate.hasPinya,
      nodes: slot.figureTemplate.nodes,
    },
  };
}

const GRID_COLOR = '#e5e7eb';
const NODE_COLORS: Record<string, string> = {
  [FigureZone.BASE]: '#EEEEEE',
  [FigureZone.PINYA]: '#3b82f6',
  [FigureZone.TRONC]: '#8b5cf6',
  [FigureZone.FIGURE_DIRECTION]: '#f59e0b',
  [FigureZone.XICALLA_DIRECTION]: '#ec4899',
};
const DEFAULT_NODE_COLOR = '#6b7280';
const SELECTED_STROKE = '#f59e0b';
const NORMAL_STROKE = '#1e1b4b';
const COMPOSITION_SLOT_SCALE = 0.5;

@Component({
  selector: 'app-figure-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './figure-canvas.component.html',
  styleUrl: './figure-canvas.component.scss',
})
export class FigureCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly nodes = input<CanvasNode[]>([]);
  readonly mode = input<CanvasMode>('editor');
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(40);
  readonly selectedNodeId = input<string | null>(null);
  readonly snapToGrid = input<boolean>(false);
  readonly compositionSlots = input<CompositionSlotWithNodes[]>([]);
  readonly selectedSlotId = input<string | null>(null);
  // Assignment mode inputs
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');
  readonly attendanceMap = input<Map<string, string>>(new Map());
  readonly nextPerformanceMap = input<Map<string, string | null>>(new Map());
  readonly highlightedNodeIds = input<Set<string>>(new Set());
  readonly isPlacementMode = input<boolean>(false);

  readonly nodeSelected = output<string | null>();
  readonly nodeClicked = output<{ nodeId: string; x: number; y: number }>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();
  readonly nodeResized = output<{ id: string; width: number; height: number }>();
  readonly nodeLabelChanged = output<{ id: string; label: string }>();
  readonly zoomChanged = output<number>();
  readonly slotSelected = output<string | null>();
  readonly slotMoved = output<{ slotId: string; offsetX: number; offsetY: number }>();
  readonly nodeDoubleClicked = output<string>();
  readonly stageTransformChanged = output<{ x: number; y: number; scaleX: number; scaleY: number }>();
  readonly ghostCloneRequested = output<{ sourceNode: CanvasNode; targetPosition: { x: number; y: number } }>();
  readonly canvasClicked = output<{ x: number; y: number }>();
  readonly adHocNodeMoved = output<{ nodeId: string; x: number; y: number }>();
  readonly adHocNodeTransformed = output<{ nodeId: string; x: number; y: number; width: number; height: number; rotation: number }>();

  private stage!: Konva.Stage;
  private gridLayer!: Konva.Layer;
  private pinyaLayer!: Konva.Layer;
  private transformer!: Konva.Transformer;

  private resizeObserver: ResizeObserver | null = null;
  /** Reused for measuring label text; not attached to the stage. */
  private labelMeasureProbe: Konva.Text | null = null;

  private activeGhostGroup: Konva.Group | null = null;
  private ghostHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostSourceNodeId: string | null = null;
  private adHocTooltip: Konva.Label | null = null;

  readonly zoomLevel = signal(1);

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
        if (m === 'composition' || m === 'assignment' || m === 'readonly') return;
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
      this.nodes();
      this.assignments();
      this.heightMode();
      this.attendanceMap();
      this.nextPerformanceMap();
      this.selectedNodeId();
      this.highlightedNodeIds();
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
    this.resizeObserver?.disconnect();
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

  fitAllSlots(): void {
    // Collect all slot groups (exclude the Transformer which is also a Group subclass)
    const groups = this.pinyaLayer.getChildren().filter(
      (node) => node.className === 'Group',
    ) as Konva.Group[];

    if (groups.length === 0) {
      this.fitToScreen();
      return;
    }

    // Compute union bounding box in layer-local (scene) coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const group of groups) {
      const rect = group.getClientRect({ relativeTo: this.pinyaLayer });
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    const bbW = maxX - minX;
    const bbH = maxY - minY;
    if (bbW <= 0 || bbH <= 0) {
      this.fitToScreen();
      return;
    }

    const padding = 40;
    const scaleX = (this.stage.width() - padding * 2) / bbW;
    const scaleY = (this.stage.height() - padding * 2) / bbH;
    const newScale = Math.min(scaleX, scaleY, 2);

    // Center the bounding box in the viewport
    const newX = (this.stage.width() - bbW * newScale) / 2 - minX * newScale;
    const newY = (this.stage.height() - bbH * newScale) / 2 - minY * newScale;

    this.stage.scale({ x: newScale, y: newScale });
    this.stage.position({ x: newX, y: newY });
    this.zoomLevel.set(newScale);
    this.stage.batchDraw();
    this.emitStageTransform();
  }

  getStageTransform(): { x: number; y: number; scaleX: number; scaleY: number } {
    if (!this.stage) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    return {
      x: this.stage.x(),
      y: this.stage.y(),
      scaleX: this.stage.scaleX(),
      scaleY: this.stage.scaleY(),
    };
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

    this.stage.add(this.gridLayer, this.pinyaLayer);

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
      const noSelection = this.mode() === 'composition'
        ? !this.selectedSlotId()
        : !this.selectedNodeId();

      // Allow panning with middle button or left button on empty canvas
      if (isMiddleButton || (isLeftButton && clickedOnStage && noSelection)) {
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
      const noSelection = this.mode() === 'composition'
        ? !this.selectedSlotId()
        : !this.selectedNodeId();

      if (clickedOnStage && noSelection && (this.mode() === 'editor' || this.mode() === 'composition')) {
        this.setCursor('grab');
      }
    });

    this.stage.on('mouseleave', () => {
      if (!isPanning) {
        this.setCursor('default');
      }
    });

    // Deselect on stage click or place ad-hoc node
    this.stage.on('click', (e) => {
      if (e.target === this.stage) {
        if (this.isPlacementMode()) {
          const pos = this.stage.getPointerPosition();
          if (pos) {
            const scale = this.stage.scaleX();
            const stagePos = this.stage.position();
            this.canvasClicked.emit({
              x: Math.round((pos.x - stagePos.x) / scale),
              y: Math.round((pos.y - stagePos.y) / scale),
            });
          }
          return;
        }
        if (this.mode() === 'composition') {
          this.slotSelected.emit(null);
        } else {
          this.nodeSelected.emit(null);
          this.transformer.nodes([]);
        }
      }
    });
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

  private resizeStage(): void {
    const container = this.containerRef.nativeElement;
    this.stage.width(container.clientWidth);
    this.stage.height(container.clientHeight);
    this.renderGrid();
    this.stage.batchDraw();
  }

  private renderAll(): void {
    this.renderGrid();
    if (this.mode() === 'composition') {
      this.renderCompositionSlots();
    } else if (this.mode() === 'assignment') {
      this.renderAssignmentNodes();
    } else if (this.mode() === 'readonly') {
      this.renderReadonlyNodes();
      setTimeout(() => this.fitToScreen());
    } else {
      this.renderNodes();
    }
  }

  private renderGrid(): void {
    this.gridLayer.destroyChildren();

    if (!this.gridEnabled()) {
      this.gridLayer.batchDraw();
      return;
    }

    const spacing = this.gridSpacing();
    const width = this.stage.width();
    const height = this.stage.height();

    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    for (let i = 0; i < cols; i++) {
      this.gridLayer.add(
        new Konva.Line({
          points: [i * spacing, 0, i * spacing, rows * spacing],
          stroke: GRID_COLOR,
          strokeWidth: 1,
          listening: false,
        }),
      );
    }
    for (let j = 0; j < rows; j++) {
      this.gridLayer.add(
        new Konva.Line({
          points: [0, j * spacing, cols * spacing, j * spacing],
          stroke: GRID_COLOR,
          strokeWidth: 1,
          listening: false,
        }),
      );
    }

    this.gridLayer.batchDraw();
  }

  private renderNodes(): void {
    this.clearAllGhostTimers();

    this.transformer.nodes([]);
    this.transformer.remove();

    this.pinyaLayer.destroyChildren();

    const isEditor = this.mode() === 'editor';
    const selectedId = this.selectedNodeId();
    const allNodes = this.nodes() as FigureNodeItem[];

    for (const node of allNodes) {
      const group = this.buildNodeGroup(node, isEditor, selectedId === node.id);
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
    const sortedSlots = [...this.compositionSlots()].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const slot of sortedSlots) {
      const pinyaNodes = slot.figureTemplate.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );

      const isSelected = slot.slotId === selectedSlotId;

      const slotGroup = new Konva.Group({
        id: slot.slotId,
        x: slot.offsetX,
        y: slot.offsetY,
        draggable: true,
        scaleX: COMPOSITION_SLOT_SCALE,
        scaleY: COMPOSITION_SLOT_SCALE,
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
            fill: isSelected ? 'rgba(245,158,11,0.05)' : 'rgba(148,163,184,0.05)',
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
      } else {
        // Compute bounding box for the bounding rect
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of pinyaNodes) {
          minX = Math.min(minX, n.x - n.width / 2);
          minY = Math.min(minY, n.y - n.height / 2);
          maxX = Math.max(maxX, n.x + n.width / 2);
          maxY = Math.max(maxY, n.y + n.height / 2);
        }

        const padding = 8;
        const labelHeight = 16;

        // Bounding rect with listening: true — acts as the hit area for the whole group
        slotGroup.add(
          new Konva.Rect({
            x: minX - padding,
            y: minY - padding - labelHeight,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2 + labelHeight,
            stroke: isSelected ? SELECTED_STROKE : '#94a3b8',
            strokeWidth: isSelected ? 2 : 1,
            dash: [6, 3],
            fill: isSelected ? 'rgba(245,158,11,0.05)' : 'transparent',
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

        // Render pinya-view nodes (read-only)
        for (const node of pinyaNodes) {
          const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
          const nodeGroup = new Konva.Group({
            x: node.x,
            y: node.y,
            rotation: node.rotation,
            draggable: false,
            listening: false,
          });

          let shape: Konva.Shape;
          if (node.shape === NodeShape.ELLIPSE) {
            shape = new Konva.Ellipse({
              radiusX: node.width / 2,
              radiusY: node.height / 2,
              fill,
              stroke: NORMAL_STROKE,
              strokeWidth: 1.5,
            });
          } else {
            shape = new Konva.Rect({
              x: -node.width / 2,
              y: -node.height / 2,
              width: node.width,
              height: node.height,
              cornerRadius: 4,
              fill,
              stroke: NORMAL_STROKE,
              strokeWidth: 1.5,
            });
          }
          nodeGroup.add(shape);

          const textFill = this.getContrastColor(fill);
          nodeGroup.add(
            new Konva.Text({
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
            }),
          );

          slotGroup.add(nodeGroup);
        }
      }

      // Slot group interaction — same for real slots and placeholders
      slotGroup.on('click tap', () => {
        this.slotSelected.emit(slot.slotId);
      });

      slotGroup.on('dragmove', () => {
        if (this.snapToGrid()) {
          const spacing = this.gridSpacing();
          slotGroup.x(this.snapValue(slotGroup.x(), spacing));
          slotGroup.y(this.snapValue(slotGroup.y(), spacing));
        }
      });

      slotGroup.on('dragend', () => {
        this.slotMoved.emit({
          slotId: slot.slotId,
          offsetX: Math.round(slotGroup.x()),
          offsetY: Math.round(slotGroup.y()),
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
    }

    this.pinyaLayer.add(this.transformer);
    this.pinyaLayer.batchDraw();
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
    const highlighted = this.highlightedNodeIds();

    const ATTENDANCE_COLORS: Record<string, string> = {
      ANIRE: '#22c55e',
      PENDENT: '#f59e0b',
      NO_VAIG: '#ef4444',
    };

    for (const node of this.nodes()) {
      const assignment = assignmentByNodeId.get(node.id);
      const isSelected = selectedId === node.id;
      const isHighlighted = highlighted.has(node.id);
      const isAdHoc = !!(node as any).isAdHoc;
      const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
      const stroke = isSelected ? SELECTED_STROKE : isHighlighted ? '#10b981' : NORMAL_STROKE;
      const strokeWidth = isSelected ? 3 : isHighlighted ? 2.5 : 1.5;

      const group = new Konva.Group({
        id: node.id,
        x: node.x,
        y: node.y,
        rotation: node.rotation,
        draggable: isAdHoc,
      });

      let shape: Konva.Shape;
      if ((node as any).shape === NodeShape.ELLIPSE) {
        shape = new Konva.Ellipse({
          radiusX: node.width / 2,
          radiusY: node.height / 2,
          fill,
          stroke,
          strokeWidth,
          dash: isAdHoc ? [6, 3] : undefined,
        });
      } else {
        shape = new Konva.Rect({
          x: -node.width / 2,
          y: -node.height / 2,
          width: node.width,
          height: node.height,
          cornerRadius: 4,
          fill,
          stroke,
          strokeWidth,
          dash: isAdHoc ? [6, 3] : undefined,
        });
      }
      if (isHighlighted) {
        shape.shadowColor('#10b981');
        shape.shadowBlur(12);
        shape.shadowOpacity(0.7);
        shape.shadowEnabled(true);
      }
      group.add(shape);

      if (assignment) {
        const alias = assignment.person.alias;
        const textFill = this.getContrastColor(fill);
        const shoulderH = assignment.person.shoulderHeight;
        const hasValidHeight = shoulderH !== null && shoulderH !== 0 && shoulderH !== 140;
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
          const heightText = heightMode === 'relative'
            ? `${shoulderH! >= 140 ? '+' : ''}${shoulderH! - 140}`
            : `${shoulderH}`;
          group.add(
            new Konva.Text({
              text: heightText,
              fontSize: 7,
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
        if (attendanceStatus) {
          const badgeColor = ATTENDANCE_COLORS[attendanceStatus] ?? '#6b7280';
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
      } else {
        const textFill = this.getContrastColor(fill);
        group.add(
          new Konva.Text({
            text: node.label,
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
          const containerRect = this.stage.container().getBoundingClientRect();
          const clickX = e.evt.clientX - containerRect.left;
          const clickY = e.evt.clientY - containerRect.top;
          this.nodeSelected.emit(node.id);
          this.nodeClicked.emit({ nodeId: node.id, x: clickX, y: clickY });
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

        group.on('mouseenter', () => {
          this.setCursor('grab');
          this.showAdHocTooltip(group);
        });
        group.on('mouseleave', () => {
          this.setCursor('default');
          this.hideAdHocTooltip();
        });
      } else {
        group.on('click tap', (e) => {
          const containerRect = this.stage.container().getBoundingClientRect();
          const clickX = e.evt.clientX - containerRect.left;
          const clickY = e.evt.clientY - containerRect.top;
          this.nodeSelected.emit(node.id);
          this.nodeClicked.emit({ nodeId: node.id, x: clickX, y: clickY });
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

  private renderReadonlyNodes(): void {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.pinyaLayer.destroyChildren();

    const assignments = this.assignments();
    const assignmentByNodeId = new Map(assignments.map((a) => [a.node.id, a]));

    for (const node of this.nodes()) {
      const assignment = assignmentByNodeId.get(node.id);
      const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;

      const group = new Konva.Group({
        id: node.id,
        x: node.x,
        y: node.y,
        rotation: node.rotation,
        draggable: false,
      });

      let shape: Konva.Shape;
      if ((node as { shape?: string }).shape === NodeShape.ELLIPSE) {
        shape = new Konva.Ellipse({
          radiusX: node.width / 2,
          radiusY: node.height / 2,
          fill,
          stroke: NORMAL_STROKE,
          strokeWidth: 1.5,
        });
      } else {
        shape = new Konva.Rect({
          x: -node.width / 2,
          y: -node.height / 2,
          width: node.width,
          height: node.height,
          cornerRadius: 4,
          fill,
          stroke: NORMAL_STROKE,
          strokeWidth: 1.5,
        });
      }
      group.add(shape);

      const textFill = this.getContrastColor(fill);
      const displayText = assignment ? assignment.person.alias : node.label;
      const { fontSize, wrap } = this.fitFontSizeForNode(displayText, node.width, node.height, {
        maxFontSize: assignment ? 13 : 9,
        fontStyle: assignment ? 'bold' : 'normal',
        wrap: assignment ? 'none' : 'word',
      });

      group.add(
        new Konva.Text({
          text: displayText,
          fontSize,
          fontStyle: assignment ? 'bold' : 'normal',
          fontFamily: 'Inter, sans-serif',
          fill: textFill,
          opacity: assignment ? 1 : 0.5,
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

      this.pinyaLayer.add(group);
    }

    this.pinyaLayer.add(this.transformer);
    this.pinyaLayer.batchDraw();
  }

  private buildNodeGroup(
    node: FigureNodeItem,
    isEditor: boolean,
    isSelected: boolean,
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

    // Shape
    let shape: Konva.Shape;
    if (node.shape === NodeShape.ELLIPSE) {
      shape = new Konva.Ellipse({
        radiusX: node.width / 2,
        radiusY: node.height / 2,
        fill,
        stroke,
        strokeWidth,
      });
    } else {
      shape = new Konva.Rect({
        x: -node.width / 2,
        y: -node.height / 2,
        width: node.width,
        height: node.height,
        cornerRadius: 4,
        fill,
        stroke,
        strokeWidth,
      });
    }
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
          this.nodeResized.emit({ id: node.id, width: newWidth, height: newHeight });
        }

        // Capture rotation set by the Transformer's rotate handle
        const rawRotation = Math.round(group.rotation());
        const rotation = ((rawRotation % 360) + 360) % 360;
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
        if (isGhostEligible(node)) {
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
    this.ghostHoverTimer = setTimeout(() => this.showGhostForNode(node), 1000);
  }

  private showGhostForNode(node: CanvasNode): void {
    this.hideGhost();

    const pos = calculateGhostPosition(node);
    const strokeColor = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;

    const ghost = new Konva.Group({
      x: pos.x,
      y: pos.y,
      rotation: node.rotation,
      listening: true,
    });

    let shape: Konva.Shape;
    if (node.shape === NodeShape.ELLIPSE) {
      shape = new Konva.Ellipse({
        radiusX: node.width / 2,
        radiusY: node.height / 2,
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth: 2,
        dash: [6, 4],
        opacity: 0.75,
      });
    } else {
      shape = new Konva.Rect({
        x: -node.width / 2,
        y: -node.height / 2,
        width: node.width,
        height: node.height,
        cornerRadius: 4,
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth: 2,
        dash: [6, 4],
        opacity: 0.75,
      });
    }
    ghost.add(shape);

    ghost.add(
      new Konva.Text({
        text: '+',
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        fill: strokeColor,
        opacity: 0.7,
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

    const input = document.createElement('input');
    input.type = 'text';
    input.value = node.label ?? '';
    input.className = 'label-editor';
    input.setAttribute('aria-label', "Edita l'etiqueta del node");

    Object.assign(input.style, {
      position: 'absolute',
      left: `${canvasX - inputWidth / 2}px`,
      top: `${canvasY - inputHeight / 2}px`,
      width: `${inputWidth}px`,
      height: `${inputHeight}px`,
      fontSize: `${Math.max(9, 10 * stageScale)}px`,
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
      if (e.key === 'Enter') {
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
    if (wrap === 'word') {
      probe.width(maxW);
    } else {
      probe.width(0);
    }

    for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.5) {
      probe.fontSize(fontSize);
      const size = probe.measureSize(text);
      const fitsWidth = wrap === 'word' || size.width <= maxW;
      if (fitsWidth && size.height <= maxH) {
        return { fontSize, wrap };
      }
    }

    return { fontSize: minFont, wrap };
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
    const label = new Konva.Label({
      x: group.x(),
      y: group.y() - 28,
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
}
