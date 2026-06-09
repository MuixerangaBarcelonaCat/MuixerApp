import { FigureTemplateDetail } from './figure-template.model';

export interface CompositionSlotItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: FigureTemplateDetail;
}

export interface CompositionTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompositionTemplateDetail extends CompositionTemplateListItem {
  slots: CompositionSlotItem[];
}

export interface CompositionTemplateFilterParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCompositionSlotPayload {
  figureTemplateId: string;
  label?: string;
  offsetX: number;
  offsetY: number;
  sortOrder?: number;
}

export interface CreateCompositionTemplatePayload {
  name: string;
  slug: string;
  description?: string;
  slots: CreateCompositionSlotPayload[];
}

export interface UpdateCompositionTemplatePayload {
  name?: string;
  slug?: string;
  description?: string;
  slots?: CreateCompositionSlotPayload[];
}

export interface PaginatedCompositionTemplates {
  data: CompositionTemplateListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
