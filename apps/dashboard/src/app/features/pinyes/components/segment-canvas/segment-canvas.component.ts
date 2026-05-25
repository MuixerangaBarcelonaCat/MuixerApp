import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  effect,
  input,
  output,
  untracked,
} from '@angular/core';
import Konva from 'konva';
import { FigureZone, NodeShape, ReferenceElementType } from '@muixer/shared';
import { ProjectionInstance } from '../../models/projection.model';
import { ReferenceElementItem } from '../../models/reference-element.model';

export interface FigurePosition {
  x: number;
  y: number;
  scale: number;
}

const PINYA_COLORS: Record<string, string> = {
  [FigureZone.BASE]: '#EEEEEE',
  [FigureZone.PINYA]: '#3b82f6',
  [FigureZone.TRONC]: '#8b5cf6',
};
const DEFAULT_NODE_COLOR = '#6b7280';
const TRONC_FLOOR_HEIGHT = 28;
const TRONC_NODE_WIDTH = 56;
const TRONC_PADDING = 4;
const FIGURE_LABEL_HEIGHT = 20;

function getContrastColor(hex: string): string {
  const c = (hex || '#888888').replace('#', '');
  if (c.length < 6) return '#000000';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

@Component({
  selector: 'app-segment-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #canvasContainer class="w-full h-full"></div>`,
})
export class SegmentCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  readonly instances = input.required<ProjectionInstance[]>();
  readonly referenceElements = input.required<ReferenceElementItem[]>();
  readonly editMode = input.required<boolean>();
  readonly figurePositions = input.required<Map<string, FigurePosition>>();
  readonly selectedElementId = input<string | null>(null);

  readonly figureMoved = output<{ instanceId: string; x: number; y: number }>();
  readonly figureClicked = output<string>();
  readonly elementMoved = output<{
    elementId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>();
  readonly elementSelected = output<string | null>();

  private stage!: Konva.Stage;
  private layer!: Konva.Layer;
  private transformer!: Konva.Transformer;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      this.instances();
      this.referenceElements();
      this.editMode();
      this.figurePositions();
      this.selectedElementId();
      if (!this.stage) return;
      untracked(() => this.renderAll());
    });
  }

  ngAfterViewInit(): void {
    this.initStage();
    this.renderAll();

    this.resizeObserver = new ResizeObserver(() => {
      const container = this.containerRef.nativeElement;
      this.stage.width(container.clientWidth);
      this.stage.height(container.clientHeight);
      this.renderAll();
    });
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.stage?.destroy();
  }

  private initStage(): void {
    const container = this.containerRef.nativeElement;
    this.stage = new Konva.Stage({
      container,
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
    });
    this.layer = new Konva.Layer();
    this.transformer = new Konva.Transformer({
      keepRatio: false,
      rotateEnabled: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    });
    this.layer.add(this.transformer);
    this.stage.add(this.layer);

    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) {
        this.transformer.nodes([]);
        this.elementSelected.emit(null);
        this.layer.batchDraw();
      }
    });
  }

  private renderAll(): void {
    this.transformer.nodes([]);
    this.transformer.remove();
    this.layer.destroyChildren();

    const editMode = this.editMode();
    const bg = editMode ? '#f8f9fa' : '#000000';
    this.stage.container().style.backgroundColor = bg;

    this.renderReferenceElements(editMode);
    this.renderFigures(editMode);

    this.layer.add(this.transformer);
    this.layer.batchDraw();
  }

  private renderReferenceElements(editMode: boolean): void {
    const elements = this.referenceElements();
    const selectedId = this.selectedElementId();

    for (const el of elements) {
      const isSelected = el.id === selectedId;
      const opacity = editMode ? 1 : 0.35;
      const color = el.color ?? '#888888';

      const group = new Konva.Group({
        id: `ref-${el.id}`,
        x: el.x,
        y: el.y,
        rotation: el.rotation,
        draggable: editMode,
        opacity,
      });

      if (el.type === ReferenceElementType.RECTANGLE) {
        group.add(
          new Konva.Rect({
            x: 0,
            y: 0,
            width: el.width,
            height: el.height,
            stroke: isSelected ? '#f59e0b' : color,
            strokeWidth: isSelected ? 3 : 2,
            fill: 'transparent',
            cornerRadius: 4,
          }),
        );
        if (el.label) {
          group.add(
            new Konva.Text({
              x: 4,
              y: 4,
              width: el.width - 8,
              text: el.label,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fill: color,
              listening: false,
              ellipsis: true,
              wrap: 'none',
            }),
          );
        }
      } else if (el.type === ReferenceElementType.ARROW) {
        const len = el.width;
        group.add(
          new Konva.Arrow({
            points: [0, 0, len, 0],
            stroke: isSelected ? '#f59e0b' : color,
            strokeWidth: isSelected ? 4 : 3,
            fill: isSelected ? '#f59e0b' : color,
            pointerLength: 14,
            pointerWidth: 10,
          }),
        );
        if (el.label) {
          group.add(
            new Konva.Text({
              x: len / 2 - 40,
              y: -20,
              width: 80,
              text: el.label,
              fontSize: 12,
              fontFamily: 'Inter, sans-serif',
              fill: color,
              align: 'center',
              listening: false,
            }),
          );
        }
      }

      if (editMode) {
        group.on('click tap', () => {
          this.elementSelected.emit(el.id);
          this.transformer.nodes([group]);
          this.transformer.moveToTop();
          this.layer.batchDraw();
        });

        group.on('dragend', () => {
          const clientRect = group.getClientRect({ relativeTo: this.layer });
          this.elementMoved.emit({
            elementId: el.id,
            x: group.x(),
            y: group.y(),
            width: el.width,
            height: el.height,
            rotation: group.rotation(),
          });
        });

        group.on('transformend', () => {
          this.elementMoved.emit({
            elementId: el.id,
            x: group.x(),
            y: group.y(),
            width: Math.max(20, group.width() * group.scaleX()),
            height: Math.max(20, group.height() * group.scaleY()),
            rotation: group.rotation(),
          });
          group.scaleX(1);
          group.scaleY(1);
        });
      }

      this.layer.add(group);
    }
  }

  private renderFigures(editMode: boolean): void {
    const instances = this.instances();
    const positions = this.figurePositions();
    const stageW = this.stage.width();
    const stageH = this.stage.height();
    const padding = 40;

    instances.forEach((instance, index) => {
      const pos = positions.get(instance.id);
      const x = pos?.x ?? (index * (stageW / Math.max(instances.length, 1)) + padding);
      const y = pos?.y ?? stageH * 0.4;
      const scale = pos?.scale ?? 1;

      const troncAndBase = instance.nodes.filter(
        (n) => n.zone === FigureZone.TRONC || n.zone === FigureZone.BASE,
      );
      const pinyaNodes = instance.nodes.filter(
        (n) => n.zone !== FigureZone.TRONC && n.zone !== FigureZone.BASE,
      );

      const troncWidth = this.estimateTroncWidth(troncAndBase);
      const troncHeight = this.estimateTroncHeight(troncAndBase);

      const figureGroup = new Konva.Group({
        id: `fig-${instance.id}`,
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        draggable: editMode,
      });

      // Tronc mini (top-left of figure group)
      const troncGroup = this.buildTroncMini(instance, troncAndBase);
      troncGroup.x(0);
      troncGroup.y(0);
      figureGroup.add(troncGroup);

      // Pinya (offset to the right of tronc)
      const pinyaOffsetX = troncWidth + TRONC_PADDING * 2;
      const pinyaGroup = this.buildPinyaMini(instance, pinyaNodes, !editMode);
      pinyaGroup.x(pinyaOffsetX);
      pinyaGroup.y(0);
      figureGroup.add(pinyaGroup);

      // Figure name label (bottom-center)
      const totalWidth = pinyaOffsetX + this.estimatePinyaWidth(pinyaNodes);
      const displayName = instance.label ?? instance.figureTemplate?.name ?? 'Figura';
      figureGroup.add(
        new Konva.Text({
          x: 0,
          y: Math.max(troncHeight, this.estimatePinyaHeight(pinyaNodes)) + 4,
          width: totalWidth,
          text: displayName,
          fontSize: 12,
          fontFamily: 'Inter, sans-serif',
          fill: editMode ? '#374151' : '#ffffff',
          align: 'center',
          listening: false,
          fontStyle: 'bold',
        }),
      );

      if (editMode) {
        figureGroup.on('dragend', () => {
          this.figureMoved.emit({
            instanceId: instance.id,
            x: figureGroup.x(),
            y: figureGroup.y(),
          });
        });

        figureGroup.on('mouseenter', () => {
          this.stage.container().style.cursor = 'grab';
        });
        figureGroup.on('mouseleave', () => {
          this.stage.container().style.cursor = 'default';
        });
        figureGroup.on('dragstart', () => {
          this.stage.container().style.cursor = 'grabbing';
        });
      } else {
        figureGroup.on('click tap', () => {
          this.figureClicked.emit(instance.id);
        });
        figureGroup.on('mouseenter', () => {
          this.stage.container().style.cursor = 'pointer';
        });
        figureGroup.on('mouseleave', () => {
          this.stage.container().style.cursor = 'default';
        });
      }

      this.layer.add(figureGroup);
    });
  }

  private buildTroncMini(
    instance: ProjectionInstance,
    troncAndBase: ProjectionInstance['nodes'],
  ): Konva.Group {
    const group = new Konva.Group({ listening: false });

    const byZ = new Map<number, ProjectionInstance['nodes']>();
    for (const node of troncAndBase) {
      if (!byZ.has(node.z)) byZ.set(node.z, []);
      byZ.get(node.z)!.push(node);
    }

    const assignmentByNodeId = new Map(instance.assignments.map((a) => [a.node.id, a]));
    const sortedZLevels = [...byZ.keys()].sort((a, b) => b - a);

    sortedZLevels.forEach((z, floorIndex) => {
      const nodes = (byZ.get(z) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
      const y = floorIndex * TRONC_FLOOR_HEIGHT;

      const floorW = nodes.length * TRONC_NODE_WIDTH + TRONC_PADDING * 2;

      group.add(
        new Konva.Rect({
          x: 0,
          y,
          width: floorW,
          height: TRONC_FLOOR_HEIGHT - 2,
          fill: '#f0f0f0',
          opacity: 0.9,
          cornerRadius: 2,
          listening: false,
        }),
      );

      // Floor label
      group.add(
        new Konva.Text({
          x: TRONC_PADDING,
          y: y + 3,
          text: z === 0 ? 'P1' : `P${z + 1}`,
          fontSize: 8,
          fill: '#888',
          listening: false,
        }),
      );

      nodes.forEach((node, nodeIndex) => {
        const assignment = assignmentByNodeId.get(node.id);
        const nodeX = TRONC_PADDING + nodeIndex * TRONC_NODE_WIDTH;

        group.add(
          new Konva.Rect({
            x: nodeX,
            y: y + 2,
            width: TRONC_NODE_WIDTH - 2,
            height: TRONC_FLOOR_HEIGHT - 6,
            fill: assignment ? '#ddd6fe' : '#e5e7eb',
            cornerRadius: 2,
            listening: false,
          }),
        );

        group.add(
          new Konva.Text({
            x: nodeX + 2,
            y: y + (TRONC_FLOOR_HEIGHT - 14) / 2,
            width: TRONC_NODE_WIDTH - 4,
            height: 14,
            text: assignment ? assignment.person.alias : node.label,
            fontSize: 9,
            fontStyle: assignment ? 'bold' : 'normal',
            fontFamily: 'Inter, sans-serif',
            fill: '#333',
            align: 'center',
            verticalAlign: 'middle',
            ellipsis: true,
            wrap: 'none',
            listening: false,
          }),
        );
      });
    });

    return group;
  }

  private buildPinyaMini(
    instance: ProjectionInstance,
    pinyaNodes: ProjectionInstance['nodes'],
    isProjection: boolean,
  ): Konva.Group {
    const group = new Konva.Group({ listening: false });
    const assignmentByNodeId = new Map(instance.assignments.map((a) => [a.node.id, a]));

    const SCALE = 0.45;

    for (const node of pinyaNodes) {
      const assignment = assignmentByNodeId.get(node.id);
      const fill = node.color ?? PINYA_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;

      const nodeGroup = new Konva.Group({
        x: node.x * SCALE,
        y: node.y * SCALE,
        rotation: node.rotation,
        listening: false,
      });

      let shape: Konva.Shape;
      const w = node.width * SCALE;
      const h = node.height * SCALE;
      const shape2 = (node as { shape?: string }).shape;

      if (shape2 === NodeShape.ELLIPSE) {
        shape = new Konva.Ellipse({
          radiusX: w / 2,
          radiusY: h / 2,
          fill: assignment ? fill : fill + '88',
          stroke: '#1e1b4b',
          strokeWidth: 1,
        });
      } else {
        shape = new Konva.Rect({
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          cornerRadius: 3,
          fill: assignment ? fill : fill + '88',
          stroke: '#1e1b4b',
          strokeWidth: 1,
        });
      }
      nodeGroup.add(shape);

      const displayText = assignment ? assignment.person.alias : node.label;
      const textFill = this.getContrastForFill(fill);
      nodeGroup.add(
        new Konva.Text({
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          text: displayText,
          fontSize: assignment ? Math.max(8, 11 * SCALE) : Math.max(6, 8 * SCALE),
          fontStyle: assignment && isProjection ? 'bold' : 'normal',
          fontFamily: 'Inter, sans-serif',
          fill: assignment ? textFill : '#666',
          align: 'center',
          verticalAlign: 'middle',
          ellipsis: true,
          wrap: 'none',
          listening: false,
        }),
      );

      group.add(nodeGroup);
    }

    return group;
  }

  private estimateTroncWidth(troncAndBase: ProjectionInstance['nodes']): number {
    const byZ = new Map<number, number>();
    for (const n of troncAndBase) byZ.set(n.z, (byZ.get(n.z) ?? 0) + 1);
    const maxPerFloor = Math.max(0, ...[...byZ.values()]);
    return maxPerFloor * TRONC_NODE_WIDTH + TRONC_PADDING * 2;
  }

  private estimateTroncHeight(troncAndBase: ProjectionInstance['nodes']): number {
    const uniqueZ = new Set(troncAndBase.map((n) => n.z));
    return uniqueZ.size * TRONC_FLOOR_HEIGHT;
  }

  private estimatePinyaWidth(pinyaNodes: ProjectionInstance['nodes']): number {
    if (pinyaNodes.length === 0) return 200;
    const SCALE = 0.45;
    return (
      Math.max(...pinyaNodes.map((n) => n.x + n.width / 2)) * SCALE -
      Math.min(...pinyaNodes.map((n) => n.x - n.width / 2)) * SCALE
    );
  }

  private estimatePinyaHeight(pinyaNodes: ProjectionInstance['nodes']): number {
    if (pinyaNodes.length === 0) return 200;
    const SCALE = 0.45;
    return (
      Math.max(...pinyaNodes.map((n) => n.y + n.height / 2)) * SCALE -
      Math.min(...pinyaNodes.map((n) => n.y - n.height / 2)) * SCALE
    );
  }

  private getContrastForFill(hex: string): string {
    return getContrastColor(hex);
  }
}
