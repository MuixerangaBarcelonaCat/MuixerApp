export interface InstanceRef {
  id: string;
  label: string | null;
  sortOrder: number;
  snapshotted: boolean;
  assignedCount: number;
  numberOfCordons: number | null;
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
  isPublished: boolean;
  instances: InstanceRef[];
}
