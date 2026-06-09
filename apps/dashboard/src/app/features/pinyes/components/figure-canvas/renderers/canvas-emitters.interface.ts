import { CanvasNode } from '../types/canvas-types';

export interface CanvasEmitters {
  nodeSelected: (id: string | null) => void;
  nodeClicked: (data: { nodeId: string; x: number; y: number }) => void;
  nodeMoved: (data: { id: string; x: number; y: number }) => void;
  nodeRotated: (data: { id: string; rotation: number }) => void;
  nodeResized: (data: { id: string; width: number; height: number }) => void;
  nodeLabelChanged: (data: { id: string; label: string }) => void;
  slotSelected: (id: string | null) => void;
  slotMoved: (data: { slotId: string; offsetX: number; offsetY: number }) => void;
  ghostCloneRequested: (data: { sourceNode: CanvasNode; targetPosition: { x: number; y: number } }) => void;
}
