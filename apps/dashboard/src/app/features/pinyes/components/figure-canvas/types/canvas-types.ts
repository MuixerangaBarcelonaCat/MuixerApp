import { FigureNodeItem } from '../../../models/figure-template.model';
import { AssignmentDetail, HeightMode } from '../../../models/assignment.model';

/** Minimal node shape accepted by the canvas — both FigureNodeItem and InstanceNodeItem satisfy this. */
export interface CanvasNode {
  id: string;
  label: string;
  zone: string;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  sortOrder: number;
  ringLevel?: number | null;
  originNodeId?: string | null;
  renglaId?: string | null;
  renglaPosition?: number | null;
}

export type CanvasMode = 'editor' | 'readonly' | 'composition' | 'assignment';

export interface CompositionSlotWithNodes {
  slotId: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: {
    id: string;
    name: string;
    hasPinya: boolean;
    nodes: FigureNodeItem[];
  };
}

export interface AssignmentRenderContext {
  nodes: CanvasNode[];
  assignments: AssignmentDetail[];
  heightMode: HeightMode;
  attendanceMap: Map<string, string>;
  nextPerformanceMap: Map<string, string | null>;
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
}
