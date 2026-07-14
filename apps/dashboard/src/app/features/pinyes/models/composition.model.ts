import { FigureNodeItem } from './figure-template.model';
import { FigureMode } from './segment.model';

export interface CompositionEntryItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  angle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  figureMode: FigureMode;
  numberOfCordons: number | null;
  cordonsObertsEnabled: boolean;
  sortOrder: number;
  troncGridCols: number;
  troncGridRows: number;
  figureTemplate: {
    id: string;
    name: string;
    hasPinya: boolean;
    direction: number;
    nodes: FigureNodeItem[];
  };
}

export interface CompositionDetail {
  id: string;
  name: string;
  description: string | null;
  entries: CompositionEntryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CompositionListItem {
  id: string;
  name: string;
  description: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompositionEntryPayload {
  figureTemplateId: string;
  label?: string;
  offsetX: number;
  offsetY: number;
  angle: number;
  troncPanelX?: number | null;
  troncPanelY?: number | null;
  figureMode?: FigureMode;
  numberOfCordons?: number | null;
  cordonsObertsEnabled?: boolean;
  sortOrder?: number;
}

export interface CreateCompositionPayload {
  name: string;
  description?: string;
  entries?: CreateCompositionEntryPayload[];
}

export interface UpdateCompositionPayload {
  name?: string;
  description?: string;
  entries?: CreateCompositionEntryPayload[];
}

export interface CompositionFilterParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCompositions {
  data: CompositionListItem[];
  meta: { total: number; page: number; limit: number };
}
