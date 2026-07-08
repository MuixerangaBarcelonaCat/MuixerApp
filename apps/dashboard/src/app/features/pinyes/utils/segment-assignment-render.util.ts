import { AssignmentDetail } from '../models/assignment.model';
import {
  CanvasNode,
  CompositionSlotWithNodes,
} from '../components/figure-canvas/figure-canvas.component';

/** Reference to a node within a specific figure instance (slot). Node ids alone
 *  are not unique across slots: pre-snapshot instances of the same template share them. */
export interface SegmentNodeRef {
  slotId: string;
  nodeId: string;
}

export interface SegmentRenderNode {
  /** Unique Konva id across all slots. */
  key: string;
  slotId: string;
  node: CanvasNode;
  assignment: AssignmentDetail | null;
  isSelected: boolean;
  isDimmed: boolean;
  isHighlighted: boolean;
}

/** Flattens slots into per-node render descriptors for the segment-assignment canvas mode. */
export function buildSegmentRenderNodes(
  slots: CompositionSlotWithNodes[],
  assignments: AssignmentDetail[],
  selected: SegmentNodeRef | null,
  dimmedSlotIds: Set<string>,
  highlightedNodeIds: Set<string>,
): SegmentRenderNode[] {
  const assignmentByRef = new Map<string, AssignmentDetail>();
  for (const a of assignments) {
    assignmentByRef.set(`${a.figureInstanceId}:${a.node.id}`, a);
  }

  const sortedSlots = [...slots].sort((a, b) => a.sortOrder - b.sortOrder);

  const result: SegmentRenderNode[] = [];
  for (const slot of sortedSlots) {
    const isDimmed = dimmedSlotIds.has(slot.slotId);
    for (const node of slot.figureTemplate.nodes as unknown as CanvasNode[]) {
      const key = `${slot.slotId}:${node.id}`;
      result.push({
        key,
        slotId: slot.slotId,
        node,
        assignment: assignmentByRef.get(key) ?? null,
        isSelected: selected?.slotId === slot.slotId && selected?.nodeId === node.id,
        isDimmed,
        isHighlighted: highlightedNodeIds.has(node.id),
      });
    }
  }
  return result;
}

/** Center of the bounding box of a set of nodes (each x/y is its own center). */
export function boundingBoxCenter(
  nodes: { x: number; y: number; width: number; height: number }[],
): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * Inverse of the slot's render transform: maps a stage-space point to the slot's
 * local node coordinates. `pivot` must be the same value the render uses as the
 * slot group's offset, so clicks land where nodes are drawn.
 */
export function stageToSlotLocal(
  stagePoint: { x: number; y: number },
  slot: Pick<CompositionSlotWithNodes, 'offsetX' | 'offsetY' | 'angle'>,
  pivot: { x: number; y: number },
): { x: number; y: number } {
  const angleRad = (-(slot.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = stagePoint.x - slot.offsetX;
  const dy = stagePoint.y - slot.offsetY;

  return {
    x: Math.round(pivot.x + dx * cos - dy * sin),
    y: Math.round(pivot.y + dx * sin + dy * cos),
  };
}
