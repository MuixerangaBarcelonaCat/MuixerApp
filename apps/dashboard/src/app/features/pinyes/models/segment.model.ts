export interface InstanceDetail {
  id: string;
  label: string | null;
  sortOrder: number;
  snapshotted: boolean;
  assignedCount: number;
  numberOfCordons: number | null;
  openCordons: string[] | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
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
  instances: InstanceDetail[];
}

export interface CreateSegmentPayload {
  name?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export interface UpdateSegmentPayload {
  name?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  isVisible?: boolean;
}

export interface CreateInstancePayload {
  figureTemplateId?: string;
  compositionTemplateId?: string;
  label?: string;
}

export interface UpdateInstancePayload {
  label?: string | null;
  sortOrder?: number;
}
