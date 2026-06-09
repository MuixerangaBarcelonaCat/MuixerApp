import Konva from 'konva';
import { NodeShape } from '@muixer/shared';
import { KonvaStageService } from '../services/konva-stage.service';
import { CanvasNode } from '../types/canvas-types';
import { AssignmentDetail } from '../../../models/assignment.model';
import {
  NODE_COLORS,
  DEFAULT_NODE_COLOR,
  NORMAL_STROKE,
  getContrastColor,
} from '../utils/node-shape.factory';

export class ReadonlyNodeRenderer {
  /** Reused for measuring label text; not attached to the stage. */
  private labelMeasureProbe: Konva.Text | null = null;

  constructor(private readonly stageService: KonvaStageService) {}

  renderReadonlyNodes(nodes: CanvasNode[], assignments: AssignmentDetail[]): void {
    const { pinyaLayer, transformer } = this.stageService;
    transformer.nodes([]);
    transformer.remove();
    pinyaLayer.destroyChildren();

    const assignmentByNodeId = new Map(assignments.map((a) => [a.node.id, a]));

    for (const node of nodes) {
      const assignment = assignmentByNodeId.get(node.id);
      const fill = node.color ?? NODE_COLORS[node.zone] ?? DEFAULT_NODE_COLOR;

      const group = new Konva.Group({ id: node.id, x: node.x, y: node.y, rotation: node.rotation, draggable: false });

      let shape: Konva.Shape;
      if ((node as { shape?: string }).shape === NodeShape.ELLIPSE) {
        shape = new Konva.Ellipse({ radiusX: node.width / 2, radiusY: node.height / 2, fill, stroke: NORMAL_STROKE, strokeWidth: 1.5 });
      } else {
        shape = new Konva.Rect({ x: -node.width / 2, y: -node.height / 2, width: node.width, height: node.height, cornerRadius: 4, fill, stroke: NORMAL_STROKE, strokeWidth: 1.5 });
      }
      group.add(shape);

      const textFill = getContrastColor(fill);
      const displayText = assignment ? assignment.person.alias : node.label;
      const { fontSize, wrap } = this.fitFontSizeForNode(displayText, node.width, node.height, {
        maxFontSize: assignment ? 13 : 9,
        fontStyle: assignment ? 'bold' : 'normal',
        wrap: assignment ? 'none' : 'word',
      });

      group.add(new Konva.Text({
        text: displayText, fontSize,
        fontStyle: assignment ? 'bold' : 'normal',
        fontFamily: 'Inter, sans-serif',
        fill: textFill, opacity: assignment ? 1 : 0.5,
        align: 'center', verticalAlign: 'middle',
        width: node.width, height: node.height,
        x: -node.width / 2, y: -node.height / 2,
        listening: false, wrap, ellipsis: false,
      }));

      pinyaLayer.add(group);
    }

    pinyaLayer.add(transformer);
    pinyaLayer.batchDraw();
  }

  destroy(): void {
    this.labelMeasureProbe?.destroy();
    this.labelMeasureProbe = null;
  }

  private getLabelMeasureProbe(): Konva.Text {
    if (!this.labelMeasureProbe) {
      this.labelMeasureProbe = new Konva.Text({ fontFamily: 'Inter, sans-serif', listening: false });
    }
    return this.labelMeasureProbe;
  }

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
    probe.width(wrap === 'word' ? maxW : 0);

    for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.5) {
      probe.fontSize(fontSize);
      const size = probe.measureSize(text);
      const fitsWidth = wrap === 'word' || size.width <= maxW;
      if (fitsWidth && size.height <= maxH) return { fontSize, wrap };
    }

    return { fontSize: minFont, wrap };
  }
}
