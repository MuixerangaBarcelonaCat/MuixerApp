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
  imports: [FormsModule],
  templateUrl: './figure-canvas.component.html',
  styleUrl: './figure-canvas.component.scss',
})
export class FigureCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly nodes = input<FigureNodeItem[]>([]);
  readonly mode = input<CanvasMode>('editor');
  readonly gridEnabled = input<boolean>(true);
  readonly gridSpacing = input<number>(40);
  readonly selectedNodeId = input<string | null>(null);
  readonly snapToGrid = input<boolean>(false);

  readonly nodeSelected = output<string | null>();
  readonly nodeMoved = output<{ id: string; x: number; y: number }>();
  readonly nodeRotated = output<{ id: string; rotation: number }>();
  readonly nodeResized = output<{ id: string; width: number; height: number }>();
  readonly nodeLabelChanged = output<{ id: string; label: string }>();
  readonly zoomChanged = output<number>();

  private stage!: Konva.Stage;
  private gridLayer!: Konva.Layer;
  private pinyaLayer!: Konva.Layer;
  private transformer!: Konva.Transformer;

  private resizeObserver: ResizeObserver | null = null;

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
        this.renderNodes();
        this.updateTransformer();
      });
    });
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
    this.resizeObserver?.disconnect();
    this.stage?.destroy();
  }

  fitToScreen(): void {
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.zoomLevel.set(1);
    this.stage.batchDraw();
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
      const noNodeSelected = !this.selectedNodeId();

      // Allow panning with middle button or left button on empty canvas
      if (isMiddleButton || (isLeftButton && clickedOnStage && noNodeSelected)) {
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
    });

    this.stage.on('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        this.stage.container().style.cursor = 'default';
      }
    });

    // Update cursor on hover
    this.stage.on('mousemove', (e) => {
      if (isPanning) return;
      const clickedOnStage = e.target === this.stage;
      const noNodeSelected = !this.selectedNodeId();
      
      if (clickedOnStage && noNodeSelected && this.mode() === 'editor') {
        this.stage.container().style.cursor = 'grab';
      }
    });

    this.stage.on('mouseleave', () => {
      if (!isPanning) {
        this.stage.container().style.cursor = 'default';
      }
    });

    // Deselect on stage click
    this.stage.on('click', (e) => {
      if (e.target === this.stage) {
        this.nodeSelected.emit(null);
        this.transformer.nodes([]);
      }
    });
  }

  private updateTransformer(): void {
    const selectedId = this.selectedNodeId();
    const isEditor = this.mode() === 'editor';

    if (!selectedId || !isEditor) {
      this.transformer.nodes([]);
      return;
    }

    const node = this.pinyaLayer.findOne(`#${selectedId}`);
    if (node) {
      this.transformer.nodes([node]);
      this.transformer.moveToTop();
      this.pinyaLayer.batchDraw();
    } else {
      this.transformer.nodes([]);
    }
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
    // Preserve the transformer: detach before destroying layer children
    this.transformer.nodes([]);
    this.transformer.remove();

    this.pinyaLayer.destroyChildren();

    const isEditor = this.mode() === 'editor';
    const selectedId = this.selectedNodeId();

    for (const node of this.nodes()) {
      const group = this.buildNodeGroup(node, isEditor, selectedId === node.id);
      this.pinyaLayer.add(group);
    }

    // Re-add transformer to pinyaLayer
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
