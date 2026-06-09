import { AssignmentDetail, InstanceNodeItem } from './assignment.interfaces';

export interface InstanceRef {
  id: string;
  label: string | null;
  sortOrder: number;
  snapshotted: boolean;
  assignedCount: number;
  numberOfCordons: number | null;
  openCordons: string[] | null;
  figureTemplate: { id: string; name: string } | null;
  compositionTemplate: { id: string; name: string } | null;
}

export interface SegmentDetail {
  id: string;
  name: string | null;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isVisible: boolean;
  instances: InstanceRef[];
}

export interface ProjectionInstance {
  id: string;
  label: string | null;
  sortOrder: number;
  numberOfCordons: number | null;
  openCordons: string[] | null;
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
}
