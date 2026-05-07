import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  input,
  output,
  signal,
} from '@angular/core';
import Konva from 'konva';
import { FigureNodeItem } from '../../models/figure-template.model';
import { FigureZone, NodeShape } from '@muixer/shared';

export type CanvasMode = 'editor' | 'readonly';

const GRID_COLOR = '#e5e7eb';
const NODE_COLORS: Record<string, string> = {
  [FigureZone.PINYA]: '#3b82f6',
  [FigureZone.TRONC]: '#8b5cf6',
  [FigureZone.FIGURE_DIRECTION]: '#f59e0b',
  [FigureZone.XICALLA_DIRECTION]: '#ec4899',
};
const DEFAULT_NODE_COLOR = '#6b7280';
const SELECTED_STROKE = '#f59e0b';
const NORMAL_STROKE = '#1e1b4b';

@Component({
  selector: 'app-figure-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './figure-canvas.component.html',
  styleUrl: './figure-canvas.component.scss',
})
export class FigureCanvasComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly nodes = input<FigureNodeItem[]>([]);
  readonly mode = input<CanvasMode>('editor');
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(40);
  readonly troncVisible = input<boolean>(true);
  readonly selectedNodeId = input<string | null>(null);

  readonly nodeSelected = output<string | null>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();

  private stage!: Konva.Stage;
  private gridLayer!: Konva.Layer;
  private pinyaLayer!: Konva.Layer;
  private troncLayer!: Konva.Layer;

  private resizeObserver: ResizeObserver | null = null;

  readonly zoomLevel = signal(1);

  ngAfterViewInit(): void {
    this.initStage();
    this.renderAll();

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeStage();
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.stage) return;

    if (changes['gridEnabled'] || changes['gridSpacing']) {
      this.renderGrid();
    }
    if (changes['nodes'] || changes['selectedNodeId'] || changes['troncVisible']) {
      this.renderNodes();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.stage?.destroy();
  }

  fitToScreen(): void {
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.zoomLevel.set(1);
    this.stage.batchDraw();
  }

  private initStage(): void {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.stage = new Konva.Stage({ container, width, height });

    this.gridLayer = new Konva.Layer({ listening: false });
    this.pinyaLayer = new Konva.Layer();
    this.troncLayer = new Konva.Layer();

    this.stage.add(this.gridLayer, this.pinyaLayer, this.troncLayer);

    this.setupStageInteraction();
  }

  private setupStageInteraction(): void {
    // Zoom with wheel
    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = this.stage.scaleX();
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const clampedScale = Math.max(0.2, Math.min(6, newScale));

      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };

      this.stage.scale({ x: clampedScale, y: clampedScale });
      this.stage.position({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });

      this.zoomLevel.set(Math.round(clampedScale * 100) / 100);
      this.stage.batchDraw();
    });

    // Pan with middle mouse button or space+drag
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let stageStart = { x: 0, y: 0 };

    this.stage.on('mousedown', (e) => {
      if (e.evt.button === 1) {
        isPanning = true;
        const pos = this.stage.getPointerPosition()!;
        panStart = { x: pos.x, y: pos.y };
        stageStart = { x: this.stage.x(), y: this.stage.y() };
        this.stage.container().style.cursor = 'grabbing';
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
    });

    this.stage.on('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        this.stage.container().style.cursor = 'default';
      }
    });

    // Deselect on stage click
    this.stage.on('click', (e) => {
      if (e.target === this.stage) {
        this.nodeSelected.emit(null);
      }
    });
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
    this.renderNodes();
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
    this.pinyaLayer.destroyChildren();
    this.troncLayer.destroyChildren();

    const allNodes = this.nodes();
    const isEditor = this.mode() === 'editor';
    const selectedId = this.selectedNodeId();

    for (const node of allNodes) {
      const isPinyaZone = node.zone === FigureZone.PINYA;
      const isTroncZone = node.zone === FigureZone.TRONC;
      const isBaix = isTroncZone && node.z === 0;

      // Baixos (z=0 TRONC) appear in both layers
      const targets: Konva.Layer[] = [];
      if (isPinyaZone || isBaix) targets.push(this.pinyaLayer);
      if (isTroncZone && this.troncVisible()) targets.push(this.troncLayer);

      for (const layer of targets) {
        const group = this.buildNodeGroup(node, isEditor, selectedId === node.id);
        layer.add(group);
      }
    }

    // Tronc layer separator line
    if (this.troncVisible()) {
      const separatorX = this.stage.width() * 0.65;
      this.troncLayer.add(
        new Konva.Line({
          points: [separatorX, 0, separatorX, this.stage.height()],
          stroke: '#d1d5db',
          strokeWidth: 1,
          dash: [6, 4],
          listening: false,
        }),
      );
    }

    this.pinyaLayer.batchDraw();
    this.troncLayer.batchDraw();
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
      width: node.width,
      x: -node.width / 2,
      y: -6,
      listening: false,
      wrap: 'none',
      ellipsis: true,
    });
    group.add(text);

    // Events
    group.on('click tap', () => {
      this.nodeSelected.emit(node.id);
    });

    if (isEditor) {
      group.on('dragend', () => {
        this.nodeMoved.emit({
          id: node.id,
          x: Math.round(group.x()),
          y: Math.round(group.y()),
        });
      });

      group.on('dblclick dbltap', () => {
        // Rotate 15 degrees on double-click
        const newRotation = (node.rotation + 15) % 360;
        this.nodeRotated.emit({ id: node.id, rotation: newRotation });
      });

      // Cursor
      group.on('mouseenter', () => {
        this.stage.container().style.cursor = 'grab';
      });
      group.on('mouseleave', () => {
        this.stage.container().style.cursor = 'default';
      });
      group.on('dragstart', () => {
        this.stage.container().style.cursor = 'grabbing';
      });
    }

    return group;
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
}
