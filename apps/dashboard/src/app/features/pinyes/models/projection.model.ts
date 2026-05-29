import { AssignmentDetail, InstanceNodeItem } from './assignment.model';
import { ReferenceElementItem } from './reference-element.model';

export interface ProjectionInstance {
  id: string;
  label: string | null;
  sortOrder: number;
  numberOfCordons: number | null;
  openCordons: string[] | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
  figureTemplate: { id: string; name: string } | null;
  nodes: InstanceNodeItem[];
  assignments: AssignmentDetail[];
}

export interface ProjectionSegmentData {
  segment: {
    id: string;
    name: string | null;
    sortOrder: number;
    prevSegmentId: string | null;
    nextSegmentId: string | null;
  };
  instances: ProjectionInstance[];
  referenceElements: ReferenceElementItem[];
}

export interface InstanceLayoutUpdate {
  instanceId: string;
  x: number;
  y: number;
  scale: number;
}
