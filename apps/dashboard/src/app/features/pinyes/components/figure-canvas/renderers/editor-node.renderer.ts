import Konva from 'konva';
import { FigureNodeItem } from '../../../models/figure-template.model';
import { FigureZone } from '@muixer/shared';
import { calculateGhostPosition, isGhostEligible } from '../../../utils/ghost-clone.util';
import { KonvaStageService } from '../services/konva-stage.service';
import { CanvasEmitters } from './canvas-emitters.interface';
import { CanvasNode } from '../types/canvas-types';
import {
  buildNodeShape,
  getContrastColor,
  NODE_COLORS,
  DEFAULT_NODE_COLOR,
  SELECTED_STROKE,
  NORMAL_STROKE,
} from '../utils/node-shape.factory';

export class EditorNodeRenderer {
  private activeGhostGroup: Konva.Group | null = null;
  private ghostHoverTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostSourceNodeId: string | null = null;

  constructor(
    private readonly stageService: KonvaStageService,
    private readonly emitters: CanvasEmitters,
    private readonly getContainerParent: () => HTMLElement,
  ) {}

  renderNodes(
    nodes: FigureNodeItem[],
    isEditor: boolean,
    selectedNodeId: string | null,
    snapToGrid: boolean,
    gridSpacing: number,
  ): void {
    this.clearAllGhostTimers();
    const { pinyaLayer, transformer } = this.stageService;
    transformer.nodes([]);
    transformer.remove();
    pinyaLayer.destroyChildren();

    for (const node of nodes) {
      const group = this.buildNodeGroup(node, isEditor, selectedNodeId === node.id, snapToGrid, gridSpacing);
      pinyaLayer.add(group);
    }

    pinyaLayer.add(transformer);
    pinyaLayer.batchDraw();
  }

  buildNodeGroup(
    node: FigureNodeItem,
    isEditor: boolean,
    isSelected: boolean,
    snapToGrid: boolean,
    gridSpacing: number,
  ): Konva.Group {
    const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
    const stroke = isSelected ? SELECTED_STROKE : NORMAL_STROKE;
    const strokeWidth = isSelected ? 3 : 1.5;

    const group = new Konva.Group({
      id: node.id, x: node.x, y: node.y,
      rotation: node.rotation, draggable: isEditor,
    });

    group.add(buildNodeShape(node, fill, stroke, strokeWidth));

    const textFill = getContrastColor(fill);
    group.add(new Konva.Text({
      text: node.label, fontSize: 10, fontFamily: 'Inter, sans-serif',
      fill: textFill, align: 'center', verticalAlign: 'middle',
      width: node.width, height: node.height - 8,
      x: -node.width / 2, y: -node.height / 2 + 4,
      listening: false, wrap: 'word', ellipsis: false,
    }));

    if (isEditor && node.zone === FigureZone.PINYA && node.ringLevel != null) {
      this.addRingLevelBadge(group, node);
    }

    this.addNodeEvents(group, node, isEditor, snapToGrid, gridSpacing);
    return group;
  }

  clearAllGhostTimers(): void {
    this.clearGhostHoverTimer();
    this.clearGhostLeaveTimer();
    if (this.activeGhostGroup) {
      this.activeGhostGroup.destroy();
      this.activeGhostGroup = null;
      this.ghostSourceNodeId = null;
    }
  }

  private addRingLevelBadge(group: Konva.Group, node: FigureNodeItem): void {
    const badgeText = `C${node.ringLevel}`;
    const badgeFontSize = 8;
    const badgePadX = 3;
    const badgePadY = 1.5;
    const badgeW = badgeFontSize * badgeText.length * 0.6 + badgePadX * 2;
    const badgeH = badgeFontSize + badgePadY * 2;
    const badgeX = node.width / 2 - badgeW - 1;
    const badgeY = -node.height / 2 + 1;

    group.add(new Konva.Rect({
      x: badgeX, y: badgeY, width: badgeW, height: badgeH,
      fill: 'rgba(0,0,0,0.55)', cornerRadius: 2, listening: false,
    }));
    group.add(new Konva.Text({
      text: badgeText, fontSize: badgeFontSize,
      fontFamily: 'Inter, monospace', fill: '#ffffff', fontStyle: 'bold',
      x: badgeX + badgePadX, y: badgeY + badgePadY, listening: false,
    }));
  }

