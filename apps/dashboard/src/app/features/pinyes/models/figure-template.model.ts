import { FigureZone, NodeShape } from '@muixer/shared';

export interface FigureNodeItem {
  id: string;
  label: string;
  zone: FigureZone;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: NodeShape;
  sortOrder: number;
  climbPath: string | null;
  ringLevel: number | null;
  originNodeId: string | null;
  renglaId: string | null;
  renglaPosition: number | null;
  metadata: Record<string, unknown>;
}

export interface RenglaModel {
  id: string;
  name: string;
  sortOrder: number;
  allowsCordoObert: boolean;
}

export interface FigureTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hasPinya: boolean;
  direction: number;
  nodeCount: number;
  renglaCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FigureTemplateDetail extends FigureTemplateListItem {
  metadata: Record<string, unknown>;
  nodes: FigureNodeItem[];
  rengles: RenglaModel[];
  adHocInstanceCount?: number;
}

export interface FigureTemplateFilterParams {
  search?: string;
  hasPinya?: boolean;
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
  description?: string;
  hasPinya?: boolean;
  direction?: number;
  metadata?: Record<string, unknown>;
  nodes: CreateFigureNodePayload[];
}

export interface UpdateFigureTemplatePayload {
  name?: string;
  description?: string;
  hasPinya?: boolean;
  direction?: number;
  metadata?: Record<string, unknown>;
  nodes?: CreateFigureNodePayload[];
  rengles?: RenglaModel[];
}

export interface PaginatedFigureTemplates {
  data: FigureTemplateListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
