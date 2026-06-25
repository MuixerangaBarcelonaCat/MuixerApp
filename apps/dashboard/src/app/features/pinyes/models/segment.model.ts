export type FigureMode = 'COMPLETA' | 'PEU' | 'REMAT' | 'NETA';

export interface InstanceDetail {
  id: string;
  label: string | null;
  sortOrder: number;
  snapshotted: boolean;
  assignedCount: number;
  pinyaAssignedCount: number;
  pinyaCapacity: number | null;
  totalCordons: number | null;
  numberOfCordons: number | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
  figureMode: FigureMode;
  figureTemplate: { id: string; name: string; hasPinya: boolean } | null;
  compositionTemplate: { id: string; name: string } | null;
}

export interface TroncFloorData {
  z: number;
  isBase: boolean;
  slots: (string | null)[];
}

export interface InstanceTroncSummary {
  instanceId: string;
  floors: TroncFloorData[];
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
  figureMode?: FigureMode;
}
