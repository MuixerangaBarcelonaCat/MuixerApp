import Konva from 'konva';
import { NodeShape } from '@muixer/shared';
import { KonvaStageService } from '../services/konva-stage.service';
import { CanvasEmitters } from './canvas-emitters.interface';
import { CanvasNode, AssignmentRenderContext } from '../types/canvas-types';
import { ATTENDANCE_COLORS } from '../../../utils/attendance-display.util';
import {
  NODE_COLORS,
  DEFAULT_NODE_COLOR,
  SELECTED_STROKE,
  NORMAL_STROKE,
  getContrastColor,
} from '../utils/node-shape.factory';

export class AssignmentNodeRenderer {
  constructor(
    private readonly stageService: KonvaStageService,
    private readonly emitters: CanvasEmitters,
  ) {}

  renderAssignmentNodes(ctx: AssignmentRenderContext): void {
    const { pinyaLayer, transformer } = this.stageService;
    transformer.nodes([]);
    transformer.remove();
    pinyaLayer.destroyChildren();

    const { nodes, assignments, heightMode, attendanceMap, nextPerformanceMap, selectedNodeId, highlightedNodeIds } = ctx;
    const assignmentByNodeId = new Map(assignments.map((a) => [a.node.id, a]));

    for (const node of nodes) {
      const group = this.buildAssignmentGroup(
        node, assignmentByNodeId, heightMode, attendanceMap,
        nextPerformanceMap, selectedNodeId, highlightedNodeIds,
      );
      pinyaLayer.add(group);
    }

    pinyaLayer.add(transformer);
    pinyaLayer.batchDraw();
  }

  private buildAssignmentGroup(
    node: CanvasNode,
    assignmentByNodeId: Map<string, AssignmentRenderContext['assignments'][0]>,
    heightMode: AssignmentRenderContext['heightMode'],
    attendanceMap: Map<string, string>,
    nextPerformanceMap: Map<string, string | null>,
    selectedNodeId: string | null,
    highlightedNodeIds: Set<string>,
  ): Konva.Group {
    const { stage } = this.stageService;
    const assignment = assignmentByNodeId.get(node.id);
    const isSelected = selectedNodeId === node.id;
    const isHighlighted = highlightedNodeIds.has(node.id);
    const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;
    const stroke = isSelected ? SELECTED_STROKE : isHighlighted ? '#10b981' : NORMAL_STROKE;
    const strokeWidth = isSelected ? 3 : isHighlighted ? 2.5 : 1.5;

    const group = new Konva.Group({ id: node.id, x: node.x, y: node.y, rotation: node.rotation, draggable: false });

    let shape: Konva.Shape;
    if ((node as { shape?: string }).shape === NodeShape.ELLIPSE) {
      shape = new Konva.Ellipse({ radiusX: node.width / 2, radiusY: node.height / 2, fill, stroke, strokeWidth });
    } else {
      shape = new Konva.Rect({ x: -node.width / 2, y: -node.height / 2, width: node.width, height: node.height, cornerRadius: 4, fill, stroke, strokeWidth });
    }

    if (isHighlighted) {
      shape.shadowColor('#10b981');
      shape.shadowBlur(12);
      shape.shadowOpacity(0.7);
      shape.shadowEnabled(true);
    }
    group.add(shape);

    if (assignment) {
      this.addAssignmentContent(group, node, assignment, heightMode, attendanceMap, nextPerformanceMap, fill);
    } else {
      group.add(new Konva.Text({
        text: node.label, fontSize: 9, fontFamily: 'Inter, sans-serif',
        fill: getContrastColor(fill), opacity: 0.6,
        align: 'center', verticalAlign: 'middle',
        width: node.width, height: node.height - 8,
        x: -node.width / 2, y: -node.height / 2 + 4,
        listening: false, wrap: 'word',
      }));
    }

    group.on('click tap', (e) => {
      const containerRect = stage.container().getBoundingClientRect();
      const clickX = e.evt.clientX - containerRect.left;
      const clickY = e.evt.clientY - containerRect.top;
      this.emitters.nodeSelected(node.id);
      this.emitters.nodeClicked({ nodeId: node.id, x: clickX, y: clickY });
    });
    group.on('mouseenter', () => { stage.container().style.cursor = 'pointer'; });
    group.on('mouseleave', () => { stage.container().style.cursor = 'default'; });

    return group;
  }

  private addAssignmentContent(
    group: Konva.Group,
    node: CanvasNode,
    assignment: AssignmentRenderContext['assignments'][0],
    heightMode: AssignmentRenderContext['heightMode'],
    attendanceMap: Map<string, string>,
    nextPerformanceMap: Map<string, string | null>,
    fill: string,
  ): void {
    const alias = assignment.person.alias;
    const textFill = getContrastColor(fill);
    const shoulderH = assignment.person.shoulderHeight;
    const hasValidHeight = shoulderH !== null && shoulderH !== 0 && shoulderH !== 140;
    const nextStatus = nextPerformanceMap.get(assignment.person.id);

    group.add(new Konva.Text({
      text: alias, fontSize: 11, fontFamily: 'Inter, sans-serif',
      fill: textFill, align: 'center', verticalAlign: 'middle',
      width: node.width, height: node.height,
      x: -node.width / 2, y: -node.height / 2,
      listening: false, wrap: 'none', ellipsis: true,
    }));

    if (hasValidHeight) {
      const heightText = heightMode === 'relative'
        ? `${shoulderH! >= 140 ? '+' : ''}${shoulderH! - 140}`
        : `${shoulderH}`;
      group.add(new Konva.Text({
        text: heightText, fontSize: 7, fontFamily: 'Inter, sans-serif',
        fill: textFill, opacity: 0.75, align: 'left',
        x: -node.width / 2 + 3, y: -node.height / 2 + 2,
        listening: false,
      }));
    }

    if (nextStatus === 'ANIRE') {
      group.add(new Konva.Text({
        text: '🎭', fontSize: 8,
        x: -node.width / 2 + 2, y: node.height / 2 - 11, listening: false,
      }));
    }

    const attendanceStatus = attendanceMap.get(assignment.person.id);
    if (attendanceStatus) {
      const badgeColor = ATTENDANCE_COLORS[attendanceStatus] ?? '#6b7280';
      group.add(new Konva.Circle({
        x: node.width / 2 - 5, y: -node.height / 2 + 5,
        radius: 5, fill: badgeColor, stroke: '#ffffff', strokeWidth: 1, listening: false,
      }));
    }
  }
}
