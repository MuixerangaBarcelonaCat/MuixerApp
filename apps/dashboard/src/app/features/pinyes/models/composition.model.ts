export type {
  CompositionSlotItem,
  CompositionSlotFigureTemplate,
  CompositionTemplateListItem,
  CompositionTemplateDetail,
} from '@muixer/shared';

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
  data: import('@muixer/shared').CompositionTemplateListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
