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