  private addNodeEvents(
    group: Konva.Group,
    node: FigureNodeItem,
    isEditor: boolean,
    snapToGrid: boolean,
    gridSpacing: number,
  ): void {
    const { stage, pinyaLayer, transformer } = this.stageService;

    group.on('click tap', () => {
      this.emitters.nodeSelected(node.id);
      if (isEditor) {
        transformer.nodes([group]);
        transformer.moveToTop();
        pinyaLayer.batchDraw();
      }
    });

    if (!isEditor) return;

    group.on('dragmove', () => {
      if (snapToGrid) {
        group.x(Math.round(group.x() / gridSpacing) * gridSpacing);
        group.y(Math.round(group.y() / gridSpacing) * gridSpacing);
      }
    });

    group.on('dragend', () => {
      this.emitters.nodeMoved({ id: node.id, x: Math.round(group.x()), y: Math.round(group.y()) });
    });

    group.on('transformend', () => {
      const scaleX = group.scaleX();
      const scaleY = group.scaleY();
      group.scaleX(1);
      group.scaleY(1);

      const newWidth = Math.max(20, Math.round(node.width * scaleX));
      const newHeight = Math.max(20, Math.round(node.height * scaleY));
      if (newWidth !== node.width || newHeight !== node.height) {
        this.emitters.nodeResized({ id: node.id, width: newWidth, height: newHeight });
      }

      const rawRotation = Math.round(group.rotation());
      const rotation = ((rawRotation % 360) + 360) % 360;
      if (rotation !== node.rotation) {
        this.emitters.nodeRotated({ id: node.id, rotation });
      }
    });

    group.on('dblclick dbltap', () => this.showLabelEditor(node));

    group.on('mouseenter', () => {
      stage.container().style.cursor = 'grab';
      if (isGhostEligible(node)) this.startGhostTimer(node);
    });
    group.on('mouseleave', () => {
      stage.container().style.cursor = 'default';
      this.scheduleGhostHide();
    });
    group.on('dragstart', () => {
      stage.container().style.cursor = 'grabbing';
      this.hideGhost();
    });
  }

  private startGhostTimer(node: CanvasNode): void {
    this.clearGhostLeaveTimer();
    if (this.ghostSourceNodeId === node.id) return;
    this.hideGhost();
    this.ghostHoverTimer = setTimeout(() => this.showGhostForNode(node), 1000);
  }

  private showGhostForNode(node: CanvasNode): void {
    this.hideGhost();
    const { stage, pinyaLayer, transformer } = this.stageService;
    const pos = calculateGhostPosition(node);
    const strokeColor = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;

    const ghost = new Konva.Group({ x: pos.x, y: pos.y, rotation: node.rotation, listening: true });
    const shape = buildNodeShape(node, 'transparent', strokeColor, 2);
    shape.setAttrs({ dash: [6, 4], opacity: 0.75 });
    ghost.add(shape);
    ghost.add(new Konva.Text({
      text: '+', fontSize: 18, fontFamily: 'Inter, sans-serif',
      fill: strokeColor, opacity: 0.7,
      align: 'center', verticalAlign: 'middle',
      width: node.width, height: node.height,
      x: -node.width / 2, y: -node.height / 2, listening: false,
    }));

    ghost.on('mouseenter', () => { this.clearGhostLeaveTimer(); stage.container().style.cursor = 'copy'; });
    ghost.on('mouseleave', () => { stage.container().style.cursor = 'default'; this.scheduleGhostHide(); });
    ghost.on('click tap', () => {
      this.emitters.ghostCloneRequested({ sourceNode: node, targetPosition: pos });
      this.hideGhost();
    });

    pinyaLayer.add(ghost);
    ghost.moveToTop();
    transformer.moveToTop();
    pinyaLayer.batchDraw();

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
      this.stageService.pinyaLayer.batchDraw();
    }
  }

  private clearGhostHoverTimer(): void {
    if (this.ghostHoverTimer) { clearTimeout(this.ghostHoverTimer); this.ghostHoverTimer = null; }
  }

  private clearGhostLeaveTimer(): void {
    if (this.ghostLeaveTimer) { clearTimeout(this.ghostLeaveTimer); this.ghostLeaveTimer = null; }
  }

  private showLabelEditor(node: FigureNodeItem): void {
    const { stage } = this.stageService;
    const stageScale = stage.scaleX();
    const stagePos = stage.position();
    const canvasX = node.x * stageScale + stagePos.x;
    const canvasY = node.y * stageScale + stagePos.y;
    const inputWidth = Math.max(60, node.width * stageScale);
    const inputHeight = Math.max(20, node.height * stageScale);

    const wrapper = this.getContainerParent();
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
        this.emitters.nodeLabelChanged({ id: node.id, label: newLabel });
      }
    };
    const cancel = () => {
      if (committed) return;
      committed = true;
      wrapper.removeChild(input);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { cancel(); }
    });
    input.addEventListener('blur', commit);
    wrapper.appendChild(input);
    input.focus();
    input.select();
  }
}
