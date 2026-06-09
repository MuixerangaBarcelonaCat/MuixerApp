export type { InstanceRef, SegmentDetail } from '@muixer/shared';

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

