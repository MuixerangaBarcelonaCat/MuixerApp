import Konva from 'konva';
import { FigureZone, NodeShape } from '@muixer/shared';
import { KonvaStageService } from '../services/konva-stage.service';
import { CanvasEmitters } from './canvas-emitters.interface';
import { CompositionSlotWithNodes } from '../types/canvas-types';
import {
  getContrastColor,
  NODE_COLORS,
  DEFAULT_NODE_COLOR,
  SELECTED_STROKE,
  NORMAL_STROKE,
  COMPOSITION_SLOT_SCALE,
} from '../utils/node-shape.factory';

export class CompositionSlotRenderer {
  constructor(
    private readonly stageService: KonvaStageService,
    private readonly emitters: CanvasEmitters,
  ) {}

  renderCompositionSlots(
    slots: CompositionSlotWithNodes[],
    selectedSlotId: string | null,
    snapToGrid: boolean,
    gridSpacing: number,
  ): void {
    const { pinyaLayer, transformer } = this.stageService;
    transformer.nodes([]);
    transformer.remove();
    pinyaLayer.destroyChildren();

    const sortedSlots = [...slots].sort((a, b) => a.sortOrder - b.sortOrder);

    for (const slot of sortedSlots) {
      const pinyaNodes = slot.figureTemplate.nodes.filter(
        (n) => n.zone === FigureZone.PINYA || n.zone === FigureZone.BASE,
      );
      const isSelected = slot.slotId === selectedSlotId;
      const slotGroup = this.buildSlotGroup(slot, pinyaNodes, isSelected, snapToGrid, gridSpacing);
      pinyaLayer.add(slotGroup);
    }

    pinyaLayer.add(transformer);
    pinyaLayer.batchDraw();
  }

  private buildSlotGroup(
    slot: CompositionSlotWithNodes,
    pinyaNodes: CompositionSlotWithNodes['figureTemplate']['nodes'],
    isSelected: boolean,
    snapToGrid: boolean,
    gridSpacing: number,
  ): Konva.Group {
    const { stage } = this.stageService;

    const slotGroup = new Konva.Group({
      id: slot.slotId,
      x: slot.offsetX,
      y: slot.offsetY,
      draggable: true,
      scaleX: COMPOSITION_SLOT_SCALE,
      scaleY: COMPOSITION_SLOT_SCALE,
    });

    if (pinyaNodes.length === 0) {
      this.addPlaceholder(slotGroup, slot, isSelected);
    } else {
      this.addSlotContent(slotGroup, slot, pinyaNodes, isSelected);
    }

    slotGroup.on('click tap', () => this.emitters.slotSelected(slot.slotId));

    slotGroup.on('dragmove', () => {
      if (snapToGrid) {
        slotGroup.x(Math.round(slotGroup.x() / gridSpacing) * gridSpacing);
        slotGroup.y(Math.round(slotGroup.y() / gridSpacing) * gridSpacing);
      }
    });

    slotGroup.on('dragend', () => {
      this.emitters.slotMoved({
        slotId: slot.slotId,
        offsetX: Math.round(slotGroup.x()),
        offsetY: Math.round(slotGroup.y()),
      });
    });

    slotGroup.on('mouseenter', () => { stage.container().style.cursor = 'grab'; });
    slotGroup.on('mouseleave', () => { stage.container().style.cursor = 'default'; });
    slotGroup.on('dragstart', () => { stage.container().style.cursor = 'grabbing'; });

    return slotGroup;
  }

  private addPlaceholder(group: Konva.Group, slot: CompositionSlotWithNodes, isSelected: boolean): void {
    const phW = 120;
    const phH = 80;
    group.add(new Konva.Rect({
      x: -phW / 2, y: -phH / 2, width: phW, height: phH,
      stroke: isSelected ? SELECTED_STROKE : '#94a3b8',
      strokeWidth: isSelected ? 2 : 1, dash: [6, 3],
      fill: isSelected ? 'rgba(245,158,11,0.05)' : 'rgba(148,163,184,0.05)',
      cornerRadius: 6, listening: true,
    }));
    group.add(new Konva.Text({
      x: -phW / 2, y: -20, width: phW,
      text: slot.figureTemplate.name, fontSize: 11,
      fontFamily: 'Inter, sans-serif',
      fill: isSelected ? SELECTED_STROKE : '#64748b',
      align: 'center', listening: false,
    }));
    group.add(new Konva.Text({
      x: -phW / 2, y: -4, width: phW,
      text: 'Carregant...', fontSize: 10,
      fontFamily: 'Inter, sans-serif', fill: '#94a3b8',
      align: 'center', listening: false,
    }));
  }

  private addSlotContent(
    group: Konva.Group,
    slot: CompositionSlotWithNodes,
    pinyaNodes: CompositionSlotWithNodes['figureTemplate']['nodes'],
    isSelected: boolean,
  ): void {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of pinyaNodes) {
      minX = Math.min(minX, n.x - n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    }

    const padding = 8;
    const labelHeight = 16;

    group.add(new Konva.Rect({
      x: minX - padding, y: minY - padding - labelHeight,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + labelHeight,
      stroke: isSelected ? SELECTED_STROKE : '#94a3b8',
      strokeWidth: isSelected ? 2 : 1, dash: [6, 3],
      fill: isSelected ? 'rgba(245,158,11,0.05)' : 'transparent',
      cornerRadius: 6, listening: true,
    }));

    const labelText = slot.label ?? slot.figureTemplate.name;
    group.add(new Konva.Text({
      x: minX - padding, y: minY - padding - labelHeight,
      width: maxX - minX + padding * 2,
      text: labelText, fontSize: 11,
      fontFamily: 'Inter, sans-serif',
      fill: isSelected ? SELECTED_STROKE : '#64748b',
      align: 'center', verticalAlign: 'middle',
      height: labelHeight, listening: false, ellipsis: true,
    }));

    for (const node of pinyaNodes) {
      const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
      const nodeGroup = new Konva.Group({ x: node.x, y: node.y, rotation: node.rotation, draggable: false, listening: false });

      let shape: Konva.Shape;
      if (node.shape === NodeShape.ELLIPSE) {
        shape = new Konva.Ellipse({ radiusX: node.width / 2, radiusY: node.height / 2, fill, stroke: NORMAL_STROKE, strokeWidth: 1.5 });
      } else {
        shape = new Konva.Rect({ x: -node.width / 2, y: -node.height / 2, width: node.width, height: node.height, cornerRadius: 4, fill, stroke: NORMAL_STROKE, strokeWidth: 1.5 });
      }
      nodeGroup.add(shape);

      const textFill = getContrastColor(fill);
      nodeGroup.add(new Konva.Text({
        text: node.label, fontSize: 10, fontFamily: 'Inter, sans-serif',
        fill: textFill, align: 'center', verticalAlign: 'middle',
        width: node.width, height: node.height - 8,
        x: -node.width / 2, y: -node.height / 2 + 4,
        listening: false, wrap: 'word',
      }));

      group.add(nodeGroup);
    }
  }
}
