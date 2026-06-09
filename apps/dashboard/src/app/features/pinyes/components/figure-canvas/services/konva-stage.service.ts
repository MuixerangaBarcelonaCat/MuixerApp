import { Injectable, signal } from '@angular/core';
import Konva from 'konva';

const GRID_COLOR = '#e5e7eb';

export interface StageTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Encapsulates Konva Stage creation, layer management, pan/zoom, grid rendering,
 * and resize observation. Provided at component level — one instance per canvas.
 */
@Injectable()
export class KonvaStageService {
  stage!: Konva.Stage;
  gridLayer!: Konva.Layer;
  pinyaLayer!: Konva.Layer;
  transformer!: Konva.Transformer;

  readonly zoomLevel = signal(1);

  private resizeObserver: ResizeObserver | null = null;
  private onTransformChanged: ((t: StageTransform) => void) | null = null;

  init(
    container: HTMLDivElement,
    onTransformChanged: (t: StageTransform) => void,
    onStageClick: (mode: 'composition' | 'other') => void,
    getModeIsComposition: () => boolean,
    getHasSelection: () => boolean,
  ): void {
    this.onTransformChanged = onTransformChanged;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.stage = new Konva.Stage({ container, width, height });
    this.gridLayer = new Konva.Layer({ listening: false });
    this.pinyaLayer = new Konva.Layer();

    this.transformer = new Konva.Transformer({
      keepRatio: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (oldBox, newBox) => {
        if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return oldBox;
        return newBox;
      },
    });
    this.pinyaLayer.add(this.transformer);
    this.stage.add(this.gridLayer, this.pinyaLayer);

    this.setupInteraction(onStageClick, getModeIsComposition, getHasSelection);
  }

  observeResize(container: HTMLDivElement, gridEnabled: () => boolean, gridSpacing: () => number): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.stage.width(container.clientWidth);
      this.stage.height(container.clientHeight);
      this.renderGrid(gridEnabled(), gridSpacing());
      this.stage.batchDraw();
    });
    this.resizeObserver.observe(container);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.stage?.destroy();
  }

  renderGrid(enabled: boolean, spacing: number): void {
    this.gridLayer.destroyChildren();
    if (!enabled) {
      this.gridLayer.batchDraw();
      return;
    }

    const width = this.stage.width();
    const height = this.stage.height();
    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    for (let i = 0; i < cols; i++) {
      this.gridLayer.add(new Konva.Line({
        points: [i * spacing, 0, i * spacing, rows * spacing],
        stroke: GRID_COLOR, strokeWidth: 1, listening: false,
      }));
    }
    for (let j = 0; j < rows; j++) {
      this.gridLayer.add(new Konva.Line({
        points: [0, j * spacing, cols * spacing, j * spacing],
        stroke: GRID_COLOR, strokeWidth: 1, listening: false,
      }));
    }
    this.gridLayer.batchDraw();
  }

  fitToScreen(): void {
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.zoomLevel.set(1);
    this.stage.batchDraw();
    this.emitTransform();
  }

  fitAllSlots(): void {
    const groups = this.pinyaLayer.getChildren().filter(
      (node) => node.className === 'Group',
    ) as Konva.Group[];

    if (groups.length === 0) {
      this.fitToScreen();
      return;
    }

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
    const newX = (this.stage.width() - bbW * newScale) / 2 - minX * newScale;
    const newY = (this.stage.height() - bbH * newScale) / 2 - minY * newScale;

    this.stage.scale({ x: newScale, y: newScale });
    this.stage.position({ x: newX, y: newY });
    this.zoomLevel.set(newScale);
    this.stage.batchDraw();
    this.emitTransform();
  }

  setZoom(level: number): void {
    const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
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
    this.emitTransform();
  }

  updateTransformer(nodeId: string | null, isEditor: boolean): void {
    if (!nodeId || !isEditor) {
      this.transformer.nodes([]);
      return;
    }
    const node = this.pinyaLayer.findOne(`#${nodeId}`);
    if (node) {
      this.transformer.nodes([node]);
      this.transformer.moveToTop();
      this.pinyaLayer.batchDraw();
    } else {
      this.transformer.nodes([]);
    }
  }

  emitTransform(): void {
    if (!this.stage || !this.onTransformChanged) return;
    this.onTransformChanged({
      x: this.stage.x(),
      y: this.stage.y(),
      scaleX: this.stage.scaleX(),
      scaleY: this.stage.scaleY(),
    });
  }

  private setupInteraction(
    onStageClick: (mode: 'composition' | 'other') => void,
    getModeIsComposition: () => boolean,
    getHasSelection: () => boolean,
  ): void {
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let stageStart = { x: 0, y: 0 };

    this.stage.on('mousedown', (e) => {
      const isMiddleButton = e.evt.button === 1;
      const isLeftButton = e.evt.button === 0;
      const clickedOnStage = e.target === this.stage;

      if (isMiddleButton || (isLeftButton && clickedOnStage && !getHasSelection())) {
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
      this.emitTransform();
    });

    this.stage.on('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        this.stage.container().style.cursor = 'default';
        this.emitTransform();
      }
    });

    this.stage.on('mousemove', (e) => {
      if (isPanning) return;
      const clickedOnStage = e.target === this.stage;
      if (clickedOnStage && !getHasSelection()) {
        this.stage.container().style.cursor = 'grab';
      }
    });

    this.stage.on('mouseleave', () => {
      if (!isPanning) this.stage.container().style.cursor = 'default';
    });

    this.stage.on('click', (e) => {
      if (e.target === this.stage) {
        onStageClick(getModeIsComposition() ? 'composition' : 'other');
      }
    });
  }
}
