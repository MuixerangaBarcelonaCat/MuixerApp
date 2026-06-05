import { FigureZone, NodeShape } from '@muixer/shared';
import type { RenglaItem, FigureTemplateListItem } from '@muixer/shared';

export type {
  FigureNodeItem,
  RenglaItem,
  FigureTemplateListItem,
  FigureTemplateDetail,
} from '@muixer/shared';

export interface FigureTemplateFilterParams {
  search?: string;
  hasPinya?: boolean;
  familyId?: string;
  page?: number;
  limit?: number;
}

export interface CreateFigureNodePayload {
  id?: string;
  label: string;
  zone: FigureZone;
  positionType?: string;
  x: number;
  y: number;
  z?: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
  shape: NodeShape;
  sortOrder?: number;
  climbPath?: string;
  ringLevel?: number;
  originNodeId?: string;
  renglaId?: string;
  renglaPosition?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateFigureTemplatePayload {
  name: string;
  slug: string;
  familyId: string;
  variantOrder?: number;
  description?: string;
  hasPinya?: boolean;
  direction?: number;
  metadata?: Record<string, unknown>;
  nodes: CreateFigureNodePayload[];
}

export interface UpdateFigureTemplatePayload {
  name?: string;
  slug?: string;
  description?: string;
  hasPinya?: boolean;
  direction?: number;
  metadata?: Record<string, unknown>;
  nodes?: CreateFigureNodePayload[];
  rengles?: RenglaItem[];
}

export interface PaginatedFigureTemplates {
  data: FigureTemplateListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
