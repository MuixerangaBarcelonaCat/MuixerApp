export type {
  FigureFamilyVariant,
  FigureFamilyListItem,
  FigureFamilyDetail,
} from '@muixer/shared';

export interface FigureFamilyFilterParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedFigureFamilies {
  data: import('@muixer/shared').FigureFamilyListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface CreateFigureFamilyPayload {
  name: string;
  slug: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateFigureFamilyPayload {
  name?: string;
  slug?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
